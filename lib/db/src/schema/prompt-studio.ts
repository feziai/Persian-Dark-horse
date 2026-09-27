import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const promptStudioPromptsTable = pgTable("prompt_studio_prompts", {
  id: text("id").primaryKey(),
  ownerUserId: text("owner_user_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  promptText: text("prompt_text").notNull(),
  category: text("category").notNull(),
  builtIn: text("built_in").notNull().default("false"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promptStudioImagesTable = pgTable("prompt_studio_images", {
  id: text("id").primaryKey(),
  promptId: text("prompt_id").notNull(),
  ownerUserId: text("owner_user_id"),
  objectKey: text("object_key").notNull(),
  mimeType: text("mime_type").notNull().default("image/webp"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promptStudioCommentsTable = pgTable("prompt_studio_comments", {
  id: text("id").primaryKey(),
  promptId: text("prompt_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const promptStudioRatingsTable = pgTable("prompt_studio_ratings", {
  id: text("id").primaryKey(),
  promptId: text("prompt_id").notNull(),
  ownerUserId: text("owner_user_id").notNull(),
  rating: integer("rating").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  promptUserUnique: uniqueIndex("prompt_studio_ratings_prompt_user_uq").on(table.promptId, table.ownerUserId),
}));

export const insertPromptStudioPromptSchema = createInsertSchema(promptStudioPromptsTable).omit({ createdAt: true });
export const insertPromptStudioImageSchema = createInsertSchema(promptStudioImagesTable).omit({ createdAt: true });
export const insertPromptStudioCommentSchema = createInsertSchema(promptStudioCommentsTable).omit({ createdAt: true });
export type PromptStudioPrompt = typeof promptStudioPromptsTable.$inferSelect;
export type PromptStudioImage = typeof promptStudioImagesTable.$inferSelect;
export type PromptStudioComment = typeof promptStudioCommentsTable.$inferSelect;
export type PromptStudioRating = typeof promptStudioRatingsTable.$inferSelect;