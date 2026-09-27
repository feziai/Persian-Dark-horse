import { pool } from "@workspace/db";
import { clerkClient } from "@clerk/express";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { getAuthenticatedUserId } from "../middlewares/auth";
import { objectStorageClient } from "./promptStudioStorage";
import { accountPhotoUrl } from "./profile-defaults";

export const OFFICIAL = "fezi-official";
export class CommunityError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const query = async (text: string, values: unknown[] = []) => (await pool.query(text, values)).rows;
export const fail = (status: number, message: string): never => { throw new CommunityError(status, message); };
export function uid(req: Request) { return getAuthenticatedUserId(req) || fail(401, "Sign in to continue."); }
export async function ensureProfile(id: string, verifiedEmail = false) {
  if (id === OFFICIAL) {
    await query("INSERT INTO community_profiles(id,name,avatar_url) VALUES($1,'Persian Dark Horse','/fezi-avatar.webp') ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,avatar_url=EXCLUDED.avatar_url", [id]);
    return;
  }
  let user;
  try { user = await clerkClient.users.getUser(id); } catch { fail(503, "Account verification is temporarily unavailable."); }
  if (!user) return fail(503, "Account verification is unavailable.");
  if (verifiedEmail && !user.emailAddresses.some(e => e.id === user.primaryEmailAddressId && e.verification?.status === "verified"))
    fail(403, "Verify your primary email before posting, messaging, or uploading.");
  const [local] = await query("SELECT display_name, avatar_id FROM user_profiles WHERE user_id=$1", [id]);
  const name = String(local?.display_name || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "Member").slice(0, 100);
  const avatar = local?.avatar_id && local.avatar_id !== "account-photo"
    ? local.avatar_id
    : (accountPhotoUrl(user) ?? null);
  await query(`INSERT INTO community_profiles(id,name,avatar_url) VALUES($1,$2,$3)
    ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,avatar_url=EXCLUDED.avatar_url`, [id, name, avatar]);
}
export async function blocked(a: string | undefined, b: string) {
  if (!a) return false;
  return (await query(`SELECT 1 FROM community_edges WHERE kind='block' AND
    ((actor=$1 AND target=$2) OR (actor=$2 AND target=$1)) LIMIT 1`, [a, b])).length > 0;
}
export async function interact(a: string, b: string) {
  if (await blocked(a, b)) fail(403, "This interaction is unavailable.");
}
export async function rate(key: string, maximum = 30) {
  const [row] = await query(`INSERT INTO community_limits(key,"window",count) VALUES($1,date_trunc('minute',now()),1)
    ON CONFLICT(key,"window") DO UPDATE SET count=community_limits.count+1 RETURNING count`, [key]);
  if (row.count > maximum) fail(429, "Too many requests. Please wait a minute.");
}
export function cursor(value: unknown) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > 300) return fail(400, "Invalid cursor.");
  try {
    const v = JSON.parse(Buffer.from(value, "base64url").toString());
    if (!Array.isArray(v) || v.length !== 2 || typeof v[0] !== "string" || !Number.isFinite(Date.parse(v[0])) || typeof v[1] !== "string" || v[1].length > 100) throw Error();
    return v as [string, string];
  } catch { return fail(400, "Invalid cursor."); }
}
export function nextCursor(rows: any[], size = 30) {
  const last = rows[size - 1];
  return rows.length > size && last ? Buffer.from(JSON.stringify([new Date(last.created_at).toISOString(), last.id])).toString("base64url") : null;
}
export async function profile(id: string, viewer?: string) {
  if (id === OFFICIAL) await ensureProfile(OFFICIAL);
  const [p] = await query(`SELECT p.*, u.username AS account_username,
    EXISTS(SELECT 1 FROM account_subscriptions s WHERE s.user_id=p.id AND s.status='active'
      AND s.plan_id IN ('rider','swift-rider','horse-runner','lone-rider','sovereign') AND (s.expires_at>now() OR (s.plan_id='sovereign' AND s.expires_at IS NULL))) AS verified,
    (SELECT count(*)::int FROM community_edges WHERE kind='follow' AND target=p.id) AS followers,
    (SELECT count(*)::int FROM community_edges WHERE kind='follow' AND actor=p.id) AS following,
    EXISTS(SELECT 1 FROM community_edges WHERE kind='follow' AND actor=$2 AND target=p.id) AS followed
    FROM community_profiles p LEFT JOIN user_profiles u ON u.user_id=p.id WHERE p.id=$1`, [id, viewer || null]);
  if (!p) return fail(404, "Community profile not found.");
  return { id: p.id, name: p.name, username: p.account_username ?? null, avatarUrl: p.avatar_url, bio: p.bio, links: p.links, verified: p.verified,
    followerCount: p.followers, followingCount: p.following, isFollowing: p.followed, isBlocked: await blocked(viewer, id) };
}
export async function post(id: string, viewer?: string, admin = false): Promise<any> {
  const [p] = await query(`SELECT p.*,
    (SELECT count(*)::int FROM community_edges WHERE kind='like' AND target=p.id) AS likes,
    (SELECT count(*)::int FROM community_posts r WHERE r.parent_id=p.id AND NOT EXISTS(
      SELECT 1 FROM community_edges e WHERE e.kind='block' AND ((e.actor=$2 AND e.target=r.author_id) OR (e.target=$2 AND e.actor=r.author_id)))) AS replies,
    EXISTS(SELECT 1 FROM community_edges WHERE kind='like' AND actor=$2 AND target=p.id) AS liked
    FROM community_posts p WHERE p.id=$1`, [id, viewer || null]);
  if (!p || p.kind === "prompt_removed" || (!admin && await blocked(viewer, p.author_id))) return fail(404, "Post not found.");
  const media = await query("SELECT id,kind FROM community_media WHERE post_id=$1 ORDER BY created_at,id", [id]);
  const promptId = p.kind === "prompt" && typeof p.source_url === "string"
    ? /^\/prompt-studio\/([a-zA-Z0-9_-]{1,100})$/.exec(p.source_url)?.[1] : undefined;
  const [promptImage] = promptId ? await query(
    `SELECT i.id FROM prompt_studio_images i JOIN prompt_studio_prompts p
      ON p.id=i.prompt_id AND p.owner_user_id IS NOT DISTINCT FROM i.owner_user_id
      WHERE i.prompt_id=$1 ORDER BY i.created_at DESC,i.id DESC LIMIT 1`,
    [promptId],
  ) : [];
  return { id: p.id, author: await profile(p.author_id, viewer), text: p.text, media: [
    ...media.map(m => ({ ...m, url: `/api/community/media/${m.id}` })),
    ...(promptImage ? [{ id: promptImage.id, kind: "image", url: `/api/prompt-studio/images/${encodeURIComponent(promptImage.id)}` }] : []),
  ],
    kind: p.kind, parentId: p.parent_id, createdAt: p.created_at.toISOString(), likeCount: p.likes, replyCount: p.replies,
    liked: p.liked, title: p.title, sourceUrl: p.source_url };
}
export const promptCommunityUrl = (promptId: string) => `/prompt-studio/${encodeURIComponent(promptId)}`;

