import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, randomInt } from "node:crypto";

export function parseRedeemAmount(value: unknown) {
  if (typeof value !== "string" || value.length > 20 || !/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(value)) {
    throw new Error("Enter a USD amount with at most two decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents < 1000n) throw new Error("The minimum purchase is $10.");
  if (cents * 8n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount exceeds safe credit storage capacity.");
  return { cents: Number(cents), credits: Number(cents * 8n) };
}

// The authoritative transfer string never passes through floating point.
// Subtract (never charge) a sub-cent reference. Six decimals normally suffice;
// higher precision is available if the six-decimal namespace is already used.
export function referenceAmount(cents: number, highPrecision = false) {
  const offset = highPrecision
    ? BigInt(`0x${randomBytes(7).toString("hex")}`) % 9_999_999_999_999_999n + 1n
    : BigInt(randomInt(1, 10000)) * 1_000_000_000_000n;
  const units = BigInt(cents) * 10_000_000_000_000_000n - offset;
  return `${units / 10n ** 18n}.${(units % 10n ** 18n).toString().padStart(18, "0")}`.replace(/0+$/, "");
}

function key() {
  const override = process.env.REDEEM_CODE_ENCRYPTION_KEY;
  if (override) {
    if (!/^[0-9a-f]{64}$/i.test(override)) throw new Error("Redeem-code encryption configuration is invalid.");
    return Buffer.from(override, "hex");
  }
  if (!process.env.SESSION_SECRET) throw new Error("Redeem-code encryption is not configured.");
  return Buffer.from(hkdfSync("sha256", process.env.SESSION_SECRET, "fezi/redeem-code/v1", "AES-256-GCM at-rest code encryption", 32));
}
export function assertRedeemEncryption() { key(); }
export function codeDigest(code: string) { return createHash("sha256").update(code).digest("hex"); }
export function newRedeemCode() { return `FEZI-${randomBytes(24).toString("hex").toUpperCase()}`; }
export function encryptRedeemCode(code: string, orderId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(orderId));
  const ciphertext = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), ciphertext.toString("hex")].join(":");
}
export function decryptRedeemCode(value: string, orderId: string) {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== "v1") throw new Error("Unsupported redeem-code encryption version.");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  cipher.setAAD(Buffer.from(orderId));
  cipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([cipher.update(Buffer.from(ciphertext, "hex")), cipher.final()]).toString("utf8");
}