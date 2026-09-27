import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const promptStudioUsageLedgerTable = pgTable("prompt_studio_usage_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  promptId: text("prompt_id").notNull(),
  action: text("action").notNull(),
  creditsCharged: integer("credits_charged").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userPromptIndex: index("prompt_studio_usage_user_prompt_idx").on(table.userId, table.promptId),
}));

export const insertPromptStudioUsageLedgerSchema = createInsertSchema(promptStudioUsageLedgerTable).omit({ createdAt: true });
export type PromptStudioUsageLedgerEntry = typeof promptStudioUsageLedgerTable.$inferSelect;