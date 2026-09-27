import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { build, transform } from "esbuild";
import express from "express";

if (process.env.NODE_ENV === "production") throw new Error("These tests must not run in production.");
// Test-only key; never use the real encryption key to produce fixtures.
process.env.REDEEM_CODE_ENCRYPTION_KEY = "11".repeat(32);
const outfile = new URL("../../.local/redeem-code-tests.mjs", import.meta.url);
await build({
  stdin: {
    contents: `export * from "./lib/redeem-code-security"; export * from "./lib/payment-consumption"; export * from "./routes/redeem-codes"; export {db,pool,accountCreditsTable,accountPaymentsTable,redeemCodeOrdersTable,paymentConsumptionsTable} from "@workspace/db"; export {eq} from "drizzle-orm";`,
    resolveDir: new URL("../", import.meta.url).pathname,
  },
  outfile: outfile.pathname, bundle: true, platform: "node", format: "esm",
  banner: { js: "import {createRequire} from 'node:module'; const require = createRequire(import.meta.url);" },
  plugins: [{
    name: "test-auth",
    setup(builder) {
      builder.onResolve({ filter: /middlewares\/auth$/ }, () => ({ path: "test-auth", namespace: "test-auth" }));
      builder.onLoad({ filter: /.*/, namespace: "test-auth" }, () => ({
        contents: `export const getAuthenticatedUserId = req => req.headers["x-test-user"]; export const requireAuth = (req,res,next) => req.headers["x-test-user"] ? next() : res.status(401).json({error:"Unauthorized"});`,
      }));
    },
  }],
});
const m = await import(outfile.href);

test("exact USD math, minimum, decimals and safe capacity", () => {
  assert.deepEqual(m.parseRedeemAmount("15"), { cents: 1500, credits: 12000 });
  assert.deepEqual(m.parseRedeemAmount("10.01"), { cents: 1001, credits: 8008 });
  for (const amount of ["9.99", "10.001", "1e3", "-10", "Infinity", "01", "100000000000000", 15]) {
    assert.throws(() => m.parseRedeemAmount(amount));
  }
  for (const extended of [false, true]) {
    const value = m.referenceAmount(1500, extended);
    const [whole, fraction] = value.split(".");
    const units = BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0"));
    assert.ok(units < 15n * 10n ** 18n && units > 1499n * 10n ** 16n);
  }
});
test("authenticated encryption and owner/order binding", () => {
  const code = m.newRedeemCode();
  assert.match(code, /^FEZI-[0-9A-F]{48}$/);
  const ciphertext = m.encryptRedeemCode(code, "order-one");
  assert.ok(!ciphertext.includes(code));
  assert.equal(m.decryptRedeemCode(ciphertext, "order-one"), code);
  assert.throws(() => m.decryptRedeemCode(ciphertext, "another-order"));
});

test("BEP20 verification requires exact 18-decimal amount, new transfer and finalized canonical block", async () => {
  const source = await readFile(new URL("../routes/fezi-data.ts", import.meta.url), "utf8");
  const section = source.slice(source.indexOf("const ERC20_TRANSFER_TOPIC"), source.indexOf("const BASE58_ALPHABET"));
  const compiled = await transform(section, { loader: "ts", target: "es2022" });
  const destination = "0x50e30db8199daa52A24d88e458B65D91DC721B48";
  const token = "0x55d398326f99059ff775485246999027b3197955";
  const expected = 14_999_999_000_000_000_000n;
  let amount = expected;
  let timestamp = "0x70000001";
  let finalized = "0x100";
  let mined = true;
  let canonical = true;
  let topLevelTo = token;
  const fakeFetch = async (_url, options) => {
    const { method } = JSON.parse(options.body);
    const result = method === "eth_getTransactionByHash" ? { to: topLevelTo }
      : method === "eth_getTransactionReceipt" ? (mined ? {
        status: "0x1", blockNumber: "0x100", blockHash: "0xab",
        logs: [{ address: token, topics: ["0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a9df523b3ef", "0x0", `0x${destination.slice(2).toLowerCase().padStart(64, "0")}`], data: `0x${amount.toString(16)}` }],
      } : null)
      : JSON.parse(options.body).params[0] === "finalized" ? { number: finalized }
      : { timestamp, hash: canonical ? "0xab" : "0xcd" };
    return { ok: true, json: async () => ({ result }) };
  };
  const verify = new Function("fetch", `${compiled.code}; return verifyEvmPayment;`)(fakeFetch);
  const binding = { cryptoAmount: "14.999999", createdAt: new Date(Number(0x70000000n) * 1000) };
  const run = () => verify("usdt-bep20", `0x${"a".repeat(64)}`, destination, 15, binding);
  assert.equal((await run()).verified, true);
  topLevelTo = "0x1111111111111111111111111111111111111111";
  assert.equal((await run()).verified, true, "smart-wallet/batched transfers use the token log, not top-level recipient");
  topLevelTo = token;
  amount++;
  assert.equal((await run()).verified, false, "overpayments cannot match another order");
  amount = expected;
  timestamp = "0x70000000";
  binding.createdAt = new Date(Number(0x70000000n) * 1000 + 999);
  assert.equal((await run()).verified, true, "same-second payment accepted at chain timestamp precision");
  timestamp = "0x6fffffff";
  assert.equal((await run()).verified, false, "payment in an earlier second rejected");
  timestamp = "0x70000001";
  finalized = "0xff";
  assert.equal((await run()).verified, false, "unfinalized receipt cannot issue");
  finalized = "0x100";
  canonical = false;
  assert.equal((await run()).verified, false, "reorged receipt cannot issue");
  canonical = true;
  mined = false;
  assert.equal((await run()).verified, false, "pending receipt cannot issue");
});

