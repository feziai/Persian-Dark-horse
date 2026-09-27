import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const projectsTable = pgTable("projects", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("active"),
  conversationIds: jsonb("conversation_ids").$type<string[]>().notNull().default([]),
  agentIds: jsonb("agent_ids").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = typeof projectsTable.$inferInsert;