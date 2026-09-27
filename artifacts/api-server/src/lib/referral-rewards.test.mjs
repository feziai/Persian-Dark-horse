import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { build } from "esbuild";

if (process.env.NODE_ENV === "production") throw new Error("Database regression tests must not run in production.");
const outfile = new URL("../../.local/referral-reward-tests.mjs", import.meta.url);
await build({
  stdin: {
    contents: `export * from "./lib/referral-rewards"; export { db, pool, accountCreditsTable, accountPaymentsTable, accountReferralsTable, redeemCodeOrdersTable, referralPurchaseRewardsTable } from "@workspace/db"; export { eq, inArray } from "drizzle-orm";`,
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  outfile: outfile.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  banner: { js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);" },
});
const m = await import(outfile.href);
after(async () => { await m.pool.end(); });

test("welcome rewards are atomic, repeat claims do not mint, and reverse claims cannot create cycles", async () => {
  const users = Array.from({ length: 4 }, () => `test-referral-${randomUUID()}`);
  const [root, parent, buyer, other] = users;
  const paymentId = `test-referral-payment-${randomUUID()}`;
  const secondPaymentId = `test-referral-payment-${randomUUID()}`;
  const legacyPaymentId = `test-referral-payment-${randomUUID()}`;
  const giftOrderId = randomUUID();
  const wallet = async (id) => (await m.db.select().from(m.accountCreditsTable).where(m.eq(m.accountCreditsTable.userId, id)))[0];
  try {
    for (const id of users) await m.db.insert(m.accountCreditsTable).values({
      userId: id, referralCode: id, usageDay: new Date().toISOString().slice(0, 10),
    });
    assert.equal(await m.claimReferral(parent, root), "awarded");
    const competing = await Promise.all([m.claimReferral(buyer, parent), m.claimReferral(buyer, other)]);
    assert.equal(competing.filter(result => result === "awarded").length, 1);
    assert.equal(competing.filter(result => result === "other_inviter").length, 1);
    assert.equal(await m.claimReferral(parent, root), "already_claimed");
    assert.equal((await wallet(root)).credits, 1500);
    assert.equal((await wallet(parent)).credits, competing[0] === "awarded" ? 2000 : 1500);
    assert.equal((await wallet(buyer)).credits, 1500);
    assert.equal((await wallet(other)).credits, competing[1] === "awarded" ? 1500 : 1000);

    // Use a buyer with a known two-level lineage for the purchase check.
    const directBuyer = `test-referral-${randomUUID()}`;
    users.push(directBuyer);
    await m.db.insert(m.accountCreditsTable).values({
      userId: directBuyer, referralCode: directBuyer, usageDay: new Date().toISOString().slice(0, 10),
    });
    assert.equal(await m.claimReferral(directBuyer, parent), "awarded");
    assert.equal(await m.claimReferral(root, directBuyer), "cycle");
    await m.db.insert(m.accountPaymentsTable).values({
      id: legacyPaymentId, userId: directBuyer, planId: "credits:credits-starter",
      currencyId: "test", txId: `test-${randomUUID()}`, status: "approved",
    });
    await assert.rejects(() => m.awardReferralPurchase(legacyPaymentId, directBuyer), /eligible/);
    await m.db.insert(m.accountPaymentsTable).values({
      id: paymentId, userId: directBuyer, planId: "credits:credits-starter",
      currencyId: "test", txId: `test-${randomUUID()}`, status: "pending",
    });
    // Cycle protection applies while freezing the ancestry at approval.
    await m.db.insert(m.accountReferralsTable).values({ referredUserId: root, inviterUserId: directBuyer });
    await assert.rejects(() => m.approveReferralPayment(paymentId, directBuyer, 10000), /cycle/i);
    assert.equal((await m.db.select().from(m.referralPurchaseRewardsTable)
      .where(m.eq(m.referralPurchaseRewardsTable.paymentId, paymentId))).length, 0);
    await m.db.delete(m.accountReferralsTable).where(m.eq(m.accountReferralsTable.referredUserId, root));
    await m.approveReferralPayment(paymentId, directBuyer, 10000);
    const [frozen] = await m.db.select().from(m.accountPaymentsTable).where(m.eq(m.accountPaymentsTable.id, paymentId));
    assert.equal(frozen.referralPurchasedCredits, 10000);
    assert.deepEqual(frozen.referralAncestors, [parent, root]);
    // Product catalog changes after approval must not change the payout basis.
    await m.db.update(m.accountPaymentsTable).set({ planId: "retired-product" })
      .where(m.eq(m.accountPaymentsTable.id, paymentId));
    const upstream = `test-referral-${randomUUID()}`;
    users.push(upstream);
    await m.db.insert(m.accountCreditsTable).values({
      userId: upstream, referralCode: upstream, usageDay: new Date().toISOString().slice(0, 10),
    });
    assert.equal(await m.claimReferral(root, upstream), "awarded");
    const upstreamBefore = (await wallet(upstream)).credits;
    const buyerBefore = (await wallet(directBuyer)).credits;
    const parentBefore = (await wallet(parent)).credits;
    const rootBefore = (await wallet(root)).credits;
    const results = await Promise.all([
      m.awardReferralPurchase(paymentId, directBuyer),
      m.awardReferralPurchase(paymentId, directBuyer),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
    assert.equal(await m.awardReferralPurchase(paymentId, directBuyer), false);
    assert.equal((await wallet(upstream)).credits, upstreamBefore);
    assert.equal((await wallet(directBuyer)).credits, buyerBefore);
    assert.equal((await wallet(parent)).credits, parentBefore + 2000);
    assert.equal((await wallet(root)).credits, rootBefore + 200);

    await m.db.insert(m.accountPaymentsTable).values({
      id: secondPaymentId, userId: directBuyer, planId: "credits:credits-builder",
      currencyId: "test", txId: `test-${randomUUID()}`, status: "pending",
    });
    await m.approveReferralPayment(secondPaymentId, directBuyer, 25000);
    assert.equal(await m.awardReferralPurchase(secondPaymentId, directBuyer), true);
    assert.equal((await wallet(parent)).credits, parentBefore + 7000);
    assert.equal((await wallet(root)).credits, rootBefore + 700);
    assert.equal((await wallet(upstream)).credits, upstreamBefore + 500);
    assert.equal((await wallet(directBuyer)).credits, buyerBefore);

    // A gift pays only at issuance; the purchaser gets no gift-face credits.
    await m.db.insert(m.redeemCodeOrdersTable).values({
      id: giftOrderId, userId: directBuyer, amountCents: 1000, credits: 8000,
      currency: "usdt-bep20", address: "test", cryptoAmount: `${randomUUID()}-test`,
      status: "awaiting_payment",
    });
    await m.db.transaction(async tx => {
      const giftAncestors = await m.captureGiftReferralAtIssuance(tx, directBuyer);
      await tx.update(m.redeemCodeOrdersTable).set({
        status: "issued", referralRewardEligible: true, referralAncestors: giftAncestors,
      }).where(m.eq(m.redeemCodeOrdersTable.id, giftOrderId));
      await m.awardReferralPurchaseInTransaction(tx, `redeem-code:${giftOrderId}`, directBuyer);
    });
    assert.equal(await m.awardReferralPurchase(`redeem-code:${giftOrderId}`, directBuyer), false);
    assert.equal((await wallet(directBuyer)).credits, buyerBefore);
    assert.equal((await wallet(parent)).credits, parentBefore + 8600);
    assert.equal((await wallet(root)).credits, rootBefore + 860);
    assert.equal((await wallet(upstream)).credits, upstreamBefore + 660);
    const dashboard = await m.referralDashboard(root);
    assert.equal(dashboard.directRate, 0.2);
    assert.equal(dashboard.networkRate, 0.02);
    assert.equal(dashboard.directCount, 1);
    assert.equal(dashboard.purchaseEarnedCredits, 860);
    assert.equal(dashboard.signupEarnedCredits, 500);
    assert.equal(dashboard.totalEarnedCredits, 1360);
  } finally {
    await m.db.delete(m.referralPurchaseRewardsTable).where(m.inArray(m.referralPurchaseRewardsTable.buyerUserId, users));
    await m.db.delete(m.redeemCodeOrdersTable).where(m.eq(m.redeemCodeOrdersTable.id, giftOrderId));
    await m.db.delete(m.accountPaymentsTable).where(m.inArray(m.accountPaymentsTable.id, [paymentId, secondPaymentId, legacyPaymentId]));
    await m.db.delete(m.accountReferralsTable).where(m.inArray(m.accountReferralsTable.referredUserId, users));
    await m.db.delete(m.accountCreditsTable).where(m.inArray(m.accountCreditsTable.userId, users));
  }
});