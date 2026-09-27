import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";

process.env.OPENROUTER_API_KEY = "mock-only";
process.env.GAPGPTAPIKEY = "mock-only";
process.env.DEEPSEEK = "mock-only";
process.env.OPENAI_API_KEY = "mock-only";
process.env.MISTRAL_API_KEY = "mock-only";
const userId = "chat-app-test-user";
const outfile = new URL("../../.local/chat-app-tests.mjs", import.meta.url);
const stubs = new URL("./api-credit-test-stubs.mjs", import.meta.url).pathname;
await build({
  entryPoints: [new URL("../routes/fezi-data.ts", import.meta.url).pathname],
  outfile: outfile.pathname, bundle: true, platform: "node", format: "esm", external: ["pino"],
  banner: { js: "import { createRequire as testRequire } from 'node:module'; const require = testRequire(import.meta.url);" },
  plugins: [{
    name: "chat-app-stubs",
    setup(context) {
      context.onResolve({ filter: /^(?:@workspace\/db|drizzle-orm|@clerk\/express|\.\.\/middlewares\/auth|\.\.\/lib\/promptStudioStorage)$/ }, () => ({ path: stubs }));
      context.onResolve({ filter: /^\.\.\/lib\/(?:user-email|admin-email)$/ }, () => ({ path: "email", namespace: "mock" }));
      context.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
        contents: "export const queueAdminEmail = async () => {}; export const queuePurchaseEmail = async () => {}; export const queueTicketStatusEmail = async () => {};",
        loader: "js",
      }));
    },
  }],
  logLevel: "silent",
});
const { default: router } = await import(outfile.href);
const database = globalThis.__feziApiCreditTestDb;
const apps = ["claude", "deepseek", "gapgpt", "openai", "mistral"];
const models = [
  "anthropic/claude-sonnet-4", "deepseek/deepseek-chat", "openai/gpt-4o",
  "mistralai/mistral-small", "google/gemini-flash",
];
const calls = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const path = String(url);
  if (path.endsWith("/models")) {
    return Response.json({ data: models.map((id) => ({
      id, name: id, pricing: { prompt: "0.000001", completion: "0.000001" },
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
      supported_parameters: [],
    })) });
  }
  if (path.endsWith("/images/models")) return Response.json({ data: [] });
  calls.push({ path, model: JSON.parse(options.body).model });
  return Response.json({ choices: [{ message: { content: "A complete mock answer that addresses the user request with helpful information." } }] });
};