test("persistent route lifecycle: pending, isolation, replay and concurrent redemption", async () => {
  const user = `redeem-test-${randomUUID()}`;
  const other = `redeem-test-${randomUUID()}`;
  const hashes = Array.from({ length: 5 }, () => `0x${randomUUID().replaceAll("-", "")}${randomUUID().replaceAll("-", "")}`);
  const app = express();
  app.use(express.json());
  const router = express.Router();
  m.registerRedeemCodeRoutes(router, {
    currencies: [{ id: "usdt-bep20", label: "USDT BEP20", ticker: "USDT", network: "BEP20", address: "0x123" }],
    verify: async (_order, txId) => {
      if (txId === hashes[0]) await new Promise((resolve) => setTimeout(resolve, 60));
      return { verified: txId !== hashes[0], message: txId === hashes[0] ? "Pending confirmation" : "Verified" };
    },
    withWallet: async (_userId, action) => action(),
  });
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}/payments/redeem-codes`;
  async function call(path = "", data, owner = user) {
    const response = await fetch(base + path, {
      method: data ? "POST" : "GET",
      headers: { "content-type": "application/json", ...(owner ? { "x-test-user": owner } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    await m.db.insert(m.accountCreditsTable).values({ userId: user, referralCode: user, usageDay: "2026-01-01" });
    assert.equal((await call("", undefined, "")).status, 401);
    assert.equal((await call("/orders", { amountUsd: "9.99", currency: "usdt-bep20" })).status, 400);
    const created = await call("/orders", { amountUsd: "15", currency: "usdt-bep20" });
    assert.equal(created.status, 201);
    assert.equal(created.body.order.credits, 12000);
    assert.equal(created.body.order.code, null);
    const path = `/orders/${created.body.order.id}/verify`;
    assert.equal((await call(path, { txId: hashes[1] }, other)).status, 404);
    const pending = await call(path, { txId: hashes[0] });
    assert.equal(pending.body.order.status, "pending");
    assert.equal(pending.body.order.code, null);
    assert.equal(pending.body.order.txId, hashes[0]);
    const pendingHistory = await call();
    assert.equal(pendingHistory.body.orders.find((row) => row.id === created.body.order.id).txId, hashes[0]);
    const [pendingRow] = await m.db.select().from(m.redeemCodeOrdersTable).where(m.eq(m.redeemCodeOrdersTable.id, created.body.order.id));
    assert.equal(pendingRow.txId, null, "pending hashes must not occupy the unique verified transaction column");
    const reservations = await m.db.select().from(m.accountPaymentsTable).where(m.eq(m.accountPaymentsTable.txId, hashes[0]));
    assert.equal(reservations.length, 0, "unverified attempts must not reserve global payment hashes");
    const [issued, repeated, slowPending] = await Promise.all([
      call(path, { txId: hashes[1] }), call(path, { txId: hashes[1] }), call(path, { txId: hashes[0] }),
    ]);
    assert.equal(issued.status, 200);
    assert.equal(issued.body.order.code, repeated.body.order.code);
    assert.equal(slowPending.status, 409, "late unverified attempt cannot overwrite an issued order");
    assert.equal((await call()).body.orders.find((row) => row.id === created.body.order.id).txId, hashes[1]);
    let [wallet] = await m.db.select().from(m.accountCreditsTable).where(m.eq(m.accountCreditsTable.userId, user));
    assert.equal(wallet.credits, 1000, "purchase must not spend or credit the wallet");
    assert.equal((await call("", undefined, other)).body.orders.length, 0);
    const otherOrder = await call("/orders", { amountUsd: "15", currency: "usdt-bep20" }, other);
    const otherPending = await call(`/orders/${otherOrder.body.order.id}/verify`, { txId: hashes[0] }, other);
    assert.equal(otherPending.status, 200, "an unverified hash on another owner's order must not block a pending attempt");
    assert.equal(otherPending.body.order.txId, hashes[0]);
    const code = issued.body.order.code;
    assert.equal((await call("/redeem", { code }, other)).status, 404);
    const second = await call("/orders", { amountUsd: "15", currency: "usdt-bep20" });
    assert.notEqual(second.body.order.cryptoAmount, issued.body.order.cryptoAmount);
    assert.equal((await call(`/orders/${second.body.order.id}/verify`, { txId: hashes[1] })).status, 409);
    const legacyId = randomUUID();
    await m.db.insert(m.accountPaymentsTable).values({ id: legacyId, userId: user, planId: "legacy", currencyId: "usdt-bep20", txId: hashes[2].slice(2).toUpperCase(), status: "pending" });
    assert.equal((await call(`/orders/${second.body.order.id}/verify`, { txId: hashes[2] })).status, 200, "verified exact order supersedes unverified legacy reservation");
    const [superseded] = await m.db.select().from(m.accountPaymentsTable).where(m.eq(m.accountPaymentsTable.id, legacyId));
    assert.equal(superseded.status, "superseded");
    assert.equal(await m.db.transaction((tx) => m.claimPaymentConsumption(tx, hashes[2], `legacy:${legacyId}`, legacyId)), false, "stale in-memory legacy admin/automatic approval cannot consume an issued redeem payment");
    const third = await call("/orders", { amountUsd: "15", currency: "usdt-bep20" });
    await m.db.insert(m.accountPaymentsTable).values({ id: randomUUID(), userId: user, planId: "legacy", currencyId: "usdt-bep20", txId: hashes[3], status: "approved" });
    assert.equal((await call(`/orders/${third.body.order.id}/verify`, { txId: hashes[3] })).status, 409, "historical approved payments remain consumed without backfill");
    const raceOrder = await call("/orders", { amountUsd: "15", currency: "usdt-bep20" });
    const raceLegacyId = randomUUID();
    await m.db.insert(m.accountPaymentsTable).values({ id: raceLegacyId, userId: user, planId: "legacy", currencyId: "usdt-bep20", txId: hashes[4], status: "pending" });
    const [newClaim, legacyClaim] = await Promise.all([
      call(`/orders/${raceOrder.body.order.id}/verify`, { txId: hashes[4] }),
      m.db.transaction((tx) => m.claimPaymentConsumption(tx, hashes[4], `legacy:${raceLegacyId}`, raceLegacyId)),
    ]);
    assert.equal(Number(newClaim.status === 200) + Number(legacyClaim), 1, "legacy approval and new issuance racing for one canonical transfer have exactly one consumer");
    assert.equal(await m.db.transaction((tx) => m.claimPaymentConsumption(tx, hashes[4], `legacy:${raceLegacyId}`, raceLegacyId)), false, "a repeated legacy claim cannot grant again");
    const redeemed = await Promise.all([call("/redeem", { code }), call("/redeem", { code })]);
    assert.deepEqual(redeemed.map((r) => r.status).sort(), [200, 409]);
    [wallet] = await m.db.select().from(m.accountCreditsTable).where(m.eq(m.accountCreditsTable.userId, user));
    assert.equal(wallet.credits, 13000);
    assert.equal(wallet.creditsLimit, 13000);
    const history = await call();
    const order = history.body.orders.find((row) => row.id === issued.body.order.id);
    assert.equal(order.status, "redeemed");
    assert.equal(order.code, null);
    const [persisted] = await m.db.select().from(m.redeemCodeOrdersTable).where(m.eq(m.redeemCodeOrdersTable.id, order.id));
    assert.equal(persisted.codeCiphertext, null);
  } finally {
    await m.db.delete(m.redeemCodeOrdersTable).where(m.eq(m.redeemCodeOrdersTable.userId, user));
    await m.db.delete(m.redeemCodeOrdersTable).where(m.eq(m.redeemCodeOrdersTable.userId, other));
    await m.db.delete(m.accountPaymentsTable).where(m.eq(m.accountPaymentsTable.userId, user));
    for (const hash of hashes) await m.db.delete(m.paymentConsumptionsTable).where(m.eq(m.paymentConsumptionsTable.txId, m.canonicalPaymentHash(hash)));
    await m.db.delete(m.accountCreditsTable).where(m.eq(m.accountCreditsTable.userId, user));
    server.close();
    await m.pool.end();
  }
});