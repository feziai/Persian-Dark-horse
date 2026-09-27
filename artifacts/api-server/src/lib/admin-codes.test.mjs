import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test, after } from "node:test";
import { build } from "esbuild";

if (process.env.NODE_ENV === "production") throw new Error("These tests must not run in production.");
process.env.REDEEM_CODE_ENCRYPTION_KEY = "22".repeat(32);
const outfile = new URL("../../.local/admin-code-tests.mjs", import.meta.url);
await build({
  stdin: {
    contents: `export * from "./lib/admin-codes"; export {db,pool,accountCreditsTable,accountSubscriptionsTable,adminCodesTable,adminCodeRedemptionsTable} from "@workspace/db"; export {eq} from "drizzle-orm";`,
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

test("admin codes enforce distinct-user limits and persist credit and membership grants", async () => {
  const userId = `test-admin-code-${randomUUID()}`;
  const otherUser = `test-admin-code-${randomUUID()}`;
  const ids = [];
  try {
    for (const id of [userId, otherUser]) {
      await m.db.insert(m.accountCreditsTable).values({
        userId: id, referralCode: id, usageDay: new Date().toISOString().slice(0, 10),
      });
    }
    const make = async (input) => {
      const result = await m.createAdminCode({ ...input, code: input.code ?? `TEST-${randomUUID().replaceAll("-", "").slice(0, 15)}`, maxUses: input.maxUses ?? 1 });
      ids.push(result.id);
      return result;
    };
    const credit = await make({ kind: "credits", value: 50 });
    const attempts = await Promise.allSettled([
      m.redeemAdminCode(credit.code, userId, ["credits"]),
      m.redeemAdminCode(credit.code, userId, ["credits"]),
    ]);
    assert.equal(attempts.filter(result => result.status === "fulfilled").length, 1);
    assert.equal(attempts.filter(result => result.status === "rejected").length, 1);
    const [wallet] = await m.db.select().from(m.accountCreditsTable).where(m.eq(m.accountCreditsTable.userId, userId));
    assert.equal(wallet.credits, 1050);
    assert.equal(wallet.creditsLimit, 1050);
    await assert.rejects(() => m.redeemAdminCode(credit.code, otherUser, ["credits"]), /no longer available/);

    const discount = await make({ kind: "discount", value: 25, maxUses: 1 });
    await assert.rejects(() => m.redeemAdminCode(discount.code, userId, ["credits"]), /other redemption field/);
    assert.equal((await m.redeemAdminCode(discount.code, userId, ["discount"])).value, 25);
    assert.equal(await m.getClaimedDiscount(discount.code, userId), 25);
    await assert.rejects(() => m.redeemAdminCode(discount.code, otherUser, ["discount"]), /no longer available/);

    const maxLengthCode = await make({ kind: "discount", value: 1, code: `LONG-${randomUUID().replaceAll("-", "").slice(0, 15)}` });
    assert.equal(maxLengthCode.code.length, 20);
    await assert.rejects(() => m.createAdminCode({ kind: "discount", value: 1, maxUses: 1, code: `${maxLengthCode.code}X` }), /1–20/);
    const generated = await m.createAdminCode({ kind: "discount", value: 1, maxUses: 1 });
    ids.push(generated.id);
    assert.ok(generated.code.length >= 1 && generated.code.length <= 20);
    for (const candidate of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789") {
      try {
        const shortCode = await make({ kind: "discount", value: 1, code: candidate });
        assert.equal((await m.redeemAdminCode(shortCode.code.toLowerCase(), otherUser, ["discount"])).value, 1);
        break;
      } catch (error) {
        if (error.message !== "This code already exists.") throw error;
        if (candidate === "9") throw error;
      }
    }

    const membership = await make({ kind: "membership", value: 30, planId: "swift-rider" });
    const result = await m.redeemAdminCode(membership.code, userId, ["membership"], { "swift-rider": 8000 });
    assert.equal(result.credits, 9050);
    const [subscription] = await m.db.select().from(m.accountSubscriptionsTable).where(m.eq(m.accountSubscriptionsTable.userId, userId));
    assert.equal(subscription.planId, "swift-rider");
    assert.equal(subscription.status, "active");
    assert.ok(subscription.expiresAt.getTime() > Date.now() + 29 * 86_400_000);
  } finally {
    for (const id of ids) {
      await m.db.delete(m.adminCodeRedemptionsTable).where(m.eq(m.adminCodeRedemptionsTable.codeId, id));
      await m.db.delete(m.adminCodesTable).where(m.eq(m.adminCodesTable.id, id));
    }
    for (const id of [userId, otherUser]) {
      await m.db.delete(m.accountSubscriptionsTable).where(m.eq(m.accountSubscriptionsTable.userId, id));
      await m.db.delete(m.accountCreditsTable).where(m.eq(m.accountCreditsTable.userId, id));
    }
  }
});