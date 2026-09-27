import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const userEmailOutboxTable = pgTable("user_email_outbox", {
  eventKey: text("event_key").primaryKey(),
  userId: text("user_id"),
  recipient: text("recipient"),
  kind: text("kind").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  skippedAt: timestamp("skipped_at", { withTimezone: true }),
  nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).notNull().defaultNow(),
  attempts: integer("attempts").notNull().default(0),
});