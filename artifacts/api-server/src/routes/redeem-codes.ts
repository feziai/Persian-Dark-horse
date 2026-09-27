import type { IRouter } from "express";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { accountCreditsTable, db, redeemCodeOrdersTable as orders } from "@workspace/db";
import { getAuthenticatedUserId, requireAuth } from "../middlewares/auth";
import { assertRedeemEncryption, codeDigest, decryptRedeemCode, encryptRedeemCode, newRedeemCode, parseRedeemAmount, referenceAmount } from "../lib/redeem-code-security";
import { claimPaymentConsumption } from "../lib/payment-consumption";
import { awardReferralPurchaseInTransaction, captureGiftReferralAtIssuance } from "../lib/referral-rewards";

type Order = typeof orders.$inferSelect;
type Currency = { id: string; label: string; ticker: string; network: string; address: string };
type Verification = { verified: boolean; message: string };
type Options = {
  currencies: readonly Currency[];
  verify: (order: Order, txId: string) => Promise<Verification>;
  withWallet: (userId: string, action: () => Promise<{ creditsAdded: number; credits: number; creditsLimit: number }>) => Promise<{ creditsAdded: number; credits: number; creditsLimit: number }>;
  onReferralReward?: (paymentId: string) => Promise<void>;
};

class PurchaseError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function registerRedeemCodeRoutes(router: IRouter, options: Options) {
  const currencies = options.currencies.filter((currency) => currency.id === "usdt-bep20");
  function present(order: Order) {
    const currency = currencies.find((item) => item.id === order.currency)!;
    return {
      id: order.id, amountUsd: order.amountCents / 100, credits: order.credits,
      currency: order.currency, currencyLabel: currency.label, network: currency.network,
      address: order.address, cryptoAmount: order.cryptoAmount, status: order.status,
      code: order.status === "issued" && order.codeCiphertext ? decryptRedeemCode(order.codeCiphertext, order.id) : null,
      createdAt: order.createdAt.toISOString(), redeemedAt: order.redeemedAt?.toISOString() ?? null, txId: order.txId ?? order.submittedTxId,
    };
  }
  router.use("/payments/redeem-codes", requireAuth, (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  // Errors never include request bodies, codes, ciphertext, or RPC payloads.
  router.get("/payments/redeem-codes", async (req, res) => {
    try {
      const before = typeof req.query.before === "string" ? req.query.before : null;
      if (before && !/^[0-9a-f-]{36}$/i.test(before)) throw new PurchaseError(400, "Invalid history cursor.");
      const history = await db.select().from(orders).where(and(
        eq(orders.userId, getAuthenticatedUserId(req)!),
        before ? sql`(${orders.createdAt}, ${orders.id}) < (select created_at, id from redeem_code_orders where id = ${before} and user_id = ${getAuthenticatedUserId(req)!})` : undefined,
      )).orderBy(desc(orders.createdAt), desc(orders.id)).limit(100);
      res.json({ orders: history.map(present), currencies, minAmountUsd: 10, creditsPerDollar: 800,
        nextCursor: history.length === 100 ? history[99].id : null });
    } catch (error) { res.status(error instanceof PurchaseError ? error.status : 503).json({ error: error instanceof PurchaseError ? error.message : "Purchase history is temporarily unavailable." }); }
  });
  router.post("/payments/redeem-codes/orders", async (req, res) => {
    try {
      let amount;
      try { amount = parseRedeemAmount(req.body?.amountUsd); } catch (error) { throw new PurchaseError(400, (error as Error).message); }
      const currency = currencies.find((item) => item.id === req.body?.currency);
      if (!currency) throw new PurchaseError(400, "Select an available automatically verified stablecoin.");
      assertRedeemEncryption();
      for (let attempt = 0; attempt < 100; attempt++) {
        const [order] = await db.insert(orders).values({
          id: randomUUID(), userId: getAuthenticatedUserId(req)!, amountCents: amount.cents, credits: amount.credits,
          currency: currency.id, address: currency.address, cryptoAmount: referenceAmount(amount.cents, attempt >= 50),
        }).onConflictDoNothing().returning();
        if (order) { res.status(201).json({ order: present(order) }); return; }
      }
      throw new PurchaseError(503, "Unable to allocate a unique payment reference; retry.");
    } catch (error) { res.status(error instanceof PurchaseError ? error.status : 503).json({ error: error instanceof PurchaseError ? error.message : "Purchasing is temporarily unavailable." }); }
  });
  router.post("/payments/redeem-codes/orders/:id/verify", async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req)!;
      const id = String(req.params.id);
      const txId = typeof req.body?.txId === "string" ? req.body.txId.trim().toLowerCase() : "";
      if (!/^0x[0-9a-f]{64}$/.test(txId)) throw new PurchaseError(400, "Enter a valid transaction hash.");
      const [initial] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId)));
      if (!initial) throw new PurchaseError(404, "Order not found.");
      if (initial.status === "issued" || initial.status === "redeemed") {
        if (initial.txId !== txId) throw new PurchaseError(409, "This order already has a verified transaction.");
        if (initial.referralRewardEligible) {
          try { await options.onReferralReward?.(`redeem-code:${id}`); }
          catch { throw new PurchaseError(503, "Payment succeeded, but referral wallet refresh failed. Refresh purchase history."); }
        }
        res.json({ order: present(initial) }); return;
      }
      assertRedeemEncryption();
      let verification: Verification;
      try { verification = await options.verify(initial, txId); }
      catch { verification = { verified: false, message: "The blockchain verification service is unavailable. Please retry." }; }
      const order = await db.transaction(async (tx) => {
        const [locked] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.userId, userId))).for("update");
        if (locked.status === "issued" || locked.status === "redeemed") {
          if (locked.txId !== txId) throw new PurchaseError(409, "This order already has a verified transaction.");
          return locked;
        }
        if (!verification.verified) {
          const [pending] = await tx.update(orders).set({ status: "pending", submittedTxId: txId }).where(eq(orders.id, id)).returning();
          return pending;
        }
        if (!await claimPaymentConsumption(tx, txId, `redeem-code:${id}`)) {
          throw new PurchaseError(409, "This transaction has already been consumed.");
        }
        const ancestors = await captureGiftReferralAtIssuance(tx, userId);
        const code = newRedeemCode();
        const [issued] = await tx.update(orders).set({
          status: "issued", txId, submittedTxId: null, codeHash: codeDigest(code), codeCiphertext: encryptRedeemCode(code, id),
          referralRewardEligible: true, referralAncestors: ancestors,
        })
          .where(eq(orders.id, id)).returning();
        await awardReferralPurchaseInTransaction(tx, `redeem-code:${id}`, userId);
        return issued;
      });
      if (order.referralRewardEligible) {
        try { await options.onReferralReward?.(`redeem-code:${id}`); }
        catch { throw new PurchaseError(503, "Payment succeeded, but referral wallet refresh failed. Refresh purchase history."); }
      }
      res.json({ order: { ...present(order), verificationMessage: verification.message } });
    } catch (error) { res.status(error instanceof PurchaseError ? error.status : 503).json({ error: error instanceof PurchaseError ? error.message : "Payment verification is temporarily unavailable." }); }
  });
  router.post("/payments/redeem-codes/redeem", async (req, res) => {
    try {
      const userId = getAuthenticatedUserId(req)!;
      const code = typeof req.body?.code === "string" ? req.body.code.trim().toUpperCase() : "";
      if (!/^FEZI-[0-9A-F]{48}$/.test(code)) throw new PurchaseError(400, "Invalid redeem code.");
      const result = await options.withWallet(userId, () => db.transaction(async (tx) => {
        const [order] = await tx.select().from(orders).where(and(eq(orders.codeHash, codeDigest(code)), eq(orders.userId, userId))).for("update");
        if (!order) throw new PurchaseError(404, "Redeem code not found.");
        if (order.status !== "issued") throw new PurchaseError(409, "This code has already been redeemed.");
        const [wallet] = await tx.update(accountCreditsTable).set({
          credits: sql`${accountCreditsTable.credits} + ${order.credits}`,
          creditsLimit: sql`${accountCreditsTable.creditsLimit} + ${order.credits}`,
          updatedAt: new Date(),
        }).where(and(eq(accountCreditsTable.userId, userId),
          sql`${accountCreditsTable.credits} <= ${Number.MAX_SAFE_INTEGER - order.credits}`,
          sql`${accountCreditsTable.creditsLimit} <= ${Number.MAX_SAFE_INTEGER - order.credits}`,
        )).returning();
        if (!wallet) throw new PurchaseError(409, "Wallet credit capacity exceeded; code remains unredeemed.");
        await tx.update(orders).set({ status: "redeemed", redeemedAt: new Date(), codeCiphertext: null }).where(eq(orders.id, order.id));
        return { creditsAdded: order.credits, credits: wallet.credits, creditsLimit: wallet.creditsLimit };
      }));
      res.json(result);
    } catch (error) { res.status(error instanceof PurchaseError ? error.status : 503).json({ error: error instanceof PurchaseError ? error.message : "Redemption is temporarily unavailable. Your code has not been spent unless redemption completed." }); }
  });
}