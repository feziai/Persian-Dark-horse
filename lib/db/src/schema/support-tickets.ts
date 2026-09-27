import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export type SupportTicketType = "question" | "collaboration" | "payment" | "technical";
export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";

export const supportTicketsTable = pgTable("support_tickets", {
  id: varchar("id", { length: 40 }).primaryKey(),
  type: varchar("type", { length: 32 }).$type<SupportTicketType>().notNull(),
  subject: varchar("subject", { length: 160 }).notNull(),
  message: varchar("message", { length: 5000 }).notNull(),
  contact: varchar("contact", { length: 320 }).notNull(),
  status: varchar("status", { length: 24 }).$type<SupportTicketStatus>().notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  createdAtIndex: index("support_tickets_created_at_idx").on(table.createdAt),
  statusCreatedAtIndex: index("support_tickets_status_created_at_idx").on(table.status, table.createdAt),
}));

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export type SupportTicket = typeof supportTicketsTable.$inferSelect;
export type InsertSupportTicket = typeof supportTicketsTable.$inferInsert;