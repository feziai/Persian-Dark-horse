import { pgTable, text, timestamp, boolean, integer, jsonb, index } from "drizzle-orm/pg-core";
export const communityProfiles = pgTable("community_profiles", {
  id: text("id").primaryKey(), name: text("name").notNull(), avatarUrl: text("avatar_url"),
  bio: text("bio").notNull().default(""), links: jsonb("links").$type<string[]>().notNull().default([]),
});
export const communityPosts = pgTable("community_posts", {
  id: text("id").primaryKey(), authorId: text("author_id").notNull(), text: text("text").notNull(),
  kind: text("kind").notNull().default("post"), parentId: text("parent_id"),
  title: text("title"), sourceUrl: text("source_url").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("community_posts_feed").on(t.createdAt, t.id), index("community_posts_author").on(t.authorId), index("community_posts_parent").on(t.parentId)]);
export const communityMedia = pgTable("community_media", {
  id: text("id").primaryKey(), ownerId: text("owner_id").notNull(), postId: text("post_id"),
  objectKey: text("object_key").notNull(), kind: text("kind").notNull(), mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const communityBanners = pgTable("community_banners", {
  id: text("id").primaryKey(), title: text("title").notNull(), text: text("text").notNull(),
  imageUrl: text("image_url").notNull(), buttonLabel: text("button_label").notNull(), buttonHref: text("button_href").notNull(),
  enabled: boolean("enabled").notNull(), sortOrder: integer("sort_order").notNull(),
});