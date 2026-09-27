import { and, eq, sql } from "drizzle-orm";
import { accountPaymentsTable, db, paymentConsumptionsTable } from "@workspace/db";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function canonicalPaymentHash(hash: string) { return hash.trim().toLowerCase().replace(/^0x/, ""); }

// Caller must have already verified the transfer, or be an authorized manual
// approver. The claim is fail-closed and must precede every legacy entitlement
// mutation. Never delete a claim merely because a later side effect fails.
export async function claimPaymentConsumption(tx: Transaction, txId: string, consumerId: string, legacyPaymentId?: string) {
  const canonical = canonicalPaymentHash(txId);
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${canonical}, 0))`);
  const [claim] = await tx.select().from(paymentConsumptionsTable).where(eq(paymentConsumptionsTable.txId, canonical)).limit(1);
  if (claim) return false;
  const historical = await tx.select().from(accountPaymentsTable)
    .where(sql`lower(trim(${accountPaymentsTable.txId})) in (${canonical}, ${`0x${canonical}`})`);
  if (historical.some((row) => !["pending", "rejected", "superseded"].includes(row.status))) return false;
  if (legacyPaymentId && !historical.some((row) => row.id === legacyPaymentId && row.status === "pending")) return false;
  await tx.insert(paymentConsumptionsTable).values({ txId: canonical, consumerId });
  for (const row of historical) {
    await tx.update(accountPaymentsTable).set({ status: row.id === legacyPaymentId ? "processing" : "superseded" })
      .where(and(eq(accountPaymentsTable.id, row.id), eq(accountPaymentsTable.status, row.status)));
  }
  return true;
}