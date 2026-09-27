import { createInsertSchema } from "drizzle-zod";
import { bigint, integer, pgTable, text, timestamp, uniqueIndex, boolean } from "drizzle-orm/pg-core";

export const adminCodesTable = pgTable("admin_codes", {
  id: text("id").primaryKey(),
  codeHash: text("code_hash").notNull().unique(),
  codeCiphertext: text("code_ciphertext").notNull(),
  kind: text("kind").notNull(),
  value: bigint("value", { mode: "number" }).notNull(),
  planId: text("plan_id"),
  maxUses: integer("max_uses").notNull(),
  usedCount: integer("used_count").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminCodeRedemptionsTable = pgTable("admin_code_redemptions", {
  id: text("id").primaryKey(),
  codeId: text("code_id").notNull().references(() => adminCodesTable.id),
  userId: text("user_id").notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  oncePerUser: uniqueIndex("admin_code_redemptions_code_user_idx").on(table.codeId, table.userId),
}));

export const insertAdminCodeSchema = createInsertSchema(adminCodesTable);
export const insertAdminCodeRedemptionSchema = createInsertSchema(adminCodeRedemptionsTable);
export type AdminCode = typeof adminCodesTable.$inferSelect;