import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";

process.env.OPENROUTER_API_KEY = "test-only";

const userId = "crypto-payment-integration-user";
const destination = "0x50e30db8199daa52a24d88e458b65d91dc721b48";
const erc20TransferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a9df523b3ef";
const usdtErc20 = "0xdac17f958d2ee523a2206206994597c13d831ec7";
const tronUsdt = "41a614f803b6fd780986a42c78ec9c7f77e6ded13";
const tronDestination = "TWCLiDUumxSegdbY2Qq6n25PaoGuDedovp";
const fixtures = new Map();
let nextHash = 1n;

const output = new URL("../../.local/crypto-payment-integration-tests.mjs", import.meta.url);
const testStubs = new URL("./api-credit-test-stubs.mjs", import.meta.url).pathname;

await build({
  entryPoints: [new URL("../routes/fezi-data.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["pino"],
  banner: { js: "import { createRequire as testRequire } from 'node:module'; const require = testRequire(import.meta.url);" },
  plugins: [{
    name: "crypto-payment-integration-test-dependencies",
    setup(buildContext) {
      buildContext.onResolve({
        filter: /^(?:@workspace\/db|drizzle-orm|@clerk\/express|\.\.\/middlewares\/auth|\.\.\/lib\/promptStudioStorage)$/,
      }, () => ({ path: testStubs }));
      buildContext.onResolve({ filter: /^\.\.\/lib\/user-email$/ }, () => ({ path: "user-email-test", namespace: "test" }));
      buildContext.onResolve({ filter: /^\.\.\/lib\/admin-email$/ }, () => ({ path: "admin-email-test", namespace: "test" }));
      buildContext.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({
        contents: path === "admin-email-test" ? "export const queueAdminEmail = async () => {};" : `
          export const queuePurchaseEmail = async () => {};
          export const queueTicketStatusEmail = async () => {};
        `,
        loader: "js",
      }));
    },
  }],
  logLevel: "silent",
});

const { default: feziRouter } = await import(output.href);
const database = globalThis.__feziApiCreditTestDb;

function makeApi(router = feziRouter) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { info() {}, warn() {}, error() {}, debug() {} };
    next();
  });
  app.use("/api", router);
  return app;
}

function request(server, method, path, { body, asUser = userId } = {}) {
  const address = server.address();
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1",
      port: address.port,
      method,
      path,
      headers: {
        "x-test-user-id": asUser,
        ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        resolve({ status: res.statusCode, body: text ? JSON.parse(text) : null });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function newTxId() {
  const txId = nextHash.toString(16).padStart(64, "0");
  nextHash += 1n;
  return txId;
}

function addressTopic(address) {
  return `0x${address.toLowerCase().replace(/^0x/, "").padStart(64, "0")}`;
}

function evmTokenFixture({
  recipient = destination,
  token = usdtErc20,
  amount = 9_990_000n,
  receiptStatus = "0x1",
} = {}) {
  return {
    kind: "evm",
    tx: { to: token, value: "0x0" },
    receipt: {
      status: receiptStatus,
      logs: [{
        address: token,
        topics: [erc20TransferTopic, addressTopic("0x1111111111111111111111111111111111111111"), addressTopic(recipient)],
        data: `0x${amount.toString(16)}`,
      }],
    },
  };
}

function tronAddressPayload(address) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const char of address) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Invalid test TRON address.");
    value = value * 58n + BigInt(index);
  }
  return value.toString(16).padStart(50, "0").slice(0, -8).slice(-40);
}

function tronFixture({
  recipient = tronDestination,
  token = tronUsdt,
  amount = 9_990_000n,
  receiptResult = "SUCCESS",
} = {}) {
  return {
    kind: "tron",
    transaction: {
      ret: [{ contractRet: receiptResult }],
      raw_data: {
        contract: [{
          type: "TriggerSmartContract",
          parameter: {
            value: {
              contract_address: token,
              data: `a9059cbb${recipient === tronDestination ? tronAddressPayload(tronDestination) : recipient.toLowerCase().replace(/^0x/, "").slice(-40)}${amount.toString(16).padStart(64, "0")}`,
            },
          },
        }],
      },
    },
    info: { receipt: { result: receiptResult } },
  };
}

globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  if (url.includes("api.coingecko.com")) {
    return Response.json({ binancecoin: { usd: 300 } });
  }

  if (url.includes("bsc-dataseed.binance.org") || url.includes("ethereum-rpc.publicnode.com")) {
    const { method, params } = JSON.parse(options.body);
    const fixture = fixtures.get(params[0]);
    if (fixture?.rpcOutage) return new Response("RPC unavailable", { status: 503 });
    if (method === "eth_getTransactionByHash") {
      return Response.json({ jsonrpc: "2.0", id: 1, result: fixture?.tx ?? null });
    }
    if (method === "eth_getTransactionReceipt") {
      return Response.json({ jsonrpc: "2.0", id: 1, result: fixture?.receipt ?? null });
    }
    throw new Error(`Unexpected EVM RPC method: ${method}`);
  }

  if (url.includes("api.trongrid.io/wallet/")) {
    const { value } = JSON.parse(options.body);
    const fixture = fixtures.get(value);
    if (url.endsWith("gettransactionbyid")) return Response.json(fixture?.transaction ?? {});
    if (url.endsWith("gettransactioninfobyid")) return Response.json(fixture?.info ?? {});
  }

  return new Response("Unexpected test network request", { status: 500 });
};

