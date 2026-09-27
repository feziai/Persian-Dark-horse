import { pgTable, text, timestamp, boolean, primaryKey, index } from "drizzle-orm/pg-core";
export const communityEdges = pgTable("community_edges", {
  actor: text("actor").notNull(), target: text("target").notNull(), kind: text("kind").notNull(),
}, t => [primaryKey({ columns: [t.actor, t.target, t.kind] }), index("community_edges_target").on(t.target, t.kind)]);
export const communityNotifications = pgTable("community_notifications", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), actorId: text("actor_id").notNull(),
  type: text("type").notNull(), text: text("text").notNull(), href: text("href").notNull(),
  read: boolean("read").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("community_notifications_owner").on(t.ownerId, t.createdAt)]);
export const communityMessages = pgTable("community_messages", {
  id: text("id").primaryKey(), senderId: text("sender_id").notNull(), recipientId: text("recipient_id").notNull(),
  text: text("text").notNull(), read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("community_messages_sender").on(t.senderId, t.createdAt), index("community_messages_recipient").on(t.recipientId, t.createdAt)]);
export const communityReports = pgTable("community_reports", {
  id: text("id").primaryKey(), reporterId: text("reporter_id").notNull(), postId: text("post_id"), userId: text("user_id"),
  reason: text("reason").notNull(), status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});