import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const rows = new Map();
const deliveries = [];
let lookupFailure = false;
let verified = true;
let providerFailure = false;
const createdAt = Date.now() - 1000;

const pool = {
  async query(sql, args = []) {
    if (sql.includes("INSERT INTO user_email_outbox")) {
      const [key, userId, recipient, kind, subject, body] = args;
      if (!rows.has(key)) rows.set(key, {
        event_key: key, user_id: userId, recipient, kind, subject, body,
        created_at: new Date(), attempts: 0, next_attempt_at: 0, sent_at: null, skipped_at: null,
      });
      return { rows: [] };
    }
    if (sql.includes("UPDATE user_email_outbox o")) {
      const candidate = [...rows.values()].find((row) => !row.sent_at && !row.skipped_at && row.attempts < 20 && row.next_attempt_at <= Date.now());
      if (!candidate) return { rows: [] };
      candidate.attempts++;
      candidate.next_attempt_at = Date.now() + 120_000;
      return { rows: [{ ...candidate }] };
    }
    const row = rows.get(args[0]);
    if (sql.includes("SET sent_at")) row.sent_at = new Date();
    else if (sql.includes("SET skipped_at")) row.skipped_at = new Date();
    else if (sql.includes("SET recipient")) row.recipient ??= args[1];
    else if (sql.includes("SET next_attempt_at")) row.next_attempt_at = Date.now() + args[1] * 1000;
    else throw new Error("Unexpected outbox query");
    return { rows: [] };
  },
};

const output = new URL("../../.local/user-email-tests.mjs", import.meta.url);
await build({
  entryPoints: [new URL("./user-email.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  plugins: [{
    name: "outbox-dependencies",
    setup(context) {
      for (const [filter, name] of [
        [/^@workspace\/db$/, "db"], [/^@clerk\/express$/, "clerk"],
        [/^@replit\/connectors-sdk$/, "resend"], [/^\.\/logger$/, "logger"],
      ]) context.onResolve({ filter }, () => ({ path: name, namespace: "stub" }));
      context.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
        contents: ({
          db: "export const pool = globalThis.__mailTest.pool;",
          clerk: "export const clerkClient = { users: { getUser: async () => globalThis.__mailTest.lookup() } };",
          resend: `export class ReplitConnectors {
            async proxy(_service, _path, options) { return globalThis.__mailTest.deliver(options); }
          }`,
          logger: "export const logger = { warn() {}, error() {} };",
        })[path],
        loader: "js",
      }));
    },
  }],
  logLevel: "silent",
});
globalThis.__mailTest = {
  pool,
  lookup: async () => {
    if (lookupFailure) throw new Error("TemporaryLookupFailure");
    return {
      createdAt, primaryEmailAddress: { emailAddress: "verified@example.com",
        verification: { status: verified ? "verified" : "unverified" } },
    };
  },
  deliver: async (options) => {
    if (providerFailure) return { ok: false, status: 503 };
    deliveries.push(options);
    return { ok: true };
  },
};
const mail = await import(output.href);

async function drain() {
  // Enqueue starts an asynchronous flush; yield for it before asserting.
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 1));
  await mail.flushUserEmails();
}

test("welcome is persisted before Clerk lookup, retried, and delivered only to verified primary email", async () => {
  lookupFailure = true;
  await mail.queueWelcome("user_new");
  await drain();
  assert.equal(rows.get("user:welcome:user_new").user_id, "user_new");
  assert.equal(deliveries.length, 0);

  lookupFailure = false;
  verified = false;
  rows.get("user:welcome:user_new").next_attempt_at = 0;
  await mail.flushUserEmails();
  assert.equal(deliveries.length, 0);

  verified = true;
  providerFailure = true;
  rows.get("user:welcome:user_new").next_attempt_at = 0;
  await mail.flushUserEmails();
  assert.equal(deliveries.length, 0);
  assert.equal(rows.get("user:welcome:user_new").sent_at, null);
  assert.equal(rows.get("user:welcome:user_new").recipient, "verified@example.com", "recipient is frozen before first provider call");

  providerFailure = false;
  verified = false;
  rows.get("user:welcome:user_new").next_attempt_at = 0;
  await mail.flushUserEmails();
  assert.equal(deliveries.length, 1);
  assert.deepEqual(deliveries[0].body.to, ["verified@example.com"]);
  assert.equal(deliveries[0].headers["Idempotency-Key"], "user:welcome:user_new");
  assert.ok(rows.get("user:welcome:user_new").sent_at);
  verified = true;
  await mail.queueWelcome("user_new");
  await drain();
  assert.equal(deliveries.length, 1, "stable key deduplicates repeat signup");
});

