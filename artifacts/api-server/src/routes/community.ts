import { Router, raw, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { pool } from "@workspace/db";
import { getAuthenticatedUserId } from "../middlewares/auth";
import { queueAdminEmail } from "../lib/admin-email";
import { requireAdmin } from "./fezi-data";
import { CommunityError, OFFICIAL, query, fail, uid, ensureProfile, blocked, interact, rate, cursor, nextCursor, profile, post, notify, createPost, storageFile, removePost, reconcileGalleryAnnouncements } from "../lib/community";
import { syncCommunityNews, newsStatus, announceNews } from "../lib/communityNews";
import { initializePresets } from "./prompt-studio";

const router: IRouter = Router();
let visitWindow = 0, visitsInWindow = 0;
async function validateVideo(bytes: Buffer) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("ffprobe", ["-v", "error", "-protocol_whitelist", "pipe", "-show_entries", "stream=codec_type,codec_name,width,height", "-of", "json", "-i", "pipe:0"], { stdio: ["pipe", "pipe", "ignore"] });
    let output = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new CommunityError(400, "Video validation timed out.")); }, 5000);
    child.on("error", () => { clearTimeout(timer); reject(new CommunityError(503, "Video validation is unavailable.")); });
    child.stdout.on("data", chunk => { output += chunk; if (output.length > 100000) child.kill("SIGKILL"); });
    child.stdin.on("error", () => undefined);
    child.on("close", code => {
      clearTimeout(timer);
      try {
        const data = JSON.parse(output);
        const streams = z.array(z.object({ codec_type: z.string(), codec_name: z.string(), width: z.number().optional(), height: z.number().optional() })).min(1).max(4).parse(data.streams);
        if (code !== 0 || !streams.some(s => s.codec_type === "video") || streams.some(s =>
          !["video", "audio"].includes(s.codec_type) ||
          (s.codec_type === "video" && (!["h264", "hevc", "av1", "vp9"].includes(s.codec_name) || !s.width || !s.height || s.width * s.height > 16777216))))
          throw Error();
        resolve();
      } catch { reject(new CommunityError(400, "The video is invalid or uses an unsupported codec.")); }
    });
    child.stdin.end(bytes);
  });
}
const text = z.string().trim().max(5000);
const id = z.string().min(1).max(150);
const webUrl = z.string().max(2000).refine(v => { try { return ["http:", "https:"].includes(new URL(v).protocol); } catch { return false; } }, "Use an HTTP or HTTPS URL.");
const localOrWeb = z.string().max(2000).refine(v => !v || (v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")) || webUrl.safeParse(v).success, "Invalid URL.");
const postBody = z.object({ text: text.default(""), mediaIds: z.array(id).max(5).default([]), parentId: id.optional() }).refine(v => v.text.length || v.mediaIds.length, "A post requires text or media.").refine(v => new Set(v.mediaIds).size === v.mediaIds.length, "Duplicate media.");
const banner = z.object({ id, title: z.string().max(200), text: z.string().max(2000), imageUrl: localOrWeb, buttonLabel: z.string().max(100), buttonHref: localOrWeb, enabled: z.boolean(), sortOrder: z.number().int().min(0).max(1000) });
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { Promise.resolve(fn(req, res)).catch(next); };
router.use(["/community", "/admin/community"], (req, res, next) => {
  if (req.method !== "GET" && req.headers["sec-fetch-site"] === "cross-site") { res.status(403).json({ error: "Cross-site mutations are not allowed." }); return; }
  next();
});
router.use("/admin/community", (req, res, next) => { if (requireAdmin(req, res)) next(); });
router.use(["/community", "/admin/community"], (req, res, next) => {
  if (req.method === "GET") return next();
  const actor = getAuthenticatedUserId(req), admin = req.originalUrl.startsWith("/api/admin/community");
  if (!actor && !admin && req.path !== "/visit") { res.status(401).json({ error: "Sign in to continue." }); return; }
  if (actor || admin) rate(`write:${admin ? "admin" : actor}`, 40).then(() => next(), next); else next();
});
router.get("/community/posts", wrap(async (req, res) => {
  await initializePresets();
  await reconcileGalleryAnnouncements();
  const tab = z.enum(["all", "following", "news"]).parse(req.query.tab || "all"), viewer = getAuthenticatedUserId(req);
  if (tab === "following" && !viewer) fail(401, "Sign in to view followed accounts.");
  const author = req.query.authorId === undefined ? null : id.parse(req.query.authorId), parent = req.query.parentId === undefined ? null : id.parse(req.query.parentId), c = cursor(req.query.cursor);
  const search = z.string().trim().max(120).optional().parse(req.query.q) || null;
  const limit = z.coerce.number().int().min(1).max(30).parse(req.query.limit ?? 30);
  if (parent) await post(parent, viewer);
  const rows = await query(`SELECT p.id,p.created_at FROM community_posts p WHERE p.kind!='prompt_removed' AND
    ($1::text IS NULL OR p.author_id=$1) AND (($2::text IS NULL AND p.parent_id IS NULL) OR p.parent_id=$2)
    AND ($3!='news' OR p.kind='news')
    AND ($3!='following' OR EXISTS(SELECT 1 FROM community_edges WHERE kind='follow' AND actor=$4 AND target=p.author_id))
    AND NOT EXISTS(SELECT 1 FROM community_edges e WHERE kind='block' AND ((actor=$4 AND target=p.author_id) OR (target=$4 AND actor=p.author_id)))
    AND ($5::timestamptz IS NULL OR (p.created_at,p.id)<($5::timestamptz,$6::text))
    AND ($8::text IS NULL OR strpos(lower(coalesce(p.text,'') || ' ' || coalesce(p.title,'')), lower($8)) > 0)
    ORDER BY p.created_at DESC,p.id DESC LIMIT $7`, [author, parent, tab, viewer || null, c?.[0] || null, c?.[1] || null, limit + 1, search]);
  res.json({ posts: await Promise.all(rows.slice(0, limit).map(r => post(r.id, viewer))), nextCursor: nextCursor(rows, limit) });
}));
router.get("/community/posts/:id", wrap(async (req, res) => { res.json({ post: await post(id.parse(req.params.id), getAuthenticatedUserId(req)) }); }));
router.post("/community/posts", wrap(async (req, res) => {
  const actor = uid(req), body = postBody.parse(req.body);
  await ensureProfile(actor, true); await rate(`post:${actor}`, 6);
  const created = await createPost(actor, body.text, body.mediaIds, body.parentId || null);
  if (!body.parentId) {
    await queueAdminEmail(
      `post:${created.id}`,
      "پست جدید در Persian Dark Horse",
      `یک پست جدید منتشر شد.\nشناسه نویسنده: ${actor}\nشناسه پست: ${created.id}\nمسیر: /community/post/${encodeURIComponent(created.id)}`,
    );
  }
  res.status(201).json({ post: created });
}));
router.patch("/community/posts/:id", wrap(async (req, res) => {
  const actor = uid(req), body = z.object({ text }).parse(req.body), target = id.parse(req.params.id), current = await post(target, actor);
  if (current.author.id !== actor) fail(403, "Only the author can edit this post.");
  if (!body.text && !current.media.length) fail(400, "A post requires text or media.");
  await query("UPDATE community_posts SET text=$1 WHERE id=$2 AND author_id=$3", [body.text, target, actor]);
  res.json({ post: await post(target, actor) });
}));
router.delete("/community/posts/:id", wrap(async (req, res) => {
  const actor = uid(req), target = id.parse(req.params.id), current = await post(target, actor);
  if (current.author.id !== actor) fail(403, "Only the author can delete this post.");
  await removePost(target); res.sendStatus(204);
}));
router.put("/community/posts/:id/like", wrap(async (req, res) => {
  const actor = uid(req), target = id.parse(req.params.id), { liked } = z.object({ liked: z.boolean() }).parse(req.body);
  const current = await post(target, actor); await interact(actor, current.author.id); await ensureProfile(actor);
  if (liked) {
    const rows = await query("INSERT INTO community_edges(actor,target,kind) VALUES($1,$2,'like') ON CONFLICT DO NOTHING RETURNING actor", [actor, target]);
    if (rows.length) await notify(current.author.id, actor, "like", "Someone liked your post.", `/community/post/${encodeURIComponent(target)}`);
  } else await query("DELETE FROM community_edges WHERE actor=$1 AND target=$2 AND kind='like'", [actor, target]);
  const result = await post(target, actor); res.json({ liked: result.liked, likeCount: result.likeCount });
}));
const upload = (admin: boolean) => wrap(async (req, res) => {
  const actor = admin ? OFFICIAL : uid(req);
  if (!admin) await ensureProfile(actor, true);
  await rate(`upload:${actor}`, 10);
  if (!Buffer.isBuffer(req.body) || !req.body.length) fail(400, "Upload raw supported image or video bytes.");
  if (req.body.length > 6_250_000) fail(413, "The upload must be no larger than 6,250,000 bytes.");
  const input: Buffer = req.body, mime = String(req.headers["content-type"] || "").split(";")[0];
  let out: Buffer, kind: string, storedMime: string;
  if (["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    try {
      const meta = await sharp(input, { limitInputPixels: 25_000_000 }).metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format || "") || (meta.pages || 1) > 1) fail(400, "Unsupported image format.");
      out = await sharp(input, { limitInputPixels: 25_000_000 }).rotate().resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { return fail(400, "The image is invalid or exceeds safe dimensions."); }
    kind = "image"; storedMime = "image/webp";
  } else if (!admin && mime === "video/mp4") {
    let offset = 0, ftyp = false, moov = false, mdat = false;
    while (offset + 8 <= input.length) {
      let size = input.readUInt32BE(offset); const type = input.toString("ascii", offset + 4, offset + 8);
      if (size === 1) fail(400, "Extended MP4 boxes are unsupported.");
      if (size === 0) size = input.length - offset;
      if (size < 8 || offset + size > input.length) fail(400, "Invalid MP4 structure.");
      if (type === "ftyp" && offset === 0 && size >= 16) ftyp = true;
      if (type === "moov") moov = true;
      if (type === "mdat" && size > 8) mdat = true;
      offset += size;
    }
    if (offset !== input.length || !ftyp || !moov || !mdat) fail(400, "Upload a valid MP4 video.");
    await validateVideo(input);
    out = input; kind = "video"; storedMime = "video/mp4";
  } else return fail(415, "Supported formats: JPEG, PNG, WebP images and MP4 video. SVG is not allowed.");
  const mediaId = randomUUID(), key = `community/${mediaId}.${kind === "image" ? "webp" : "mp4"}`;
  try { await storageFile(key).save(out, { resumable: false, contentType: storedMime }); } catch { return fail(503, "App Storage could not save this upload. Please retry."); }
  try { await query("INSERT INTO community_media(id,owner_id,object_key,kind,mime,bytes) VALUES($1,$2,$3,$4,$5,$6)", [mediaId, actor, key, kind, storedMime, out.length]); }
  catch (e) { await storageFile(key).delete({ ignoreNotFound: true }); throw e; }
  res.status(201).json({ media: { id: mediaId, url: `/api/community/media/${mediaId}`, kind } });
});
router.post("/community/uploads", raw({ type: ["image/jpeg", "image/png", "image/webp", "video/mp4"], limit: 6_250_000 }), upload(false));
router.post("/admin/community/uploads", raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: 6_250_000 }), upload(true));
router.get("/community/media/:id", wrap(async (req, res) => {
  const [m] = await query("SELECT * FROM community_media WHERE id=$1", [id.parse(req.params.id)]);
  if (!m) fail(404, "Media not found.");
  const actor = getAuthenticatedUserId(req);
  if (m.post_id) await post(m.post_id, actor); else if (m.owner_id !== actor && m.owner_id !== OFFICIAL) fail(404, "Media not found.");
  res.setHeader("Content-Type", m.mime); res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox"); res.setHeader("Cache-Control", "private, max-age=120"); res.setHeader("Accept-Ranges", "bytes");
  let start = 0, end = m.bytes - 1;
  if (req.headers.range) {
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
    if (!range) { res.status(416).setHeader("Content-Range", `bytes */${m.bytes}`); res.end(); return; }
    start = Number(range[1]); end = range[2] ? Number(range[2]) : end;
    if (start > end || end >= m.bytes) { res.status(416).end(); return; }
    res.status(206); res.setHeader("Content-Range", `bytes ${start}-${end}/${m.bytes}`);
  }
  res.setHeader("Content-Length", end - start + 1);
  const stream = storageFile(m.object_key).createReadStream({ start, end });
  stream.on("error", () => { if (!res.headersSent) res.status(503).json({ error: "Media storage is unavailable." }); else res.destroy(); }); stream.pipe(res);
}));
router.get("/community/profiles/:id", wrap(async (req, res) => {
  const actor = getAuthenticatedUserId(req), target = req.params.id === "me" ? uid(req) : id.parse(req.params.id);
  if (target === actor) await ensureProfile(target);
  const p = await profile(target, actor);
  const creations = p.isBlocked ? [] : await query("SELECT id,name,slug FROM custom_agents WHERE owner_id=$1 AND visibility='public' AND status='active' ORDER BY created_at DESC LIMIT 50", [target]);
  res.json({ profile: p, creations: creations.map(c => ({ id: c.id, name: c.name, url: `/agents/${encodeURIComponent(c.id)}` })) });
}));
router.patch("/community/profile", wrap(async (req, res) => {
  const actor = uid(req), body = z.object({ bio: z.string().trim().max(500), links: z.array(webUrl).max(5) }).parse(req.body);
  await ensureProfile(actor); await query("UPDATE community_profiles SET bio=$1,links=$2::jsonb WHERE id=$3", [body.bio, JSON.stringify(body.links), actor]);
  res.json({ profile: await profile(actor, actor) });
}));
router.put("/community/profiles/:id/follow", wrap(async (req, res) => {
  const actor = uid(req), target = id.parse(req.params.id), { following } = z.object({ following: z.boolean() }).parse(req.body);
  if (actor === target) fail(400, "You cannot follow yourself.");
  await profile(target, actor); await interact(actor, target); await ensureProfile(actor);
  if (following) {
    const rows = await query("INSERT INTO community_edges(actor,target,kind) VALUES($1,$2,'follow') ON CONFLICT DO NOTHING RETURNING actor", [actor, target]);
    if (rows.length) await notify(target, actor, "follow", "Someone followed you.", `/community/profile/${actor}`);
  } else await query("DELETE FROM community_edges WHERE actor=$1 AND target=$2 AND kind='follow'", [actor, target]);
  res.json({ following });
}));
router.put("/community/profiles/:id/block", wrap(async (req, res) => {
  const actor = uid(req), target = id.parse(req.params.id), { blocked: block } = z.object({ blocked: z.boolean() }).parse(req.body);
  if (actor === target) fail(400, "You cannot block yourself.");
  await profile(target, actor);
  if (block) {
    await query("INSERT INTO community_edges(actor,target,kind) VALUES($1,$2,'block') ON CONFLICT DO NOTHING", [actor, target]);
    await query("DELETE FROM community_edges WHERE kind='follow' AND ((actor=$1 AND target=$2) OR (actor=$2 AND target=$1))", [actor, target]);
    await query("DELETE FROM community_notifications WHERE (owner_id=$1 AND actor_id=$2) OR (owner_id=$2 AND actor_id=$1)", [actor, target]);
  } else await query("DELETE FROM community_edges WHERE kind='block' AND actor=$1 AND target=$2", [actor, target]);
  res.json({ blocked: block });
}));
router.post("/community/reports", wrap(async (req, res) => {
  const actor = uid(req), b = z.object({ postId: id.optional(), userId: id.optional(), reason: z.string().trim().min(5).max(2000) }).refine(v => Boolean(v.postId) !== Boolean(v.userId), "Exactly one report target is required.").parse(req.body);
  await rate(`report:${actor}`, 5);
  if (b.postId && !(await query("SELECT id FROM community_posts WHERE id=$1 AND kind!='prompt_removed'", [b.postId])).length) fail(404, "Post not found.");
  if (b.userId) await profile(b.userId, actor);
  const reportId = randomUUID();
  await query("INSERT INTO community_reports(id,reporter_id,post_id,user_id,reason) VALUES($1,$2,$3,$4,$5)", [reportId, actor, b.postId || null, b.userId || null, b.reason]);
  res.status(201).json({ id: reportId });
}));
router.get("/community/notifications", wrap(async (req, res) => {
  const actor = uid(req);
  const notifications = await query(`SELECT id,type,text,href,read,created_at AS "createdAt" FROM community_notifications n WHERE owner_id=$1
    AND NOT EXISTS(SELECT 1 FROM community_edges WHERE kind='block' AND ((actor=$1 AND target=n.actor_id) OR (target=$1 AND actor=n.actor_id)))
    ORDER BY created_at DESC LIMIT 100`, [actor]);
  const [count] = await query("SELECT count(*)::int AS count FROM community_notifications WHERE owner_id=$1 AND NOT read", [actor]);
  res.json({ notifications, unreadCount: count.count });
}));
router.post("/community/notifications/read", wrap(async (req, res) => {
  const actor = uid(req), b = z.object({ ids: z.array(id).max(100).optional() }).parse(req.body || {});
  await query("UPDATE community_notifications SET read=true WHERE owner_id=$1 AND ($2::text[] IS NULL OR id=ANY($2::text[]))", [actor, b.ids || null]); res.json({ ok: true });
}));
router.get("/community/conversations", wrap(async (req, res) => {
  const actor = uid(req);
  const rows = await query(`WITH messages AS (SELECT *,CASE WHEN sender_id=$1 THEN recipient_id ELSE sender_id END AS peer FROM community_messages WHERE sender_id=$1 OR recipient_id=$1)
    SELECT DISTINCT ON(peer) peer,text,created_at,(SELECT count(*)::int FROM community_messages x WHERE x.sender_id=messages.peer AND x.recipient_id=$1 AND NOT x.read) AS unread
    FROM messages WHERE NOT EXISTS(SELECT 1 FROM community_edges WHERE kind='block' AND ((actor=$1 AND target=peer) OR (target=$1 AND actor=peer)))
    ORDER BY peer,created_at DESC LIMIT 100`, [actor]);
  const conversations = await Promise.all(rows.map(async r => ({ peer: await profile(r.peer, actor), lastMessage: r.text, updatedAt: r.created_at, unreadCount: r.unread })));
  conversations.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()); res.json({ conversations });
}));
router.get("/community/messages/:userId", wrap(async (req, res) => {
  const actor = uid(req), target = id.parse(req.params.userId), c = cursor(req.query.cursor);
  await interact(actor, target);
  const rows = await query(`SELECT * FROM community_messages WHERE ((sender_id=$1 AND recipient_id=$2) OR (sender_id=$2 AND recipient_id=$1))
    AND ($3::timestamptz IS NULL OR (created_at,id)<($3::timestamptz,$4::text)) ORDER BY created_at DESC,id DESC LIMIT 31`, [actor, target, c?.[0] || null, c?.[1] || null]);
  await query("UPDATE community_messages SET read=true WHERE recipient_id=$1 AND sender_id=$2 AND id=ANY($3::text[])", [actor, target, rows.slice(0, 30).map(r => r.id)]);
  res.json({ messages: rows.slice(0, 30).map(r => ({ id: r.id, senderId: r.sender_id, text: r.text, createdAt: r.created_at })), nextCursor: nextCursor(rows) });
}));
router.post("/community/messages/:userId", wrap(async (req, res) => {
  const actor = uid(req), target = id.parse(req.params.userId), b = z.object({ text: text.min(1) }).parse(req.body);
  if (actor === target || target === OFFICIAL) fail(400, "Choose another community member.");
  await ensureProfile(actor, true); await profile(target, actor); await interact(actor, target); await rate(`message:${actor}`, 12);
  const [m] = await query("INSERT INTO community_messages(id,sender_id,recipient_id,text) VALUES($1,$2,$3,$4) RETURNING *", [randomUUID(), actor, target, b.text]);
  await notify(target, actor, "message", "You have a new private message.", `/community/messages/${actor}`);
  res.status(201).json({ message: { id: m.id, senderId: m.sender_id, text: m.text, createdAt: m.created_at } });
}));
async function banners(enabledOnly = false) {
  return query(`SELECT id,title,text,image_url AS "imageUrl",button_label AS "buttonLabel",button_href AS "buttonHref",enabled,sort_order AS "sortOrder" FROM community_banners ${enabledOnly ? "WHERE enabled" : ""} ORDER BY sort_order,id`);
}
router.get("/community/banners", wrap(async (_req, res) => { res.json({ banners: await banners(true) }); }));
router.post("/community/visit", wrap(async (req, res) => {
  const now = Date.now();
  if (now - visitWindow > 60000) { visitWindow = now; visitsInWindow = 0; }
  if (++visitsInWindow > 1200) fail(429, "Visit collection is busy. Retry later.");
  const b = z.object({ visitorId: z.string().uuid(), path: z.string().max(300).startsWith("/") }).parse(req.body);
  const hash = createHash("sha256").update(`fezi-visit:${new Date().toISOString().slice(0, 10)}:${b.visitorId}`).digest("hex");
  await rate("visits:global", 1200);
  await rate(`visit:${hash}`, 4);
  await query(`WITH visit AS (
    INSERT INTO community_presence(visitor_hash,last_seen,last_visit) VALUES($1,now(),now())
    ON CONFLICT(visitor_hash) DO UPDATE SET last_seen=now(),last_visit=CASE WHEN community_presence.last_seen<now()-interval '30 minutes' THEN now() ELSE community_presence.last_visit END RETURNING last_seen=last_visit AS counted)
    INSERT INTO community_visits(day,visits) SELECT CURRENT_DATE,1 FROM visit WHERE counted ON CONFLICT(day) DO UPDATE SET visits=community_visits.visits+1`, [hash]);
  res.sendStatus(204);
}));
router.get("/admin/community", wrap(async (_req, res) => {
  const reports = await query(`SELECT id,reason,status,post_id AS "postId",user_id AS "userId",created_at AS "createdAt" FROM community_reports ORDER BY created_at DESC LIMIT 200`);
  const news = await query("SELECT id FROM community_posts WHERE kind='news' ORDER BY created_at DESC LIMIT 50");
  res.json({ reports, banners: await banners(), news: await Promise.all(news.map(n => post(n.id, undefined, true))), newsStatus: await newsStatus() });
}));
router.put("/admin/community/banners", wrap(async (req, res) => {
  const b = z.object({ banners: z.array(banner).max(20) }).parse(req.body);
  if (new Set(b.banners.map(v => v.id)).size !== b.banners.length) fail(400, "Duplicate banner IDs.");
  const c = await pool.connect();
  try {
    await c.query("BEGIN"); await c.query("DELETE FROM community_banners");
    for (const v of b.banners) await c.query("INSERT INTO community_banners(id,title,text,image_url,button_label,button_href,enabled,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8)", [v.id,v.title,v.text,v.imageUrl,v.buttonLabel,v.buttonHref,v.enabled,v.sortOrder]);
    await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  res.json({ banners: await banners() });
}));
router.post("/admin/community/news", wrap(async (req, res) => {
  const b = z.object({ title: z.string().trim().min(1).max(300), text: text.min(1), mediaIds: z.array(id).max(5).default([]), sourceUrl: webUrl.optional() }).parse(req.body);
  await ensureProfile(OFFICIAL);
  const result = await createPost(OFFICIAL, b.text, b.mediaIds, null, "news", b.title, b.sourceUrl || null);
  await announceNews(result.id); res.status(201).json({ post: result });
}));
router.patch("/admin/community/reports/:id", wrap(async (req, res) => {
  const b = z.object({ status: z.enum(["resolved", "dismissed"]), removePost: z.boolean().optional() }).parse(req.body);
  const [report] = await query("SELECT * FROM community_reports WHERE id=$1", [id.parse(req.params.id)]);
  if (!report) fail(404, "Report not found.");
  if (b.removePost && report.post_id) await removePost(report.post_id);
  await query("UPDATE community_reports SET status=$1 WHERE id=$2", [b.status, report.id]); res.json({ ok: true });
}));
router.delete("/admin/community/posts/:id", wrap(async (req, res) => { await removePost(id.parse(req.params.id)); res.sendStatus(204); }));
router.post("/admin/community/news/sync", wrap(async (_req, res) => { res.json(await syncCommunityNews()); }));
router.get("/admin/community/analytics", wrap(async (req, res) => {
  const period = z.enum(["day", "week", "month"]).parse(req.query.period || "day"), days = { day: 1, week: 7, month: 30 }[period];
  const [online] = await query("SELECT count(*)::int AS count FROM community_presence WHERE last_seen>now()-interval '2 minutes'");
  const series = await query(`SELECT d::date::text AS label,COALESCE(v.visits,0)::int AS visits FROM generate_series(CURRENT_DATE-($1::int-1),CURRENT_DATE,interval '1 day') d LEFT JOIN community_visits v ON v.day=d::date ORDER BY d`, [days]);
  res.json({ online: online.count, visits: series.reduce((n,r) => n+r.visits, 0), series });
}));
router.get("/community/data", wrap(async (req, res) => {
  const actor = uid(req);
  const [profiles, posts, media, edges, notifications, messages, reports] = await Promise.all([
    query("SELECT * FROM community_profiles WHERE id=$1", [actor]), query("SELECT * FROM community_posts WHERE author_id=$1", [actor]),
    query("SELECT id,post_id,kind,bytes,created_at FROM community_media WHERE owner_id=$1", [actor]), query("SELECT * FROM community_edges WHERE actor=$1", [actor]),
    query("SELECT * FROM community_notifications WHERE owner_id=$1", [actor]), query("SELECT * FROM community_messages WHERE sender_id=$1 OR recipient_id=$1", [actor]),
    query("SELECT * FROM community_reports WHERE reporter_id=$1", [actor]),
  ]);
  res.setHeader("Cache-Control", "no-store"); res.json({ profiles, posts, media, edges, notifications, messages, reports });
}));
router.delete("/community/data", wrap(async (req, res) => {
  const actor = uid(req);
  for (const p of await query("SELECT id FROM community_posts WHERE author_id=$1", [actor])) await removePost(p.id);
  for (const m of await query("SELECT object_key FROM community_media WHERE owner_id=$1", [actor])) await storageFile(m.object_key).delete({ ignoreNotFound: true });
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("DELETE FROM community_media WHERE owner_id=$1", [actor]);
    await c.query("DELETE FROM community_edges WHERE actor=$1 OR target=$1", [actor]);
    await c.query("DELETE FROM community_notifications WHERE owner_id=$1 OR actor_id=$1", [actor]);
    await c.query("DELETE FROM community_messages WHERE sender_id=$1 OR recipient_id=$1", [actor]);
    await c.query("DELETE FROM community_reports WHERE reporter_id=$1 OR user_id=$1", [actor]);
    await c.query("DELETE FROM community_push_subscriptions WHERE owner_id=$1", [actor]);
    await c.query("DELETE FROM community_limits WHERE key=ANY($1::text[])", [[`write:${actor}`, `post:${actor}`, `upload:${actor}`, `report:${actor}`, `message:${actor}`]]);
    await c.query("DELETE FROM community_profiles WHERE id=$1", [actor]); await c.query("COMMIT");
  } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  res.sendStatus(204);
}));
router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(error);
  if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues.map(i => i.message).join(" ") }); return; }
  if (error instanceof CommunityError) { res.status(error.status).json({ error: error.message }); return; }
  if ((error as { type?: string })?.type === "entity.too.large") { res.status(413).json({ error: "The upload must be no larger than 6,250,000 bytes." }); return; }
  res.status(500).json({ error: "Community request failed. Please retry." });
});
export default router;