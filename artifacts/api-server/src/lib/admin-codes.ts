import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { accountCreditsTable, accountSubscriptionsTable, adminCodeRedemptionsTable, adminCodesTable, db } from "@workspace/db";
import { assertRedeemEncryption, codeDigest, decryptRedeemCode, encryptRedeemCode } from "./redeem-code-security";

export class AdminCodeError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

const monthlyPlans = new Set(["swift-rider", "horse-runner", "lone-rider"]);
export const normalizeAdminCode = (value: string) => value.trim().toUpperCase();

function publicCode(row: typeof adminCodesTable.$inferSelect) {
  return {
    id: row.id,
    code: decryptRedeemCode(row.codeCiphertext, row.id),
    kind: row.kind,
    value: row.value,
    planId: row.planId,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listAdminCodes() {
  const rows = await db.select().from(adminCodesTable).orderBy(desc(adminCodesTable.createdAt));
  return rows.map(publicCode);
}

export async function createAdminCode(input: Record<string, unknown>) {
  const kind = input.kind;
  const value = input.value;
  const maxUses = input.maxUses;
  const planId = input.planId;
  const rawCode = input.code;
  if (kind !== "discount" && kind !== "credits" && kind !== "membership") throw new AdminCodeError("Choose a code benefit.");
  if (!Number.isSafeInteger(maxUses) || (maxUses as number) < 1 || (maxUses as number) > 1_000_000) throw new AdminCodeError("Maximum users must be between 1 and 1,000,000.");
  if (!Number.isSafeInteger(value) || (value as number) < 1 ||
    (kind === "discount" && (value as number) > 99) ||
    (kind === "credits" && (value as number) > 1_000_000_000) ||
    (kind === "membership" && (value as number) > 365)) throw new AdminCodeError("Enter a valid discount percentage, credit amount, or membership duration in days.");
  if (kind === "membership" && !monthlyPlans.has(String(planId))) throw new AdminCodeError("Select a monthly membership plan.");
  if (kind !== "membership" && planId) throw new AdminCodeError("Only membership codes can select a plan.");
  if (rawCode != null && typeof rawCode !== "string") throw new AdminCodeError("Enter a valid code.");
  const code = rawCode && String(rawCode).trim()
    ? normalizeAdminCode(String(rawCode))
    : `FEZI-${randomBytes(7).toString("hex").toUpperCase()}`;
  if (!/^[A-Z0-9_-]{1,20}$/.test(code)) throw new AdminCodeError("Codes must be 1–20 letters, numbers, dashes, or underscores.");
  if (code === "FEZI10" || code === "FEZI20") throw new AdminCodeError("This code is reserved for an existing promotion.", 409);
  if (/^FEZI-[0-9A-F]{48}$/.test(code)) throw new AdminCodeError("This code format is reserved for purchased redeem codes.", 409);
  assertRedeemEncryption();
  const id = randomUUID();
  try {
    const [created] = await db.insert(adminCodesTable).values({
      id, codeHash: codeDigest(code), codeCiphertext: encryptRedeemCode(code, id),
      kind, value: value as number, planId: kind === "membership" ? String(planId) : null, maxUses: maxUses as number,
    }).returning();
    return publicCode(created);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") throw new AdminCodeError("This code already exists.", 409);
    throw error;
  }
}

export async function setAdminCodeActive(id: string, active: unknown) {
  if (typeof active !== "boolean") throw new AdminCodeError("Active must be true or false.");
  const [updated] = await db.update(adminCodesTable).set({ active }).where(eq(adminCodesTable.id, id)).returning();
  if (!updated) throw new AdminCodeError("Code not found.", 404);
  return publicCode(updated);
}

export async function getClaimedDiscount(code: string, userId: string | undefined) {
  const normalized = normalizeAdminCode(code);
  if (!normalized || !userId) return 0;
  const [claim] = await db.select({ value: adminCodesTable.value })
    .from(adminCodeRedemptionsTable)
    .innerJoin(adminCodesTable, eq(adminCodeRedemptionsTable.codeId, adminCodesTable.id))
    .where(and(eq(adminCodesTable.codeHash, codeDigest(normalized)), eq(adminCodesTable.kind, "discount"),
      eq(adminCodesTable.active, true), eq(adminCodeRedemptionsTable.userId, userId))).limit(1);
  return claim?.value ?? 0;
}

export async function redeemAdminCode(code: string, userId: string, allowedKinds: readonly string[] = ["discount", "credits", "membership"], planCredits: Record<string, number> = {}) {
  const normalized = normalizeAdminCode(code);
  // Older admin-issued codes may exceed the new creation limit; keep them redeemable.
  if (!/^[A-Z0-9_-]{1,64}$/.test(normalized)) throw new AdminCodeError("This code is not valid.", 404);
  const now = new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(adminCodesTable).where(eq(adminCodesTable.codeHash, codeDigest(normalized))).limit(1);
    if (!row) throw new AdminCodeError("This code is not valid.", 404);
    await tx.execute(sql`select id from admin_codes where id = ${row.id} for update`);
    const [locked] = await tx.select().from(adminCodesTable).where(eq(adminCodesTable.id, row.id)).limit(1);
    if (!locked || !allowedKinds.includes(locked.kind)) throw new AdminCodeError("This code must be used in the other redemption field.", 400);
    const [previous] = await tx.select({ id: adminCodeRedemptionsTable.id }).from(adminCodeRedemptionsTable)
      .where(and(eq(adminCodeRedemptionsTable.codeId, row.id), eq(adminCodeRedemptionsTable.userId, userId))).limit(1);
    if (previous) throw new AdminCodeError("You have already used this code.", 409);
    if (!locked.active || locked.usedCount >= locked.maxUses) throw new AdminCodeError("This code is no longer available.", 409);

    let credits: number | undefined;
    let creditsLimit: number | undefined;
    let expiresAt: Date | undefined;
    if (locked.kind === "credits") {
      await tx.execute(sql`select user_id from account_credits where user_id = ${userId} for update`);
      const [wallet] = await tx.select().from(accountCreditsTable).where(eq(accountCreditsTable.userId, userId)).limit(1);
      if (!wallet || wallet.credits > Number.MAX_SAFE_INTEGER - locked.value || wallet.creditsLimit > Number.MAX_SAFE_INTEGER - locked.value) {
        throw new AdminCodeError("The credit wallet cannot accept this code.", 409);
      }
      const [updated] = await tx.update(accountCreditsTable).set({
        credits: sql`${accountCreditsTable.credits} + ${locked.value}`,
        creditsLimit: sql`${accountCreditsTable.creditsLimit} + ${locked.value}`,
        updatedAt: now,
      }).where(eq(accountCreditsTable.userId, userId)).returning();
      credits = updated.credits;
      creditsLimit = updated.creditsLimit;
    } else if (locked.kind === "membership") {
      if (!locked.planId || !monthlyPlans.has(locked.planId)) throw new AdminCodeError("The membership plan is unavailable.", 409);
      const monthlyCredits = planCredits[locked.planId];
      if (!Number.isSafeInteger(monthlyCredits) || monthlyCredits <= 0) throw new AdminCodeError("The membership benefits are unavailable.", 409);
      await tx.execute(sql`select user_id from account_subscriptions where user_id = ${userId} for update`);
      const [current] = await tx.select().from(accountSubscriptionsTable).where(eq(accountSubscriptionsTable.userId, userId)).limit(1);
      if (current?.status === "active" && (!current.expiresAt || current.expiresAt > now) && current.planId !== locked.planId) {
        throw new AdminCodeError("Your current membership uses another plan. Redeem this code after it expires.", 409);
      }
      if (current?.status === "active" && !current.expiresAt) throw new AdminCodeError("Lifetime membership cannot be extended with this code.", 409);
      const from = current?.status === "active" && current.expiresAt && current.expiresAt > now ? current.expiresAt : now;
      expiresAt = new Date(from.getTime() + locked.value * 86_400_000);
      await tx.insert(accountSubscriptionsTable).values({
        userId, planId: locked.planId, status: "active", activatedAt: now, expiresAt, paymentId: null, updatedAt: now,
      }).onConflictDoUpdate({
        target: accountSubscriptionsTable.userId,
        set: { planId: locked.planId, status: "active", activatedAt: now, expiresAt, paymentId: null, updatedAt: now },
      });
      const grant = Math.ceil(monthlyCredits * locked.value / 30);
      await tx.execute(sql`select user_id from account_credits where user_id = ${userId} for update`);
      const [wallet] = await tx.select().from(accountCreditsTable).where(eq(accountCreditsTable.userId, userId)).limit(1);
      if (!wallet || wallet.credits > Number.MAX_SAFE_INTEGER - grant || wallet.creditsLimit > Number.MAX_SAFE_INTEGER - grant) {
        throw new AdminCodeError("The credit wallet cannot accept this membership.", 409);
      }
      const [updated] = await tx.update(accountCreditsTable).set({
        credits: sql`${accountCreditsTable.credits} + ${grant}`,
        creditsLimit: sql`${accountCreditsTable.creditsLimit} + ${grant}`,
        updatedAt: now,
      }).where(eq(accountCreditsTable.userId, userId)).returning();
      credits = updated.credits;
      creditsLimit = updated.creditsLimit;
    }
    await tx.insert(adminCodeRedemptionsTable).values({ id: randomUUID(), codeId: locked.id, userId });
    await tx.update(adminCodesTable).set({ usedCount: sql`${adminCodesTable.usedCount} + 1` }).where(eq(adminCodesTable.id, locked.id));
    return { kind: locked.kind, value: locked.value, planId: locked.planId, credits, creditsLimit, expiresAt: expiresAt?.toISOString() };
  });
}