async function submit(server, currency, txId, asUser) {
  return request(server, "POST", "/api/payments/txid", {
    asUser,
    body: { planId: "rider", currency, txId },
  });
}

async function assertNoPaidEntitlement(server, asUser) {
  const status = await request(server, "GET", "/api/payments/status", { asUser });
  assert.equal(status.status, 200);
  assert.equal(status.body.hasPaidAccess, false);
  assert.equal(status.body.subscription, null);
  assert.equal(status.body.credits, 1000);
  assert.equal(database.rows("account_subscriptions").some((row) => row.userId === asUser), false);
}

test("crypto payment submissions verify safely and activate once", async (t) => {
  database.reset();
  const server = makeApi().listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const validNativeTx = newTxId();
  fixtures.set(validNativeTx, {
    kind: "evm",
    tx: { to: destination, value: `0x${40_000_000_000_000_000n.toString(16)}` },
    receipt: { status: "0x1", logs: [] },
  });
  const native = await submit(server, "bnb", validNativeTx);
  assert.equal(native.status, 200, JSON.stringify(native.body));
  assert.equal(native.body.autoVerified, true);
  assert.equal(native.body.status, "approved");
  assert.equal(native.body.subscription.planId, "rider");
  assert.equal(native.body.creditsAdded, 8000);
  assert.equal(database.rows("account_credits").find((row) => row.userId === userId)?.credits, 8000);
  assert.equal(database.rows("account_payments").find((row) => row.txId === validNativeTx)?.status, "approved");
  assert.equal(database.rows("payment_consumptions").filter((row) => row.txId === validNativeTx).length, 1);
  assert.equal(database.rows("account_subscriptions").find((row) => row.userId === userId)?.planId, "rider");

  const { default: restartedRouter } = await import(`${output.href}?fresh-payment-router=${Date.now()}`);
  const restartedServer = makeApi(restartedRouter).listen(0, "127.0.0.1");
  await once(restartedServer, "listening");
  try {
    const duplicate = await submit(restartedServer, "bnb", validNativeTx);
    assert.equal(duplicate.status, 409);
    const status = await request(restartedServer, "GET", "/api/payments/status");
    assert.equal(status.status, 200);
    assert.equal(status.body.credits, 8000, "a repeat submission cannot add the subscription Credits again");
    assert.equal(status.body.subscription.planId, "rider");
    assert.equal(database.rows("account_payments").filter((row) => row.txId === validNativeTx).length, 1);
    assert.equal(database.rows("payment_consumptions").filter((row) => row.txId === validNativeTx).length, 1);
  } finally {
    await new Promise((resolve) => restartedServer.close(resolve));
  }

  const rejectedCases = [
    { name: "EVM token transfer to the wrong recipient", currency: "usdt-erc20", fixture: evmTokenFixture({ recipient: "0x1111111111111111111111111111111111111111" }) },
    { name: "EVM transfer from the wrong token contract", currency: "usdt-erc20", fixture: evmTokenFixture({ token: "0x1111111111111111111111111111111111111111" }) },
    { name: "EVM token transfer below the plan amount", currency: "usdt-erc20", fixture: evmTokenFixture({ amount: 9_980_000n }) },
    { name: "failed EVM receipt", currency: "usdt-erc20", fixture: evmTokenFixture({ receiptStatus: "0x0" }) },
    { name: "TRON transfer to the wrong recipient", currency: "usdt-trc20", fixture: tronFixture({ recipient: "0x1111111111111111111111111111111111111111" }) },
    { name: "TRON transfer from the wrong token contract", currency: "usdt-trc20", fixture: tronFixture({ token: "41a614f803b6fd780986a42c78ec9c7f77e6ded14" }) },
    { name: "TRON token transfer below the plan amount", currency: "usdt-trc20", fixture: tronFixture({ amount: 9_980_000n }) },
    { name: "failed TRON receipt", currency: "usdt-trc20", fixture: tronFixture({ receiptResult: "FAILED" }) },
  ];

  for (const [index, scenario] of rejectedCases.entries()) {
    await t.test(scenario.name, async () => {
      const asUser = `crypto-rejected-${index}`;
      const txId = newTxId();
      fixtures.set(txId, scenario.fixture);
      const response = await submit(server, scenario.currency, txId, asUser);
      assert.equal(response.status, 422, JSON.stringify(response.body));
      assert.equal(response.body.autoVerified, false);
      assert.equal(database.rows("account_payments").find((row) => row.txId === txId)?.status, "rejected");
      assert.equal(database.rows("payment_consumptions").some((row) => row.txId === txId), false);
      await assertNoPaidEntitlement(server, asUser);
    });
  }

  await t.test("unsupported networks stay pending for manual review", async () => {
    const asUser = "crypto-unsupported-network";
    const txId = newTxId();
    const response = await submit(server, "btc", txId, asUser);
    assert.equal(response.status, 202);
    assert.equal(response.body.status, "pending");
    assert.equal(database.rows("account_payments").find((row) => row.txId === txId)?.status, "pending");
    await assertNoPaidEntitlement(server, asUser);
  });

  await t.test("RPC outages stay pending for manual review", async () => {
    const asUser = "crypto-rpc-outage";
    const txId = newTxId();
    fixtures.set(txId, { rpcOutage: true });
    const response = await submit(server, "bnb", txId, asUser);
    assert.equal(response.status, 202);
    assert.equal(response.body.status, "pending");
    assert.equal(database.rows("account_payments").find((row) => row.txId === txId)?.status, "pending");
    await assertNoPaidEntitlement(server, asUser);
  });
});