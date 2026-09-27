import { text, timestamp } from "drizzle-orm/pg-core";
import { pgTable } from "drizzle-orm/pg-core";

export const agentSiteSubscriptionsTable = pgTable("agent_site_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  status: text("status").notNull().default("active"),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  paymentId: text("payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentSiteSubscription = typeof agentSiteSubscriptionsTable.$inferSelect;