test("old accounts are skipped, purchases dedupe by payment/status, tickets require a single valid email", async () => {
  const old = globalThis.__mailTest.lookup;
  globalThis.__mailTest.lookup = async () => ({
    createdAt: Date.now() - 31 * 60_000,
    primaryEmailAddress: { emailAddress: "verified@example.com", verification: { status: "verified" } },
  });
  await mail.queueWelcome("user_old");
  await drain();
  assert.equal(deliveries.length, 1, "old users receive no welcome");
  assert.ok(rows.get("user:welcome:user_old").skipped_at);
  assert.equal(rows.get("user:welcome:user_old").sent_at, null, "skipped is not incorrectly counted as delivered");
  globalThis.__mailTest.lookup = old;

  await mail.queuePurchaseEmail("payment-1", "user_new", "pending");
  await drain();
  assert.match(deliveries.at(-1).body.text, /NOT been approved/);
  assert.match(deliveries.at(-1).body.text, /Payment ID: payment-1/);
  assert.notEqual(deliveries.at(-1).headers["Idempotency-Key"], "payment:pending:payment-1", "user provider key must not collide with owner alert");
  await mail.queuePurchaseEmail("payment-1", "user_new", "pending");
  await drain();
  assert.equal(deliveries.filter((d) => d.headers["Idempotency-Key"] === "user:payment:pending:payment-1").length, 1);
  await mail.queuePurchaseEmail("payment-1", "user_new", "approved");
  await mail.queuePurchaseEmail("payment-2", "user_new", "rejected");
  await drain();
  assert.ok(rows.get("user:payment:approved:payment-1"));
  assert.ok(rows.get("user:payment:rejected:payment-2"));

  const date = new Date("2026-01-01T01:02:03Z");
  await mail.queueTicketStatusEmail("ticket-1", date, "telegram:@someone", "resolved");
  assert.equal([...rows.keys()].filter((key) => key.startsWith("user:ticket:")).length, 0);
  await mail.queueTicketStatusEmail("ticket-1", date, "first@example.com,second@example.com", "resolved");
  assert.equal([...rows.keys()].filter((key) => key.startsWith("user:ticket:")).length, 0);
  await mail.queueTicketStatusEmail("ticket-1", date, "contact@example.com", "resolved");
  await drain();
  assert.equal(deliveries.at(-1).body.to[0], "contact@example.com");
  assert.match(deliveries.at(-1).body.text, /Ticket ID: ticket-1/);
  await mail.queueTicketStatusEmail("ticket-1", new Date(date.getTime() + 1000), "contact@example.com", "open");
  await drain();
  assert.equal([...rows.keys()].filter((key) => key.startsWith("user:ticket:")).length, 2);
  assert.ok([...rows.keys()].every((key) => key.startsWith("user:")), "all user row keys are isolated from owner keys");
  assert.ok(deliveries.every((delivery) => delivery.headers["Idempotency-Key"].startsWith("user:")));
});

test("exhausted delivery events are capped after twenty attempts", async () => {
  providerFailure = true;
  await mail.queuePurchaseEmail("payment-exhausted", "user_new", "pending");
  await drain();
  const row = rows.get("user:payment:pending:payment-exhausted");
  for (let attempt = row.attempts; attempt < 20; attempt++) {
    row.next_attempt_at = 0;
    await mail.flushUserEmails();
  }
  assert.equal(row.attempts, 20);
  row.next_attempt_at = 0;
  await mail.flushUserEmails();
  assert.equal(row.attempts, 20, "the worker no longer selects exhausted rows");
  providerFailure = false;
});