function request(server, method, path, body, signedIn = true) {
  const data = body ? JSON.stringify(body) : "";
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1", port: server.address().port, method, path,
      headers: {
        ...(signedIn ? { "x-test-user-id": typeof signedIn === "string" ? signedIn : userId } : {}),
        ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString() || "{}") }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("five paid Chat Apps stay scoped, persist independent history, and spend only subscription Credits", async (t) => {
  t.after(() => { globalThis.fetch = originalFetch; });
  database.reset();
  database.seed("site_settings", { id: "global", aiEnabled: true });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.log = { info() {}, warn() {}, error() {} }; next(); });
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));

  for (const appId of apps) {
    const blocked = await request(server, "POST", "/api/chat", { agentId: "fezi", appId, message: "Hello" }, "free-chat-test");
    assert.equal(blocked.status, 402, appId);
    const blockedCatalog = await request(server, "GET", `/api/openrouter/models?appId=${appId}`, undefined, "free-chat-test");
    assert.equal(blockedCatalog.status, 402, appId);
  }
  const codeStudioBlocked = await request(server, "POST", "/api/chat",
    { agentId: "monicah", source: "studio", message: "Write code" }, "free-chat-test");
  assert.equal(codeStudioBlocked.status, 402);
  assert.equal(codeStudioBlocked.body.code, "SUBSCRIPTION_REQUIRED");
  assert.equal(calls.length, 0, "free users never reach a provider");
  database.seed("account_subscriptions", {
    userId, planId: "rider", status: "active", activatedAt: new Date(), expiresAt: new Date(Date.now() + 86400000),
  });
  database.seed("account_credits", {
    userId, credits: 1000, creditsLimit: 1000, chats: 0, usageDay: new Date().toISOString().slice(0, 10),
    freeImagesToday: 0, freeVideosToday: 0, freeVideoUsageByTool: {},
  });
  database.seed("account_credits", { userId: "unrelated", credits: 500 });
  const wallet = () => database.rows("account_credits").find((row) => row.userId === userId);
  const balancesBefore = wallet().credits;
  const initialStatus = await request(server, "GET", "/api/payments/status");
  assert.equal(initialStatus.body.credits, 1000, JSON.stringify(initialStatus));
  let charged = 0;
  for (const appId of apps) {
    assert.ok(Number.isFinite(wallet().credits), JSON.stringify(wallet()));
    const currentStatus = await request(server, "GET", "/api/payments/status");
    assert.ok(Number.isFinite(currentStatus.body.credits), JSON.stringify(currentStatus.body));
    const catalog = await request(server, "GET", `/api/openrouter/models?appId=${appId}`);
    assert.equal(catalog.status, 200, appId);
    assert.equal(catalog.body.appId, appId);
    assert.ok(catalog.body.modelCatalog.chat.length, appId);
    if (appId !== "gapgpt") {
      assert.equal(catalog.body.modelCatalog.chat.some((item) => item.id === "google/gemini-flash"), false);
    } else {
      assert.ok(catalog.body.modelCatalog.chat.some((item) => item.id === "google/gemini-flash"));
    }
    const forbidden = await request(server, "POST", "/api/chat", {
      agentId: "fezi", appId, message: "Hello", model: "google/gemini-flash",
    });
    assert.equal(forbidden.status, appId === "gapgpt" ? 200 : 400, `${appId}: ${JSON.stringify(forbidden.body)}`);
    if (appId === "gapgpt") charged += forbidden.body.creditsUsed;
    const model = appId === "claude" ? "anthropic/claude-sonnet-4" : appId === "gapgpt" ? "gapgpt-qwen-3.6"
      : appId === "deepseek" ? "deepseek-chat" : appId === "openai" ? "gpt-4o" : "mistral-small-latest";
    const sent = await request(server, "POST", "/api/chat", { agentId: "fezi", appId, message: "Help with a task", model });
    assert.equal(sent.status, 200, `${appId}: ${JSON.stringify(sent.body)}`);
    assert.ok(Number.isFinite(wallet().credits), JSON.stringify(wallet()));
    assert.equal(sent.body.appId, appId);
    assert.ok(sent.body.creditsUsed > 0);
    charged += sent.body.creditsUsed;
    const history = await request(server, "GET", `/api/chat/history?agentId=fezi&appId=${appId}&conversationId=${sent.body.conversationId}`);
    assert.equal(history.status, 200, appId);
    assert.equal(history.body.appId, appId);
    assert.equal(history.body.model, model);
    assert.equal(history.body.messages.length, 2);
    const other = apps.find((id) => id !== appId);
    assert.equal((await request(server, "GET", `/api/chat/history?agentId=fezi&appId=${other}&conversationId=${sent.body.conversationId}`)).status, 404);
  }
  const summaries = await request(server, "GET", "/api/chat/conversations");
  assert.equal(summaries.status, 200);
  assert.ok(apps.every((id) => summaries.body.conversations.some((conversation) => conversation.appId === id)));
  assert.equal(wallet().credits, balancesBefore - charged);
  assert.equal(database.rows("account_credits").find((row) => row.userId === "unrelated").credits, 500);
  assert.equal(calls.every(({ model }) => models.includes(model) || model === "gapgpt-qwen-3.6" || model === "deepseek-chat" || model === "gpt-4o" || model === "mistral-small-latest"), true);
});