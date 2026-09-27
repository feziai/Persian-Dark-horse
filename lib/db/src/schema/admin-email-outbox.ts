import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminEmailOutboxTable = pgTable("admin_email_outbox", {
  eventKey: text("event_key").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
});