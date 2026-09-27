import { pool } from "@workspace/db";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { OFFICIAL, query, ensureProfile, fail, notify, storageFile } from "./community";
import { logger } from "./logger";

export async function newsStatus() {
  const [r] = await query("SELECT last_run,error FROM community_jobs WHERE id='news'");
  return { configured: Boolean(process.env.GNEWS_API_KEY), lastRun: r?.last_run || null,
    error: !process.env.GNEWS_API_KEY ? "GNEWS_API_KEY is not configured. Automatic news import is disabled." : r?.error || null };
}
export async function announceNews(postId: string) {
  for (const f of await query("SELECT actor FROM community_edges WHERE target=$1 AND kind='follow'", [OFFICIAL]))
    await notify(f.actor, OFFICIAL, "news", "Persian Dark Horse published a news update.", `/community?post=${postId}`);
}
export async function syncCommunityNews() {
  if (!process.env.GNEWS_API_KEY) return fail(503, "GNEWS_API_KEY is not configured. Automatic news import is disabled.");
  const claim = await query(`INSERT INTO community_jobs(id,locked_until) VALUES('news',now()+interval '2 minutes')
    ON CONFLICT(id) DO UPDATE SET locked_until=now()+interval '2 minutes'
    WHERE (community_jobs.locked_until IS NULL OR community_jobs.locked_until<now())
    AND (community_jobs.last_run IS NULL OR community_jobs.last_run<=now()-interval '30 minutes') RETURNING id`);
  if (!claim.length) return { published: 0 };
  try {
    const url = new URL("https://gnews.io/api/v4/search");
    url.searchParams.set("q", '"artificial intelligence"'); url.searchParams.set("lang", "en");
    url.searchParams.set("max", "10"); url.searchParams.set("sortby", "publishedAt"); url.searchParams.set("apikey", process.env.GNEWS_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!response.ok) throw new Error(`News provider returned HTTP ${response.status}.`);
    const raw = await response.text();
    if (raw.length > 1_000_000) throw new Error("News provider response exceeded the safe size.");
    const data = z.object({ articles: z.array(z.object({ title: z.string().max(1000), description: z.string().nullable().optional(), url: z.string().url(), source: z.object({ name: z.string().max(200) }) })).max(100) }).parse(JSON.parse(raw));
    await ensureProfile(OFFICIAL);
    let published = 0;
    for (const a of data.articles) {
      const source = new URL(a.url);
      if (!["https:", "http:"].includes(source.protocol) || source.username || source.password) continue;
      source.hash = ""; const sourceUrl = source.toString(), postId = randomUUID();
      if ((await query("SELECT 1 FROM community_news_sources WHERE url=$1", [sourceUrl])).length) continue;
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const result = await c.query("INSERT INTO community_news_sources(url,post_id) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING url", [sourceUrl, postId]);
        if (!result.rowCount) { await c.query("ROLLBACK"); continue; }
        const excerpt = (a.description || "").replace(/<[^>]*>/g, "").slice(0, 350);
        await c.query("INSERT INTO community_posts(id,author_id,text,kind,title,source_url) VALUES($1,$2,$3,'news',$4,$5)", [postId, OFFICIAL, `${excerpt}\n\nSource: ${a.source.name}. Read the original article at the source link.`, a.title.slice(0, 300), sourceUrl]);
        await c.query("UPDATE community_jobs SET last_run=now(),locked_until=NULL,error=NULL WHERE id='news'");
        await c.query("COMMIT"); published = 1;
      } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
      await announceNews(postId); break;
    }
    if (!published) await query("UPDATE community_jobs SET last_run=now(),locked_until=NULL,error=NULL WHERE id='news'");
    return { published };
  } catch (error) {
    const message = error instanceof Error && /^News provider (returned HTTP \d+\.|response exceeded the safe size\.)$/.test(error.message) ? error.message : "News import failed: provider unavailable or returned invalid data.";
    await query("UPDATE community_jobs SET last_run=now(),locked_until=NULL,error=$1 WHERE id='news'", [message]);
    return fail(502, message);
  }
}
async function maintenance() {
  await query("DELETE FROM community_limits WHERE \"window\"<now()-interval '1 day'");
  await query("DELETE FROM community_presence WHERE last_seen<now()-interval '2 days'");
  await query("DELETE FROM community_visits WHERE day<CURRENT_DATE-90");
  await query("DELETE FROM community_notifications WHERE created_at<now()-interval '90 days'");
  const unused = await query(`SELECT * FROM community_media m WHERE post_id IS NULL AND created_at<now()-interval '2 days' AND NOT EXISTS(SELECT 1 FROM community_banners WHERE image_url='/api/community/media/'||m.id) LIMIT 100`);
  for (const m of unused) {
    await storageFile(m.object_key).delete({ ignoreNotFound: true });
    await query("DELETE FROM community_media WHERE id=$1 AND post_id IS NULL", [m.id]);
  }
}
export function startCommunityMaintenance() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; running = true;
    try { await maintenance(); if (process.env.GNEWS_API_KEY) await syncCommunityNews(); }
    catch { logger.warn("Community scheduled maintenance could not complete; it will retry."); }
    finally { running = false; }
  }, 60_000);
  timer.unref();
}