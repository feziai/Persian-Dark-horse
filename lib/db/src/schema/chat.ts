import { createInsertSchema } from "drizzle-zod";
import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const chatConversationsTable = pgTable("chat_conversations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  agentId: text("agent_id").notNull(),
  title: text("title").notNull().default("New chat"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull(),
  userId: text("user_id").notNull(),
  agentId: text("agent_id").notNull(),
  role: text("role").notNull(),
  text: text("text").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertChatConversationSchema = createInsertSchema(chatConversationsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertChatMessageSchema = createInsertSchema(chatMessagesTable).omit({
  createdAt: true,
});

export type ChatConversation = typeof chatConversationsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;