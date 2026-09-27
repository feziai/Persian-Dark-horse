import { and, eq, inArray, sql } from "drizzle-orm";
import { accountCreditsTable, accountPaymentsTable, accountReferralsTable, db, redeemCodeOrdersTable, referralPurchaseRewardsTable } from "@workspace/db";

export const REFERRAL_SIGNUP_CREDITS = 500;
export const REFERRAL_DIRECT_RATE = 0.2;
export const REFERRAL_NETWORK_RATE = 0.02;

// Serialize graph changes with traversal so two concurrent reverse claims cannot
// create a cycle. All referral graph mutations must take this lock.
type ReferralTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function lockReferralGraph(tx: ReferralTx) {
  await tx.execute(sql`select pg_advisory_xact_lock(722103, 501)`);
}

async function ancestorsAtApproval(tx: ReferralTx, buyerUserId: string) {
  await lockReferralGraph(tx);
  const seen = new Set([buyerUserId]);
  const ancestors: string[] = [];
  let cursor = buyerUserId;
  while (true) {
    const [parent] = await tx.select({ inviterUserId: accountReferralsTable.inviterUserId })
      .from(accountReferralsTable).where(eq(accountReferralsTable.referredUserId, cursor)).limit(1);
    if (!parent) return ancestors;
    cursor = parent.inviterUserId;
    if (seen.has(cursor)) throw new Error("Referral cycle detected; payment cannot be finalized.");
    seen.add(cursor);
    ancestors.push(cursor);
  }
}

// Capture both the granted product quantity and ancestry atomically with the
// payment approval. Neither mutable product pricing nor later referrals can
// alter a retry. Never mark pre-migration approvals eligible.
export async function approveReferralPayment(paymentId: string, buyerUserId: string, purchasedCredits: number) {
  if (!Number.isSafeInteger(purchasedCredits) || purchasedCredits <= 0) throw new Error("Invalid purchased credit quantity.");
  return db.transaction(async (tx) => {
    const ancestors = await ancestorsAtApproval(tx, buyerUserId);
    const [payment] = await tx.update(accountPaymentsTable).set({
      status: "approved", referralRewardEligible: true, referralPurchasedCredits: purchasedCredits,
      referralAncestors: ancestors,
    }).where(and(eq(accountPaymentsTable.id, paymentId), eq(accountPaymentsTable.userId, buyerUserId),
      inArray(accountPaymentsTable.status, ["pending", "processing"]),
      eq(accountPaymentsTable.referralRewardEligible, false))).returning({ id: accountPaymentsTable.id });
    if (!payment) throw new Error("Payment was not pending or was already approved.");
  });
}

export async function captureGiftReferralAtIssuance(tx: ReferralTx, buyerUserId: string) {
  return ancestorsAtApproval(tx, buyerUserId);
}

export async function claimReferral(referredUserId: string, inviterUserId: string) {
  return db.transaction(async (tx) => {
    await lockReferralGraph(tx);
    const [existing] = await tx.select().from(accountReferralsTable)
      .where(eq(accountReferralsTable.referredUserId, referredUserId)).limit(1);
    if (existing) return existing.inviterUserId === inviterUserId ? "already_claimed" : "other_inviter";

    const visited = new Set([referredUserId]);
    let cursor: string | undefined = inviterUserId;
    while (cursor) {
      if (visited.has(cursor)) return "cycle";
      visited.add(cursor);
      const [parent] = await tx.select({ inviterUserId: accountReferralsTable.inviterUserId })
        .from(accountReferralsTable).where(eq(accountReferralsTable.referredUserId, cursor)).limit(1);
      cursor = parent?.inviterUserId;
    }
    await tx.insert(accountReferralsTable).values({ referredUserId, inviterUserId });
    for (const userId of [referredUserId, inviterUserId]) {
      const [wallet] = await tx.update(accountCreditsTable).set({
        credits: sql`${accountCreditsTable.credits} + ${REFERRAL_SIGNUP_CREDITS}`,
        creditsLimit: sql`${accountCreditsTable.creditsLimit} + ${REFERRAL_SIGNUP_CREDITS}`,
        updatedAt: new Date(),
      }).where(eq(accountCreditsTable.userId, userId)).returning({ userId: accountCreditsTable.userId });
      if (!wallet) throw new Error(`Referral reward wallet missing for ${userId}`);
    }
    return "awarded";
  });
}

// For gift orders use redeem-code:<order ID>. This credits the purchaser's
// inviter at paid issuance; code redemption does not issue any referral reward.
export async function awardReferralPurchase(paymentId: string, buyerUserId: string) {
  if (!paymentId) throw new Error("Payment ID is required.");
  return db.transaction((tx) => awardReferralPurchaseInTransaction(tx, paymentId, buyerUserId));
}

