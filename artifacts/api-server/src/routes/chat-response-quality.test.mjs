import assert from "node:assert/strict";
import { once } from "node:events";
import { after, test } from "node:test";
import { build } from "esbuild";
import express from "express";

delete process.env.OPENROUTHERFREE_API_KEY;
process.env.OPENROUTHERFREE = "test-chat-provider";
process.env.OPENROUTER_API_KEY = "";
process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY = "";
process.env.Gemeni_api_key = "";
process.env.GA_API_KEY = "";
process.env.GEMINI_API_KEY = "";
process.env.GAPGPTAPIKEY = "";
process.env.GAPGPT_API_KEY = "";
process.env.DEEPSEEK = "";
process.env.MISTRAL_API_KEY = "";
process.env.OLLAMA_API_KEY = "";
process.env.XAI_API_KEY = "";
process.env.OPENAI_API_KEY = "";
process.env.OPENAI_API_KE = "";
process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "";
process.env.CHAT_MAX_PROVIDER_ATTEMPTS = "1";
process.env.CHAT_PROVIDER_TIMEOUT_MS = "3000";
process.env.CHAT_PROVIDER_INITIAL_TIMEOUT_MS = "3000";
process.env.CHAT_SUPERVISOR_MAX_ATTEMPTS = "1";
process.env.CHAT_SUPERVISOR_TIMEOUT_MS = "1200";

const output = new URL("../../.local/chat-response-route-tests.mjs", import.meta.url);
const stubs = new URL("../lib/api-credit-test-stubs.mjs", import.meta.url).pathname;
await build({
  entryPoints: [new URL("./fezi-data.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["pino"],
  banner: { js: "import { createRequire as testRequire } from 'node:module'; const require = testRequire(import.meta.url);" },
  plugins: [{
    name: "test-dependencies",
    setup(context) {
      context.onResolve({
        filter: /^(?:@workspace\/db|drizzle-orm|@clerk\/express|\.\.\/middlewares\/auth|\.\.\/lib\/promptStudioStorage)$/,
      }, () => ({ path: stubs }));
      context.onResolve({ filter: /^\.\.\/lib\/(?:user-email|admin-email)$/ }, () => ({ path: "mail", namespace: "test" }));
      context.onLoad({ filter: /.*/, namespace: "test" }, () => ({
        contents: "export const queueAdminEmail = async () => {}; export const queuePurchaseEmail = async () => {}; export const queueTicketStatusEmail = async () => {};",
        loader: "js",
      }));
    },
  }],
  logLevel: "silent",
});
const { default: router } = await import(output.href);
const database = globalThis.__feziApiCreditTestDb;
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  req.log = { warn() {}, info() {}, error() {}, debug() {} };
  next();
});
app.use("/api", router);
const server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const url = `http://127.0.0.1:${server.address().port}/api/chat`;
const originalFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = originalFetch;
  await new Promise((resolve) => server.close(resolve));
});

function seedWorkspace(userId) {
  const today = new Date().toISOString().slice(0, 10);
  database.seed("site_settings", { id: "global", aiEnabled: true, theme: "midnight", options: {}, plugins: [] });
  database.seed("account_credits", {
    userId, credits: 1000, creditsLimit: 1000, chats: 0, usageDay: today,
    freeImagesToday: 0, freeVideosToday: 0, freeVideoUsageByTool: {},
  });
  database.seed("account_subscriptions", {
    userId, planId: "swift-rider", status: "active", activatedAt: new Date(), expiresAt: null,
  });
}

async function send(userId, message = "Please explain the attached note.") {
  const response = await originalFetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-test-user-id": userId },
    body: JSON.stringify({ agentId: "monicah", message, attachments: ["notes.txt"] }),
  });
  return { status: response.status, body: await response.json() };
}

test("malformed attachment-marker drafts use one bounded repair before one credit debit", async () => {
  database.reset();
  const userId = "chat-response-repair-user";
  seedWorkspace(userId);
  const calls = [];
  globalThis.fetch = async (endpoint, init) => {
    const body = JSON.parse(init.body);
    calls.push({ endpoint: String(endpoint), body });
    const guardPrompt = body.messages?.some((message) => String(message.content).includes("fast response-quality guard"));
    return Response.json({
      choices: [{ message: { content: guardPrompt ? "The note outlines a short project plan." : "safeAttached image [transport payload]" } }],
    });
  };
  const result = await send(userId);
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.message, "The note outlines a short project plan.");
  assert.equal(calls.length, 2, "one main attempt plus one bounded supervisor attempt");
  const wallet = database.rows("account_credits").find((row) => row.userId === userId);
  const assistantMessages = database.rows("chat_messages").filter((row) => row.userId === userId && row.role === "agent");
  assert.equal(assistantMessages.length, 1);
  assert.equal(assistantMessages[0].text.includes("safeAttached"), false);
  assert.equal(wallet.chats, 1);
  assert.equal(1000 - wallet.credits, assistantMessages[0].metadata.credits);
  assert.ok(assistantMessages[0].metadata.credits > 0);
});

test("healthy drafts bypass the supervisor and final provider timeouts return a no-charge continuation", async () => {
  database.reset();
  const healthyUser = "chat-response-healthy-user";
  seedWorkspace(healthyUser);
  let healthyCalls = 0;
  globalThis.fetch = async () => {
    healthyCalls += 1;
    return Response.json({ choices: [{ message: { content: "A healthy direct answer for the attached note." } }] });
  };
  const healthy = await send(healthyUser);
  assert.equal(healthy.status, 200);
  assert.equal(healthyCalls, 1, "ordinary responses must not run the supervisor");

  database.reset();
  const timeoutUser = "chat-response-timeout-user";
  seedWorkspace(timeoutUser);
  let timeoutCalls = 0;
  globalThis.fetch = (_endpoint, init) => new Promise((_resolve, reject) => {
    timeoutCalls += 1;
    init.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
  });
  const timedOut = await send(timeoutUser);
  assert.equal(timedOut.status, 200, JSON.stringify(timedOut.body));
  assert.match(timedOut.body.message, /attached file/i);
  assert.match(timedOut.body.message, /No Credits were charged/i);
  const wallet = database.rows("account_credits").find((row) => row.userId === timeoutUser);
  const assistantMessages = database.rows("chat_messages").filter((row) => row.userId === timeoutUser && row.role === "agent");
  assert.equal(wallet.credits, 1000);
  assert.equal(wallet.chats, 0);
  assert.equal(assistantMessages.length, 1);
  assert.equal(assistantMessages[0].metadata.credits, 0);
  assert.equal(timeoutCalls, 1, "the configured provider attempt cap prevents an unbounded timeout chain");
});