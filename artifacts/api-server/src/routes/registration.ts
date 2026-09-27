import { Router, type IRouter } from "express";
import { createHash, randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import { db, userProfilesTable } from "@workspace/db";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { getClerkProxyHost, CLERK_PROXY_PATH } from "../middlewares/clerkProxyMiddleware";
import { registrationUsernamePattern, safeRegistrationCapabilities, type RegistrationSettings } from "./registration-policy";

const router: IRouter = Router();
const bucketSalt = randomBytes(32);
const buckets = new Map<string, { count: number; expires: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 12;
const capabilitiesCache = new Map<string, { value: ReturnType<typeof safeRegistrationCapabilities>; expires: number }>();

function throttle(ip: string) {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [key, value] of buckets) if (value.expires <= now) buckets.delete(key);
    if (buckets.size > 10_000) buckets.clear();
  }
  const key = createHash("sha256").update(bucketSalt).update(ip).digest("hex");
  const bucket = buckets.get(key);
  if (!bucket || bucket.expires <= now) {
    buckets.set(key, { count: 1, expires: now + WINDOW_MS });
    return false;
  }
  bucket.count += 1;
  return bucket.count > LIMIT;
}

// The effective publishable key uses the same host resolution as Clerk middleware.
function frontendHost(host: string) {
  const key = publishableKeyFromHost(host, process.env.CLERK_PUBLISHABLE_KEY);
  const encoded = key.split("_")[2];
  if (!encoded) return null;
  const decodedHost = Buffer.from(encoded, "base64").toString("utf8").replace(/\$$/, "");
  return /^(?:[a-z0-9-]+\.)+clerk\.accounts\.dev$/.test(decodedHost) ? decodedHost : null;
}

router.get("/registration/capabilities", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (throttle(req.ip ?? req.socket.remoteAddress ?? "unknown")) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
    return;
  }
  const host = getClerkProxyHost(req) ?? "";
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host) || host.length > 253) {
    res.status(503).json({ error: "Registration settings unavailable." });
    return;
  }
  const cached = capabilitiesCache.get(host);
  if (cached && cached.expires > Date.now()) {
    res.json(cached.value);
    return;
  }
  try {
    const isProduction = process.env.NODE_ENV === "production";
    const devHost = isProduction ? null : frontendHost(host);
    if (!isProduction && !devHost) throw new Error("Frontend API host unavailable");
    if (isProduction && !process.env.CLERK_SECRET_KEY) throw new Error("Clerk proxy unavailable");
    const response = await fetch(isProduction ? "https://frontend-api.clerk.dev/v1/environment" : `https://${devHost}/v1/environment`, {
      signal: AbortSignal.timeout(4000),
      headers: {
        "Accept": "application/json",
        ...(isProduction ? {
          "Clerk-Proxy-Url": `https://${host}${CLERK_PROXY_PATH}`,
          "Clerk-Secret-Key": process.env.CLERK_SECRET_KEY!,
        } : {}),
      },
    });
    if (!response.ok) throw new Error("Clerk environment unavailable");
    const data = await response.json() as { user_settings?: RegistrationSettings };
    if (!data.user_settings?.attributes) throw new Error("Incomplete Clerk settings");
    const value = safeRegistrationCapabilities(data.user_settings);
    if (capabilitiesCache.size > 100) capabilitiesCache.clear();
    capabilitiesCache.set(host, { value, expires: Date.now() + 60_000 });
    res.json(value);
  } catch {
    res.status(503).json({ error: "Registration settings unavailable. Please try email registration." });
  }
});

router.get("/registration/username-available", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (throttle(req.ip ?? req.socket.remoteAddress ?? "unknown")) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Too many checks. Please try again shortly." });
    return;
  }
  const username = typeof req.query.username === "string" ? req.query.username.trim() : "";
  if (!registrationUsernamePattern.test(username)) {
    res.status(400).json({ error: "Use 4–20 letters, numbers or underscores." });
    return;
  }
  try {
    const [local] = await db.select({ userId: userProfilesTable.userId })
      .from(userProfilesTable)
      .where(eq(sql`lower(${userProfilesTable.username})`, username.toLowerCase()))
      .limit(1);
    // The backend's username filter is exact. Never return names, IDs or matching users.
    const clerk = local ? null : await clerkClient.users.getUserList({ username: [username], limit: 100 });
    res.json({ available: !local && !clerk?.data.some(user => user.username?.toLowerCase() === username.toLowerCase()) });
  } catch {
    res.status(503).json({ error: "Availability cannot be checked right now." });
  }
});

export default router;