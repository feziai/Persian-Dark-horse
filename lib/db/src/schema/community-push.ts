import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Endpoints and encryption material are private, owner-scoped data; never expose in public profiles.
export const communityPushSubscriptions = pgTable("community_push_subscriptions", {
  endpointHash: text("endpoint_hash").primaryKey(),
  ownerId: text("owner_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("community_push_subscriptions_owner").on(t.ownerId)]);