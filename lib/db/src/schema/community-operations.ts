import { pgTable, text, timestamp, integer, primaryKey, date } from "drizzle-orm/pg-core";
export const communityPresence = pgTable("community_presence", {
  visitorHash: text("visitor_hash").primaryKey(), lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
  lastVisit: timestamp("last_visit", { withTimezone: true }).notNull().defaultNow(),
});
export const communityVisits = pgTable("community_visits", {
  day: date("day").primaryKey(), visits: integer("visits").notNull().default(0),
});
export const communityLimits = pgTable("community_limits", {
  key: text("key").notNull(), window: timestamp("window", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(1),
}, t => [primaryKey({ columns: [t.key, t.window] })]);
export const communityJobs = pgTable("community_jobs", {
  id: text("id").primaryKey(), lastRun: timestamp("last_run", { withTimezone: true }),
  lockedUntil: timestamp("locked_until", { withTimezone: true }), error: text("error"),
});
export const communityNewsSources = pgTable("community_news_sources", {
  url: text("url").primaryKey(), postId: text("post_id").notNull(),
  importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
});