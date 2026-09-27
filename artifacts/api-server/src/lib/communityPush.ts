import { createCipheriv, createECDH, createHash, createHmac, createPrivateKey, hkdfSync, randomBytes, sign } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { communityPushSubscriptions } from "../../../../lib/db/src/schema/community-push";

// Changing SESSION_SECRET intentionally invalidates existing push subscriptions.
// Domain separation ensures the session key is never used directly as a VAPID key.
const VAPID_SALT = "FEZI community web push VAPID v1 salt";
const VAPID_INFO = "FEZI community web push P-256 private scalar v1";
const DEFAULT_SUBJECT = "mailto:notifications@fezi.ai";

function vapidKeys() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) return null;
  try {
    const scalar = Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), VAPID_SALT, VAPID_INFO, 32));
    const key = createECDH("prime256v1");
    key.setPrivateKey(scalar);
    return {
      publicKey: key.getPublicKey(undefined, "uncompressed").toString("base64url"),
      privateKey: scalar.toString("base64url"),
    };
  } catch {
    return null;
  }
}

export function communityPushConfig(): { enabled: boolean; publicKey: string | null } {
  const keys = vapidKeys();
  return { enabled: !!keys, publicKey: keys?.publicKey ?? null };
}

export function endpointHash(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

// Never permit arbitrary subscriber-supplied URLs: web-push delivery is an outbound
// server request. Exact provider suffixes with a dot boundary avoid SSRF and lookalikes.
export function validPushEndpoint(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== "string" || endpoint.length > 2048 || endpoint.length < 20) return false;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    const host = url.hostname.toLowerCase();
    if (host !== "fcm.googleapis.com" &&
        host !== "updates.push.services.mozilla.com" &&
        host !== "push.services.mozilla.com" &&
        host !== "web.push.apple.com" &&
        !host.endsWith(".push.apple.com") &&
        host !== "notify.windows.com" &&
        !host.endsWith(".notify.windows.com")) return false;
    return true;
  } catch {
    return false;
  }
}

export function validPushKey(value: unknown, length: number): value is string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    return Buffer.from(value, "base64url").length === length &&
      Buffer.from(value, "base64url").toString("base64url") === value;
  } catch {
    return false;
  }
}

function expand(prk: Buffer, info: Buffer, size: number): Buffer {
  return createHmac("sha256", prk).update(info).update(Buffer.from([1])).digest().subarray(0, size);
}

function encryptPayload(payload: string, p256dh: string, auth: string): Buffer {
  const recipient = Buffer.from(p256dh, "base64url");
  const sender = createECDH("prime256v1");
  sender.generateKeys();
  const senderPublic = sender.getPublicKey(undefined, "uncompressed");
  const shared = sender.computeSecret(recipient);
  const prkKey = createHmac("sha256", Buffer.from(auth, "base64url")).update(shared).digest();
  const ikm = expand(prkKey, Buffer.concat([Buffer.from("WebPush: info\0"), recipient, senderPublic]), 32);
  const salt = randomBytes(16);
  const prk = createHmac("sha256", salt).update(ikm).digest();
  const cek = expand(prk, Buffer.from("Content-Encoding: aes128gcm\0"), 16);
  const nonce = expand(prk, Buffer.from("Content-Encoding: nonce\0"), 12);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header);
  header.writeUInt32BE(4096, 16);
  header[20] = senderPublic.length;
  return Buffer.concat([header, senderPublic, encrypted]);
}

function vapidToken(endpoint: string, keys: NonNullable<ReturnType<typeof vapidKeys>>, subject: string): string {
  const header = Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({
    aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 3600, sub: subject,
  })).toString("base64url");
  const scalar = Buffer.from(keys.privateKey, "base64url");
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(scalar);
  const point = ecdh.getPublicKey(undefined, "uncompressed");
  const privateKey = createPrivateKey({ key: {
    kty: "EC", crv: "P-256", d: keys.privateKey,
    x: point.subarray(1, 33).toString("base64url"),
    y: point.subarray(33).toString("base64url"),
  }, format: "jwk" });
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key: privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${header}.${claims}.${signature}`;
}

type PushContent = { title: string; body: string; url: string; type?: string };

export async function sendCommunityPush(userId: string, content: PushContent): Promise<void> {
  const keys = vapidKeys();
  if (!keys) return;
  // Only relative, same-origin community destinations may be opened by the worker.
  const safeUrl = /^\/community(?:\/|$|\?)/.test(content.url) &&
    !/[\\\r\n]/.test(content.url) && !/%(?:2f|5c|00)/i.test(content.url)
    ? content.url.slice(0, 500) : "/community";
  // Even callers that omit type cannot accidentally put a DM excerpt on the lock screen.
  const isMessage = content.type === "message" ||
    /^\/community\/messages(?:\/|$|\?)/.test(safeUrl) ||
    /\b(?:message|direct message|dm)\b|پیام/i.test(content.title);
  const payload = JSON.stringify({
    title: isMessage ? "New private message" : String(content.title).slice(0, 100),
    body: isMessage ? "You have a new private message." : String(content.body).slice(0, 240),
    url: safeUrl,
  });
  const subscriptions = await db.select().from(communityPushSubscriptions)
    .where(eq(communityPushSubscriptions.ownerId, userId)).limit(10);
  const subject = process.env.WEB_PUSH_SUBJECT;
  // WEB_PUSH_SUBJECT is a nonsecret mailto: contact, not an authentication credential.
  const contact = subject && /^mailto:[^\s@]+@[^\s@]+$/.test(subject) ? subject : DEFAULT_SUBJECT;
  await Promise.allSettled(subscriptions.map(async (subscription) => {
    // Revalidate stored endpoints before sending, including data from older schema versions.
    if (!validPushEndpoint(subscription.endpoint)) return;
    try {
      const response = await fetch(subscription.endpoint, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: `vapid t=${vapidToken(subscription.endpoint, keys, contact)}, k=${keys.publicKey}`,
          "Content-Encoding": "aes128gcm",
          "Content-Type": "application/octet-stream",
          TTL: "3600",
        },
        body: encryptPayload(payload, subscription.p256dh, subscription.auth),
      });
      if (response.status === 404 || response.status === 410) {
        await db.delete(communityPushSubscriptions).where(and(
          eq(communityPushSubscriptions.endpointHash, subscription.endpointHash),
          eq(communityPushSubscriptions.ownerId, userId),
        ));
      }
    } catch {
      // Do not log provider errors: some contain endpoints or request headers.
    }
  }));
}