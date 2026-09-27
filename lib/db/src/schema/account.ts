import { bigint, boolean, check, date, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const userProfilesTable = pgTable("user_profiles", {
  userId: text("user_id").primaryKey(),
  username: text("username"),
  displayName: text("display_name").notNull().default(""),
  avatarId: text("avatar_id").notNull().default(""),
  bio: text("bio").notNull().default(""),
  maritalStatus: text("marital_status").notNull().default(""),
  lifeStage: text("life_stage").notNull().default(""),
  occupation: text("occupation").notNull().default(""),
  valuesText: text("values_text").notNull().default(""),
  interestsText: text("interests_text").notNull().default(""),
  customInstructions: text("custom_instructions").notNull().default(""),
  interactionStyle: text("interaction_style").notNull().default(""),
  language: text("language").notNull().default("en"),
  theme: text("theme").notNull().default("system"),
  accent: text("accent").notNull().default("43 68% 60%"),
  sidebarCollapsed: text("sidebar_collapsed").notNull().default("false"),
  notificationsEnabled: text("notifications_enabled").notNull().default("true"),
  voiceEnabled: text("voice_enabled").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  usernameIndex: uniqueIndex("user_profiles_username_ci_idx").on(sql`lower(${table.username})`),
}));

export const userMemoriesTable = pgTable("user_memories", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  content: text("content").notNull(),
  source: text("source").notNull().default("profile"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountActivityTable = pgTable("account_activity", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  label: text("label").notNull(),
  detail: text("detail").notNull().default(""),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const createdFilesTable = pgTable("created_files", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  kind: text("kind").notNull().default("file"),
  objectPath: text("object_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountPaymentsTable = pgTable("account_payments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  planId: text("plan_id").notNull(),
  currencyId: text("currency_id").notNull(),
  txId: text("tx_id").notNull(),
  status: text("status").notNull().default("pending"),
  referralRewardEligible: boolean("referral_reward_eligible").notNull().default(false),
  referralPurchasedCredits: bigint("referral_purchased_credits", { mode: "number" }),
  referralAncestors: jsonb("referral_ancestors").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  txIdIndex: uniqueIndex("account_payments_tx_id_idx").on(table.txId),
  canonicalTxIndex: index("account_payments_canonical_tx_idx").on(sql`lower(trim(${table.txId}))`),
}));

export const accountSubscriptionsTable = pgTable("account_subscriptions", {
  userId: text("user_id").primaryKey(),
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("active"),
  activatedAt: timestamp("activated_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  paymentId: text("payment_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A durable single-consumer ledger, distinct from untrusted hash submissions.
export const paymentConsumptionsTable = pgTable("payment_consumptions", {
  txId: text("tx_id").primaryKey(),
  consumerId: text("consumer_id").notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountCreditsTable = pgTable("account_credits", {
  userId: text("user_id").primaryKey(),
  referralCode: text("referral_code").notNull(),
  credits: bigint("credits", { mode: "number" }).notNull().default(1000),
  creditsLimit: bigint("credits_limit", { mode: "number" }).notNull().default(1000),
  chats: integer("chats").notNull().default(0),
  usageDay: date("usage_day", { mode: "string" }).notNull(),
  freeImagesToday: integer("free_images_today").notNull().default(0),
  freeVideosToday: integer("free_videos_today").notNull().default(0),
  freeVideoUsageByTool: jsonb("free_video_usage_by_tool").$type<Record<string, number>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  referralCodeIndex: uniqueIndex("account_credits_referral_code_idx").on(table.referralCode),
  safeCredits: check("account_credits_safe_number", sql`${table.credits} between -9007199254740991 and 9007199254740991 and ${table.creditsLimit} between 0 and 9007199254740991`),
}));

export const redeemCodeOrdersTable = pgTable("redeem_code_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
  credits: bigint("credits", { mode: "number" }).notNull(),
  currency: text("currency").notNull(),
  address: text("address").notNull(),
  cryptoAmount: text("crypto_amount").notNull(),
  status: text("status").notNull().default("awaiting_payment"),
  referralRewardEligible: boolean("referral_reward_eligible").notNull().default(false),
  referralAncestors: jsonb("referral_ancestors").$type<string[]>(),
  txId: text("tx_id"),
  submittedTxId: text("submitted_tx_id"),
  codeHash: text("code_hash"),
  codeCiphertext: text("code_ciphertext"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
}, (table) => ({
  reference: uniqueIndex("redeem_code_orders_amount_idx").on(table.currency, table.cryptoAmount),
  transaction: uniqueIndex("redeem_code_orders_tx_idx").on(table.txId),
  code: uniqueIndex("redeem_code_orders_code_idx").on(table.codeHash),
  history: index("redeem_code_orders_buyer_history_idx").on(table.userId, table.createdAt, table.id),
}));

export const accountReferralsTable = pgTable("account_referrals", {
  referredUserId: text("referred_user_id").primaryKey(),
  inviterUserId: text("inviter_user_id").notNull(),
  awardedAt: timestamp("awarded_at", { withTimezone: true }).notNull().defaultNow(),
  firstPurchaseRewardedAt: timestamp("first_purchase_rewarded_at", { withTimezone: true }),
}, (table) => ({
  inviterIndex: uniqueIndex("account_referrals_inviter_referred_idx").on(table.inviterUserId, table.referredUserId),
}));

// Durable idempotency key for each paid purchase and beneficiary.
export const referralPurchaseRewardsTable = pgTable("referral_purchase_rewards", {
  paymentId: text("payment_id").notNull(),
  recipientUserId: text("recipient_user_id").notNull(),
  buyerUserId: text("buyer_user_id").notNull(),
  level: integer("level").notNull(),
  purchasedCredits: bigint("purchased_credits", { mode: "number" }).notNull(),
  credits: bigint("credits", { mode: "number" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  uniqueReward: uniqueIndex("referral_purchase_rewards_payment_recipient_idx").on(table.paymentId, table.recipientUserId),
  recipientIndex: index("referral_purchase_rewards_recipient_idx").on(table.recipientUserId),
}));

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type UserMemory = typeof userMemoriesTable.$inferSelect;
export type AccountActivity = typeof accountActivityTable.$inferSelect;
export type CreatedFile = typeof createdFilesTable.$inferSelect;
export type AccountPayment = typeof accountPaymentsTable.$inferSelect;
export type AccountSubscription = typeof accountSubscriptionsTable.$inferSelect;
export type AccountCredits = typeof accountCreditsTable.$inferSelect;
export type AccountReferral = typeof accountReferralsTable.$inferSelect;