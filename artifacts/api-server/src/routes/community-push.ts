import { Router, type IRouter } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { communityPushSubscriptions } from "../../../../lib/db/src/schema/community-push";
import { getAuthenticatedUserId, requireAuth } from "../middlewares/auth";
import { communityPushConfig, endpointHash, validPushEndpoint, validPushKey } from "../lib/communityPush";

const router: IRouter = Router();
const attempts = new Map<string, { count: number; until: number }>();
function throttle(userId: string): boolean {
  const now = Date.now();
  if (attempts.size > 2000) {
    for (const [id, entry] of attempts) if (entry.until <= now) attempts.delete(id);
    if (attempts.size > 2000) attempts.clear();
  }
  const entry = attempts.get(userId);
  if (!entry || now >= entry.until) {
    attempts.set(userId, { count: 1, until: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 12;
}

router.get("/community/push/config", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(communityPushConfig());
});

router.post("/community/push/subscriptions", requireAuth, async (req, res) => {
  const userId = getAuthenticatedUserId(req)!;
  if (throttle(userId)) { res.status(429).json({ error: "Too many push requests." }); return; }
  if (!communityPushConfig().enabled) { res.status(503).json({ error: "Push notifications are unavailable." }); return; }
  const { endpoint, keys } = req.body ?? {};
  if (!validPushEndpoint(endpoint) || !keys || !validPushKey(keys.p256dh, 65) ||
      Buffer.from(keys.p256dh, "base64url")[0] !== 4 || !validPushKey(keys.auth, 16)) {
    res.status(400).json({ error: "Invalid push subscription." }); return;
  }
  const hash = endpointHash(endpoint);
  try {
    // Lock on this user's row scope, preventing concurrent requests exceeding the device cap.
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
      const [existing] = await tx.select({ ownerId: communityPushSubscriptions.ownerId })
        .from(communityPushSubscriptions).where(eq(communityPushSubscriptions.endpointHash, hash)).limit(1);
      if (existing && existing.ownerId !== userId) throw new Error("owned");
      if (!existing) {
        const [{ count }] = await tx.select({ count: sql<number>`count(*)::int` })
          .from(communityPushSubscriptions).where(eq(communityPushSubscriptions.ownerId, userId));
        if (count >= 5) throw new Error("limit");
      }
      await tx.insert(communityPushSubscriptions)
        .values({ endpointHash: hash, ownerId: userId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
        .onConflictDoUpdate({
          target: communityPushSubscriptions.endpointHash,
          set: { p256dh: keys.p256dh, auth: keys.auth },
          setWhere: eq(communityPushSubscriptions.ownerId, userId),
        });
    });
    res.status(204).end();
  } catch (error) {
    if ((error as Error).message === "owned") res.status(409).json({ error: "This device belongs to another account. Unsubscribe there first." });
    else if ((error as Error).message === "limit") res.status(409).json({ error: "Maximum of five push devices reached." });
    else res.status(503).json({ error: "Unable to save push subscription." });
  }
});

router.delete("/community/push/subscriptions", requireAuth, async (req, res) => {
  const userId = getAuthenticatedUserId(req)!;
  if (throttle(userId)) { res.status(429).json({ error: "Too many push requests." }); return; }
  const endpoint = req.body?.endpoint;
  if (!validPushEndpoint(endpoint)) { res.status(400).json({ error: "Invalid push endpoint." }); return; }
  try {
    await db.delete(communityPushSubscriptions).where(and(
      eq(communityPushSubscriptions.ownerId, userId),
      eq(communityPushSubscriptions.endpointHash, endpointHash(endpoint)),
    ));
    res.status(204).end();
  } catch {
    res.status(503).json({ error: "Unable to remove push subscription." });
  }
});

export default router;