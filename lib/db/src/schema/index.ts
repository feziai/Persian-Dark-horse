// Export your models here. Add one export per file
// export * from "./posts";
//
// Each model/table should ideally be split into different files.
// Each model/table should define a Drizzle table, insert schema, and types:
//
//   import { pgTable, text, serial } from "drizzle-orm/pg-core";
//   import { createInsertSchema } from "drizzle-zod";
//   import { z } from "zod/v4";
//
//   export const postsTable = pgTable("posts", {
//     id: serial("id").primaryKey(),
//     title: text("title").notNull(),
//   });
//
//   export const insertPostSchema = createInsertSchema(postsTable).omit({ id: true });
//   export type InsertPost = z.infer<typeof insertPostSchema>;
//   export type Post = typeof postsTable.$inferSelect;

export * from "./custom-agents";
export * from "./agent-sites";
export * from "./account";
export * from "./chat";
export * from "./site-settings";
export * from "./rewards";
export * from "./projects";
export * from "./prompt-studio";
export * from "./prompt-studio-usage";
export * from "./support-tickets";
export * from "./community-content";
export * from "./community-social";
export * from "./community-operations";
export * from "./community-push";
export * from "./admin-email-outbox";
export * from "./user-email-outbox";
export * from "./admin-codes";