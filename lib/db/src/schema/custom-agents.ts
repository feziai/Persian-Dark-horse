import { bigint, boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export type AgentSocialLink = {
  platform: "instagram" | "threads" | "facebook" | "x" | "tiktok" | "linkedin" | "website" | "other";
  label: string;
  url: string;
};

export const customAgentsTable = pgTable("custom_agents", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description").notNull().default(""),
  gender: text("gender").notNull().default("unspecified"),
  avatarUrl: text("avatar_url"),
  coverUrl: text("cover_url"),
  category: text("category").notNull().default("General"),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  personality: jsonb("personality").$type<Record<string, unknown>>().notNull().default({}),
  systemInstructions: text("system_instructions").notNull().default(""),
  developerInstructions: text("developer_instructions").notNull().default(""),
  capabilities: jsonb("capabilities").$type<string[]>().notNull().default([]),
  tools: jsonb("tools").$type<string[]>().notNull().default([]),
  socialLinks: jsonb("social_links").$type<AgentSocialLink[]>().notNull().default([]),
  connectedModels: jsonb("connected_models").$type<string[]>().notNull().default([]),
  knowledgeText: text("knowledge_text").notNull().default(""),
  memoryEnabled: boolean("memory_enabled").notNull().default(false),
  apiEnabled: boolean("api_enabled").notNull().default(false),
  siteEnabled: boolean("site_enabled").notNull().default(false),
  siteTitle: text("site_title").notNull().default(""),
  siteIntro: text("site_intro").notNull().default(""),
  siteTheme: text("site_theme").notNull().default("midnight"),
  siteCapabilities: jsonb("site_capabilities").$type<string[]>().notNull().default(["chat"]),
  siteCustomDomain: text("site_custom_domain"),
  siteDomainStatus: text("site_domain_status").notNull().default("not_configured"),
  visibility: text("visibility").notNull().default("private"),
  status: text("status").notNull().default("draft"),
  model: text("model").notNull().default("qwen/qwen3.8-27b"),
  usageCount: integer("usage_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const customAgentApiKeysTable = pgTable("custom_agent_api_keys", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  ownerId: text("owner_id").notNull(),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull(),
  lastFour: text("last_four").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  // Site keys share the owner's wallet; null means wallet-backed unlimited use.
  creditLimit: bigint("credit_limit", { mode: "number" }),
  creditsUsed: bigint("credits_used", { mode: "number" }).notNull().default(0),
});

// Separate from subscription Credits and per-Agent API balances.
export const siteApiCreditsTable = pgTable("site_api_credits", {
  ownerId: text("owner_id").primaryKey(),
  credits: integer("credits").notNull().default(0),
});

export type CustomAgent = typeof customAgentsTable.$inferSelect;
export type CustomAgentApiKey = typeof customAgentApiKeysTable.$inferSelect;