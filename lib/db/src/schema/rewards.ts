import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const rewardTasksTable = pgTable("reward_tasks", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  titleFa: text("title_fa").notNull(),
  description: text("description").notNull().default(""),
  descriptionFa: text("description_fa").notNull().default(""),
  kind: text("kind").notNull().default("action"),
  rewardCredits: integer("reward_credits").notNull().default(0),
  actionUrl: text("action_url"),
  requiresManualReview: boolean("requires_manual_review").notNull().default(false),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  slugIndex: uniqueIndex("reward_tasks_slug_idx").on(table.slug),
  activeOrderIndex: index("reward_tasks_active_order_idx").on(table.active, table.sortOrder),
}));

export const rewardTaskClaimsTable = pgTable("reward_task_claims", {
  id: text("id").primaryKey(),
  claimKey: text("claim_key").notNull(),
  taskId: text("task_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("pending"),
  proofUrl: text("proof_url"),
  proofText: text("proof_text"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
}, (table) => ({
  userTaskIndex: index("reward_task_claims_user_task_idx").on(table.userId, table.taskId),
  claimKeyIndex: uniqueIndex("reward_task_claims_claim_key_idx").on(table.claimKey),
  taskStatusIndex: index("reward_task_claims_task_status_idx").on(table.taskId, table.status),
}));

export type RewardTask = typeof rewardTasksTable.$inferSelect;
export type RewardTaskClaim = typeof rewardTaskClaimsTable.$inferSelect;