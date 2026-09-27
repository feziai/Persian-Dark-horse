import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const siteSettingsTable = pgTable("site_settings", {
  id: text("id").primaryKey(),
  aiEnabled: boolean("ai_enabled").notNull().default(true),
  theme: text("theme").notNull().default("midnight"),
  options: jsonb("options").$type<Record<string, string | boolean>>().notNull().default({}),
  plugins: jsonb("plugins").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SiteSettings = typeof siteSettingsTable.$inferSelect;