export async function awardReferralPurchaseInTransaction(tx: ReferralTx, paymentId: string, buyerUserId: string) {
    await lockReferralGraph(tx);
    const isGift = paymentId.startsWith("redeem-code:");
    const orderId = paymentId.slice("redeem-code:".length);
    const [payment] = isGift
      ? await tx.select({
        userId: redeemCodeOrdersTable.userId, status: redeemCodeOrdersTable.status,
        eligible: redeemCodeOrdersTable.referralRewardEligible,
        purchasedCredits: redeemCodeOrdersTable.credits, ancestors: redeemCodeOrdersTable.referralAncestors,
      }).from(redeemCodeOrdersTable).where(eq(redeemCodeOrdersTable.id, orderId)).limit(1)
      : await tx.select({
        userId: accountPaymentsTable.userId, status: accountPaymentsTable.status,
        eligible: accountPaymentsTable.referralRewardEligible,
        purchasedCredits: accountPaymentsTable.referralPurchasedCredits, ancestors: accountPaymentsTable.referralAncestors,
      }).from(accountPaymentsTable).where(eq(accountPaymentsTable.id, paymentId)).limit(1);
    if (!payment || payment.userId !== buyerUserId || !(isGift ? ["issued", "redeemed"].includes(payment.status) : payment.status === "approved")
      || !payment.eligible || !Number.isSafeInteger(payment.purchasedCredits) || !payment.purchasedCredits
      || !Array.isArray(payment.ancestors)) {
      throw new Error("Referral reward requires a newly approved eligible payment owned by the buyer.");
    }
    const visited = new Set([buyerUserId]);
    let level = 0;
    let awarded = 0;
    for (const cursor of payment.ancestors) {
      if (typeof cursor !== "string" || !cursor) throw new Error("Invalid persisted referral snapshot.");
      if (visited.has(cursor)) throw new Error("Referral cycle detected; no purchase rewards were issued.");
      visited.add(cursor);
      level++;
      // Integer arithmetic avoids floating-point rounding near wallet limits.
      const credits = Number(BigInt(payment.purchasedCredits) * (level === 1 ? 20n : 2n) / 100n);
      if (!credits) continue;
      const [inserted] = await tx.insert(referralPurchaseRewardsTable).values({
        paymentId, recipientUserId: cursor, buyerUserId, level, purchasedCredits: payment.purchasedCredits, credits,
      }).onConflictDoNothing().returning({ recipientUserId: referralPurchaseRewardsTable.recipientUserId });
      if (!inserted) continue;
      const [wallet] = await tx.update(accountCreditsTable).set({
        credits: sql`${accountCreditsTable.credits} + ${credits}`,
        creditsLimit: sql`${accountCreditsTable.creditsLimit} + ${credits}`,
        updatedAt: new Date(),
      }).where(eq(accountCreditsTable.userId, cursor)).returning({ userId: accountCreditsTable.userId });
      if (!wallet) throw new Error(`Referral reward wallet missing for ${cursor}`);
      awarded++;
    }
    return awarded > 0;
}

export async function referralDashboard(userId: string) {
  const [tree, rewards] = await Promise.all([
    db.execute<{ referred_user_id: string; level: number; month: string; first_purchase_rewarded_at: Date | null }>(sql`
      with recursive referral_tree as (
        select referred_user_id, inviter_user_id, awarded_at, first_purchase_rewarded_at,
          1 as level, array[${userId}::text, referred_user_id] as path
        from account_referrals where inviter_user_id = ${userId} and referred_user_id <> ${userId}
        union all
        select r.referred_user_id, r.inviter_user_id, r.awarded_at, r.first_purchase_rewarded_at,
          t.level + 1, t.path || r.referred_user_id
        from account_referrals r join referral_tree t on r.inviter_user_id = t.referred_user_id
        where not r.referred_user_id = any(t.path)
      )
      select referred_user_id, level, to_char(awarded_at at time zone 'UTC', 'YYYY-MM') as month,
        first_purchase_rewarded_at from referral_tree
    `),
    db.select({ credits: referralPurchaseRewardsTable.credits })
      .from(referralPurchaseRewardsTable).where(eq(referralPurchaseRewardsTable.recipientUserId, userId)),
  ]);
  const seen = new Set<string>();
  const months = new Map<string, { month: string; direct: number; network: number }>();
  let directCount = 0;
  let networkCount = 0;
  let signupEarnedCredits = 0;
  let historicPurchaseCredits = 0;
  for (const row of tree.rows) {
      if (seen.has(row.referred_user_id)) continue;
      seen.add(row.referred_user_id);
      if (row.level === 1) {
        directCount++;
        signupEarnedCredits += REFERRAL_SIGNUP_CREDITS;
        // Historical one-time bonuses are preserved, not backfilled into the new ledger.
        if (row.first_purchase_rewarded_at) historicPurchaseCredits += 1000;
      } else networkCount++;
      const month = row.month;
      const bucket = months.get(month) ?? { month, direct: 0, network: 0 };
      if (row.level === 1) bucket.direct++;
      else bucket.network++;
      months.set(month, bucket);
  }
  const purchaseEarnedCredits = historicPurchaseCredits + rewards.reduce((total, row) => total + row.credits, 0);
  return {
    reward: REFERRAL_SIGNUP_CREDITS, directRate: REFERRAL_DIRECT_RATE, networkRate: REFERRAL_NETWORK_RATE,
    directCount, networkCount, signupEarnedCredits, purchaseEarnedCredits,
    totalEarnedCredits: signupEarnedCredits + purchaseEarnedCredits,
    joinedByMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}