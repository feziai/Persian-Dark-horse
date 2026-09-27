import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { build } from "esbuild";

if (process.env.NODE_ENV === "production") throw new Error("These tests must not run in production.");
const outfile = new URL("../../.local/site-api-key-spend-tests.mjs", import.meta.url);
await build({
  stdin: {
    contents: `export * from "./lib/site-api-key-spend"; export * from "./lib/site-api-topup"; export {claimPaymentConsumption} from "./lib/payment-consumption"; export {db,pool,siteApiCreditsTable,customAgentApiKeysTable,accountPaymentsTable,paymentConsumptionsTable} from "@workspace/db"; export {eq} from "drizzle-orm";`,
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  outfile: outfile.pathname, bundle: true, platform: "node", format: "esm",
  banner: { js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);" },
});
const m = await import(outfile.href);
after(async () => { await m.pool.end(); });

test("named Site keys share a wallet while caps, revocation, and concurrent charges remain atomic", async () => {
  const ownerId = `test-site-keys-${randomUUID()}`;
  const cappedId = `key_${randomUUID()}`;
  const unlimitedId = `key_${randomUUID()}`;
  try {
    await m.db.insert(m.siteApiCreditsTable).values({ ownerId, credits: 20 });
    for (const [id, limit] of [[cappedId, 4], [unlimitedId, null]]) {
      await m.db.insert(m.customAgentApiKeysTable).values({
        id, ownerId, agentId: "site", name: "Test key",
        keyHash: randomUUID(), lastFour: "test", creditLimit: limit,
      });
    }
    const capped = await Promise.all(Array.from({ length: 5 }, () => m.chargeSiteApiKey(ownerId, cappedId, 2)));
    assert.equal(capped.filter(result => result.status === "charged").length, 2);
    assert.equal(capped.filter(result => result.status === "key").length, 3);
    const unlimited = await Promise.all(Array.from({ length: 10 }, () => m.chargeSiteApiKey(ownerId, unlimitedId, 2)));
    assert.equal(unlimited.filter(result => result.status === "charged").length, 8);
    assert.equal(unlimited.filter(result => result.status === "wallet").length, 2);
    const [wallet] = await m.db.select().from(m.siteApiCreditsTable).where(m.eq(m.siteApiCreditsTable.ownerId, ownerId));
    assert.equal(wallet.credits, 0);
    const [cappedKey] = await m.db.select().from(m.customAgentApiKeysTable).where(m.eq(m.customAgentApiKeysTable.id, cappedId));
    const [unlimitedKey] = await m.db.select().from(m.customAgentApiKeysTable).where(m.eq(m.customAgentApiKeysTable.id, unlimitedId));
    assert.equal(cappedKey.creditsUsed, 4);
    assert.equal(unlimitedKey.creditsUsed, 16);
    assert.ok(cappedKey.lastUsedAt);
    await m.db.update(m.siteApiCreditsTable).set({ credits: 2 }).where(m.eq(m.siteApiCreditsTable.ownerId, ownerId));
    await m.db.update(m.customAgentApiKeysTable).set({ revokedAt: new Date() }).where(m.eq(m.customAgentApiKeysTable.id, unlimitedId));
    assert.equal((await m.chargeSiteApiKey(ownerId, unlimitedId, 2)).status, "key");
    const [afterRevocation] = await m.db.select().from(m.siteApiCreditsTable).where(m.eq(m.siteApiCreditsTable.ownerId, ownerId));
    assert.equal(afterRevocation.credits, 2);
    await assert.rejects(() => m.chargeSiteApiKey(ownerId, cappedId, 0), /Invalid API Credit charge/);
  } finally {
    for (const id of [cappedId, unlimitedId]) {
      await m.db.delete(m.customAgentApiKeysTable).where(m.eq(m.customAgentApiKeysTable.id, id));
    }
    await m.db.delete(m.siteApiCreditsTable).where(m.eq(m.siteApiCreditsTable.ownerId, ownerId));
  }
});

test("custom Site top-ups claim, approve, and credit exactly once, including stranded processing orders", async () => {
  const ownerId = `test-site-topup-${randomUUID()}`;
  const ids = [randomUUID(), randomUUID()];
  const txIds = ids.map(() => (randomUUID() + randomUUID()).replaceAll("-", ""));
  try {
    for (let index = 0; index < ids.length; index++) {
      await m.db.insert(m.accountPaymentsTable).values({
        id: ids[index], userId: ownerId,
        planId: "api:site:site:api-site-custom-usd-1300-v1",
        currencyId: "usdt-bep20", txId: txIds[index],
        status: "pending", createdAt: new Date(),
      });
    }
    const recoverable = await m.listRecoverableSiteTopups();
    assert.equal(recoverable.filter(payment => ids.includes(payment.id)).length, 2);
    const first = { id: ids[0], ownerId, txId: txIds[0] };
    const recovery = { id: ids[1], ownerId, txId: txIds[1] };
    assert.equal(await m.activateSiteApiTopup(first, 500), true);
    assert.equal(await m.activateSiteApiTopup(first, 500), false);
    await m.db.transaction(tx => m.claimPaymentConsumption(tx, recovery.txId, `legacy:${recovery.id}`, recovery.id));
    assert.ok((await m.listRecoverableSiteTopups()).some(payment => payment.id === recovery.id && payment.status === "processing"));
    assert.equal(await m.activateSiteApiTopup(recovery, 500), true);
    assert.equal(await m.activateSiteApiTopup(recovery, 500), false);
    const [wallet] = await m.db.select().from(m.siteApiCreditsTable).where(m.eq(m.siteApiCreditsTable.ownerId, ownerId));
    assert.equal(wallet.credits, 1000);
    for (const id of ids) {
      const [payment] = await m.db.select().from(m.accountPaymentsTable).where(m.eq(m.accountPaymentsTable.id, id));
      assert.equal(payment.status, "approved");
    }
  } finally {
    for (const txId of txIds) {
      await m.db.delete(m.paymentConsumptionsTable).where(m.eq(m.paymentConsumptionsTable.txId, txId));
    }
    for (const id of ids) {
      await m.db.delete(m.accountPaymentsTable).where(m.eq(m.accountPaymentsTable.id, id));
    }
    await m.db.delete(m.siteApiCreditsTable).where(m.eq(m.siteApiCreditsTable.ownerId, ownerId));
  }
});