/** A unique source URL makes retries and concurrent first-image uploads idempotent. */
export async function announceGalleryPrompt(promptId: string, authorId: string) {
  const source = promptCommunityUrl(promptId);
  const [existing] = await query(
    `SELECT c.id,c.kind FROM community_posts c JOIN prompt_studio_prompts p ON p.id=$2
      WHERE c.source_url=$1 AND p.owner_user_id=$3 AND p.built_in='false'`,
    [source, promptId, authorId],
  );
  if (existing?.kind === "prompt_removed") fail(409, "This prompt's Community post has been removed.");
  if (existing?.kind === "prompt") return existing.id as string;
  await ensureProfile(authorId, true);
  const [created] = await query(`INSERT INTO community_posts(id,author_id,text,kind,title,source_url)
    SELECT $1,p.owner_user_id,coalesce(nullif(p.description,''),'New prompt in Picture Studio.'),'prompt',p.title,$2
    FROM prompt_studio_prompts p WHERE p.id=$3 AND p.owner_user_id=$4 AND p.built_in='false'
    AND EXISTS (SELECT 1 FROM prompt_studio_images i WHERE i.prompt_id=p.id AND i.owner_user_id=$4)
    ON CONFLICT (source_url) DO NOTHING RETURNING id`,
    [randomUUID(), source, promptId, authorId]);
  if (created) return created.id as string;
  const [winner] = await query(
    "SELECT id,kind FROM community_posts WHERE source_url=$1",
    [source],
  );
  if (winner?.kind === "prompt_removed") fail(409, "This prompt's Community post has been removed.");
  if (!winner) fail(400, "This prompt needs an image from its creator before it can be shared in Community.");
  return winner.id as string;
}
/** Announce an editorial prompt when it is first seeded with a reference image. */
export async function announceCuratedGalleryPrompt(promptId: string) {
  await ensureProfile(OFFICIAL);
  const source = promptCommunityUrl(promptId);
  await query(`INSERT INTO community_posts(id,author_id,text,kind,title,source_url)
    SELECT $1,$2,coalesce(nullif(p.description,''),'New prompt in Picture Studio.'),'prompt',p.title,$3
    FROM prompt_studio_prompts p WHERE p.id=$4 AND p.built_in='true'
    AND EXISTS (SELECT 1 FROM prompt_studio_images i WHERE i.prompt_id=p.id AND i.owner_user_id IS NULL)
    ON CONFLICT (source_url) DO NOTHING`,
    [randomUUID(), OFFICIAL, source, promptId]);
}
let lastGalleryReconciliation = 0;
let galleryReconciliation: Promise<void> | undefined;
/** Retry image-backed prompts whose Community write failed or whose browser closed. */
export function reconcileGalleryAnnouncements(): Promise<void> {
  if (galleryReconciliation) return galleryReconciliation;
  if (Date.now() - lastGalleryReconciliation < 60_000) return Promise.resolve();
  lastGalleryReconciliation = Date.now();
  galleryReconciliation = (async () => {
    const missing = await query(`SELECT p.id,p.owner_user_id FROM prompt_studio_prompts p
      WHERE p.built_in='false' AND p.owner_user_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM prompt_studio_images i WHERE i.prompt_id=p.id AND i.owner_user_id=p.owner_user_id)
      AND NOT EXISTS (SELECT 1 FROM community_posts c WHERE c.source_url='/prompt-studio/' || p.id)
      ORDER BY p.created_at DESC LIMIT 10`);
    const results = await Promise.allSettled(missing.map(p => announceGalleryPrompt(p.id, p.owner_user_id)));
    const failures = results.filter(result => result.status === "rejected").length;
    if (failures) console.warn(`Community gallery reconciliation: ${failures} announcement(s) pending retry.`);
  })().finally(() => { galleryReconciliation = undefined; });
  return galleryReconciliation;
}
export async function notify(owner: string, actor: string, type: string, text: string, href: string) {
  if (owner === actor || owner === OFFICIAL || await blocked(owner, actor)) return;
  await query("INSERT INTO community_notifications(id,owner_id,actor_id,type,text,href) VALUES($1,$2,$3,$4,$5,$6)", [randomUUID(), owner, actor, type, text, href]);
  // Delivery is best effort; the durable in-app notification remains authoritative.
  const { sendCommunityPush } = await import("./communityPush");
  await sendCommunityPush(owner, { title: "Persian Dark Horse Community", body: text, url: href, type }).catch(() => undefined);
}
export async function createPost(author: string, text: string, mediaIds: string[], parentId: string | null, kind = "post", title: string | null = null, source: string | null = null) {
  const client = await pool.connect();
  const id = randomUUID();
  try {
    await client.query("BEGIN");
    // Serializes publication/attachment with block and deletion mutations.
    await client.query("SELECT pg_advisory_xact_lock(742019)");
    if (parentId) {
      const parent = (await client.query("SELECT author_id FROM community_posts WHERE id=$1 AND kind!='prompt_removed'", [parentId])).rows[0];
      if (!parent) fail(404, "Reply target not found.");
      await interact(author, parent.author_id);
    }
    const media = (await client.query("SELECT * FROM community_media WHERE id=ANY($1::text[]) FOR UPDATE", [mediaIds])).rows;
    if (media.length !== mediaIds.length || media.some(m => m.owner_id !== author || m.post_id || new Date(m.created_at).getTime() < Date.now() - 86400000)) fail(400, "Media is missing, expired, already attached, or not owned by you.");
    if (media.some(m => m.kind === "video") && (media.length !== 1 || media[0].bytes > 6_250_000)) fail(400, "Use up to five images OR one video no larger than 6,250,000 bytes.");
    await client.query("INSERT INTO community_posts(id,author_id,text,parent_id,kind,title,source_url) VALUES($1,$2,$3,$4,$5,$6,$7)", [id, author, text, parentId, kind, title, source]);
    await client.query("UPDATE community_media SET post_id=$1 WHERE id=ANY($2::text[])", [id, mediaIds]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; } finally { client.release(); }
  if (parentId) {
    const [parent] = await query("SELECT author_id FROM community_posts WHERE id=$1", [parentId]);
    if (parent) await notify(parent.author_id, author, "reply", "Someone replied to your post.", `/community/post/${encodeURIComponent(parentId!)}`);
  }
  return post(id, author);
}
export function storageFile(key: string) {
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) return fail(503, "App Storage is unavailable.");
  return objectStorageClient.bucket(bucket).file(key);
}
export async function removePost(id: string, hardDeletePrompt = false) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT pg_advisory_xact_lock(742019)");
    const root = (await c.query("SELECT kind FROM community_posts WHERE id=$1 FOR UPDATE", [id])).rows[0];
    const ids = (await c.query(`WITH RECURSIVE thread AS (SELECT id FROM community_posts WHERE id=$1 UNION ALL SELECT p.id FROM community_posts p JOIN thread t ON p.parent_id=t.id) SELECT id FROM thread`, [id])).rows.map(r => r.id);
    const media = (await c.query("SELECT object_key FROM community_media WHERE post_id=ANY($1::text[])", [ids])).rows;
    for (const m of media) await storageFile(m.object_key).delete({ ignoreNotFound: true });
    await c.query("DELETE FROM community_media WHERE post_id=ANY($1::text[])", [ids]);
    await c.query("DELETE FROM community_edges WHERE kind='like' AND target=ANY($1::text[])", [ids]);
    if ((root?.kind === "prompt" || root?.kind === "prompt_removed") && !hardDeletePrompt) {
      await c.query("DELETE FROM community_posts WHERE id=ANY($1::text[]) AND id<>$2", [ids, id]);
      // Keep the unique source URL as a tombstone: a removed post cannot be
      // republished by its author or by the gallery's retry/reconciliation path.
      await c.query("UPDATE community_posts SET kind='prompt_removed',text='',title=NULL WHERE id=$1", [id]);
    } else {
      await c.query("DELETE FROM community_posts WHERE id=ANY($1::text[])", [ids]);
    }
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
}