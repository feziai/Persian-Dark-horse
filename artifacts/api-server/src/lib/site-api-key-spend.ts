import { and, eq, isNull, sql } from "drizzle-orm";
import { customAgentApiKeysTable, db, siteApiCreditsTable } from "@workspace/db";

class KeyLimitReached extends Error {}

/** Charges only after a validated response. The key allowance and shared wallet
 * must change together or neither changes, including on concurrent requests. */
export async function chargeSiteApiKey(ownerId: string, keyId: string, amount: number):
  Promise<{ status: "charged"; credits: number } | { status: "wallet" | "key" }> {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid API Credit charge.");
  try {
    return await db.transaction(async (tx) => {
      const [wallet] = await tx.update(siteApiCreditsTable)
        .set({ credits: sql`${siteApiCreditsTable.credits} - ${amount}` })
        .where(and(eq(siteApiCreditsTable.ownerId, ownerId), sql`${siteApiCreditsTable.credits} >= ${amount}`))
        .returning({ credits: siteApiCreditsTable.credits });
      if (!wallet) return { status: "wallet" as const };
      const [charged] = await tx.update(customAgentApiKeysTable)
        .set({ creditsUsed: sql`${customAgentApiKeysTable.creditsUsed} + ${amount}`, lastUsedAt: new Date() })
        .where(and(
          eq(customAgentApiKeysTable.id, keyId),
          eq(customAgentApiKeysTable.ownerId, ownerId),
          eq(customAgentApiKeysTable.agentId, "site"),
          isNull(customAgentApiKeysTable.revokedAt),
          sql`(${customAgentApiKeysTable.creditLimit} is null or ${customAgentApiKeysTable.creditsUsed} + ${amount} <= ${customAgentApiKeysTable.creditLimit})`,
        )).returning({ id: customAgentApiKeysTable.id });
      if (!charged) throw new KeyLimitReached();
      return { status: "charged" as const, credits: wallet.credits };
    });
  } catch (error) {
    if (error instanceof KeyLimitReached) return { status: "key" };
    throw error;
  }
}