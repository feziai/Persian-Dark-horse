import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { accountPaymentsTable, db, paymentConsumptionsTable, siteApiCreditsTable } from "@workspace/db";
import { canonicalPaymentHash, claimPaymentConsumption } from "./payment-consumption";

export const siteTopupPlanPrefix = "api:site:site:";

export async function listRecoverableSiteTopups() {
  return db.select().from(accountPaymentsTable)
    .where(and(sql`${accountPaymentsTable.planId} like ${`${siteTopupPlanPrefix}%`}`,
      inArray(accountPaymentsTable.status, ["pending", "processing"])))
    .orderBy(desc(accountPaymentsTable.createdAt));
}

/** The transaction hash, approval, and wallet credit commit as one unit.
 * A claim left in processing by older deployments may safely finish once. */
export async function activateSiteApiTopup(payment: { id: string; ownerId: string; txId: string }, credits: number) {
  if (!Number.isSafeInteger(credits) || credits <= 0) throw new Error("Invalid Site API top-up.");
  return db.transaction(async (tx) => {
    const claimed = await claimPaymentConsumption(tx, payment.txId, `legacy:${payment.id}`, payment.id);
    if (!claimed) {
      const [previous] = await tx.select({ consumerId: paymentConsumptionsTable.consumerId })
        .from(paymentConsumptionsTable)
        .where(eq(paymentConsumptionsTable.txId, canonicalPaymentHash(payment.txId))).limit(1);
      const [processing] = await tx.select({ status: accountPaymentsTable.status }).from(accountPaymentsTable)
        .where(and(eq(accountPaymentsTable.id, payment.id), eq(accountPaymentsTable.userId, payment.ownerId))).limit(1);
      if (previous?.consumerId !== `legacy:${payment.id}` || processing?.status !== "processing") return false;
    }
    const [approved] = await tx.update(accountPaymentsTable).set({ status: "approved" })
      .where(and(eq(accountPaymentsTable.id, payment.id), eq(accountPaymentsTable.userId, payment.ownerId),
        eq(accountPaymentsTable.status, "processing")))
      .returning({ id: accountPaymentsTable.id });
    if (!approved) return false;
    await tx.insert(siteApiCreditsTable).values({ ownerId: payment.ownerId, credits })
      .onConflictDoUpdate({
        target: siteApiCreditsTable.ownerId,
        set: { credits: sql`${siteApiCreditsTable.credits} + ${credits}` },
      });
    return true;
  });
}