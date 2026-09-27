import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";

process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID = "mock-chat-media";
process.env.OPENROUTER_API_KEY = "mock-only-never-used-outside-fetch-stub";
process.env.GAPGPTAPIKEY = "mock-only-never-used-outside-fetch-stub";
process.env.GEMINI_API_KEY = "mock-only-never-used-outside-fetch-stub";
const outfile = new URL("../../.local/chat-media-route-tests.mjs", import.meta.url);
const stubs = new URL("./api-credit-test-stubs.mjs", import.meta.url).pathname;
const savedObjects = globalThis.__mockChatMediaObjects = new Map();
const meter = globalThis.__mockChatMediaMeter = { image: 0, video: 0, storageFails: false, saveFails: false, invalidModel: false };
await build({
  entryPoints: [new URL("../routes/fezi-data.ts", import.meta.url).pathname],
  outfile: outfile.pathname, bundle: true, platform: "node", format: "esm", external: ["pino"],
  banner: { js: "import { createRequire as testRequire } from 'node:module'; const require = testRequire(import.meta.url);" },
  plugins: [{
    name: "media-provider-stubs",
    setup(context) {
      context.onResolve({ filter: /^(?:@workspace\/db|drizzle-orm|@clerk\/express|\.\.\/middlewares\/auth)$/ }, () => ({ path: stubs }));
      context.onResolve({ filter: /^(?:\.\.\/lib\/|\.\/)(?:stable-diffusion|native-chat-video|promptStudioStorage)$/ }, (args) =>
        ({ path: args.path, namespace: "media-mock" }));
      context.onLoad({ filter: /.*/, namespace: "media-mock" }, (args) => {
        if (args.path.endsWith("stable-diffusion")) return { loader: "js", contents: `
          export const isStableDiffusionConfigured = () => true;
          export async function requestStableDiffusionImage() {
            globalThis.__mockChatMediaMeter.image++;
            return { imageBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]).toString("base64"), mimeType: "image/png", model: globalThis.__mockChatMediaMeter.invalidModel ? null : "stable-diffusion-xl" };
          }` };
        if (args.path.endsWith("native-chat-video")) return { loader: "js", contents: `
          export const NATIVE_CHAT_VIDEO_COST_USD = 0.4;
          export const NATIVE_CHAT_VIDEO_MIN_CREDITS = 889;
          export const isNativeChatVideoConfigured = () => true;
          export async function requestNativeChatVideo() {
            globalThis.__mockChatMediaMeter.video++;
            return { video: Buffer.from([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109]), mimeType: "video/mp4", model: "grok-imagine-video-1.5", durationSeconds: 5 };
          }` };
        return { loader: "js", contents: `
          export const objectStorageClient = { bucket: () => ({
            getFiles: async () => { if (globalThis.__mockChatMediaMeter.storageFails) throw new Error("storage unavailable"); return [[]]; },
            file: (key) => ({
              save: async (bytes) => { if (globalThis.__mockChatMediaMeter.saveFails) throw new Error("storage failed"); globalThis.__mockChatMediaObjects.set(key, bytes); },
              delete: async () => { globalThis.__mockChatMediaObjects.delete(key); },
              createReadStream: () => { throw new Error("read not needed"); },
            }),
          }) };
          export async function publishGeneratedPromptImage() { throw new Error("unused"); }` };
      });
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
const db = globalThis.__feziApiCreditTestDb;
const uid = "inline-media-test-owner";

function request(server, method, path, body, userId = uid) {
  const data = body ? JSON.stringify(body) : "";
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1", port: server.address().port, method, path,
      headers: { ...(userId ? { "x-test-user-id": userId } : {}), ...(data ? { "content-type": "application/json", "content-length": Buffer.byteLength(data) } : {}) },
    }, (res) => {
      const parts = [];
      res.on("data", (part) => parts.push(part));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(parts).toString() || "{}") }));
    });
    req.on("error", reject);
    req.end(data);
  });
}

test("inline chat enforces auth, subscription, credits and storage before any paid call; stores media once", async (t) => {
  const originalFetch = globalThis.fetch;
  const providerCalls = [];
  const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]).toString("base64");
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).endsWith("/models")) return Response.json({ data: [
      { id: "example/text-only", pricing: { prompt: "0", completion: "0" }, architecture: { output_modalities: ["text"], input_modalities: ["text"] } },
      { id: "example/verified-image", pricing: { prompt: "0", completion: "0", image_output: "0.01" }, architecture: { output_modalities: ["text", "image"], input_modalities: ["text"] } },
    ] });
    providerCalls.push({ path: String(url), body: JSON.parse(options.body) });
    if (String(url).endsWith("/images/generations")) return Response.json({ data: [{ b64_json: image }] });
    if (String(url).includes(":generateContent")) return Response.json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: image } }] } }] });
    return Response.json({ choices: [{ message: { images: [{ image_url: { url: `data:image/png;base64,${image}` } }] } }] });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  db.reset();
  savedObjects.clear();
  meter.image = 0; meter.video = 0; meter.storageFails = false; meter.saveFails = false; meter.invalidModel = false;
  db.seed("site_settings", { id: "global", aiEnabled: true });
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.log = { info() {}, warn() {}, error() {} }; next(); });
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const input = (agentId, message, extras = {}) => ({ agentId, message, ...extras });
  assert.equal((await request(server, "POST", "/api/chat", input("monicah", "Make image of a rose"), null)).status, 401);
  assert.equal((await request(server, "POST", "/api/chat", input("monicah", "Make image of a rose"), "free-media-test-user")).body.code, "SUBSCRIPTION_REQUIRED");
  assert.equal(meter.image, 0);
  const paid = (userId) => db.seed("account_subscriptions", { userId, planId: "horse-runner", status: "active", activatedAt: new Date(), expiresAt: new Date(Date.now() + 86400000) });
  paid("low-credit-media-user");
  db.seed("account_credits", { userId: "low-credit-media-user", credits: 10, creditsLimit: 10000, usageDay: new Date().toISOString().slice(0, 10) });
  assert.equal((await request(server, "POST", "/api/chat", input("monicah", "Make image of a rose"), "low-credit-media-user")).body.code, "CREDITS_EXHAUSTED");
  assert.equal(meter.image, 0);
  paid(uid);
  db.seed("account_credits", { userId: uid, credits: 3000, creditsLimit: 3000, usageDay: new Date().toISOString().slice(0, 10) });
  const wallet = db.rows("account_credits").find((row) => row.userId === uid);
  const reference = await request(server, "POST", "/api/chat", input("monicah", "Make image of this picture", { attachments: ["reference.png"] }));
  assert.equal(reference.body.code, "INLINE_MEDIA_REFERENCE_UNSUPPORTED");
  assert.equal(meter.image, 0);
  meter.storageFails = true;
  const fail = await request(server, "POST", "/api/chat", input("monicah", "Make image of a rose"));
  assert.equal(fail.body.code, "MEDIA_STORAGE_UNAVAILABLE");
  assert.equal(meter.image, 0);
  assert.equal(wallet.credits, 3000);
  meter.storageFails = false;
  meter.saveFails = true;
  const failedSave = await request(server, "POST", "/api/chat", input("monicah", "Make image of a rose"));
  assert.equal(failedSave.body.code, "MEDIA_GENERATION_UNAVAILABLE");
  assert.equal(wallet.credits, 3000);
  assert.equal(savedObjects.size, 0);
  meter.saveFails = false;
  const generated = await request(server, "POST", "/api/chat", input("monicah", "Make image of a rose"));
  assert.equal(generated.status, 200, JSON.stringify(generated.body));
  assert.equal(generated.body.media?.type, "image");
  assert.equal(generated.body.media?.isPreview, false);
  assert.equal(generated.body.media?.url, `/api/chat/media/${generated.body.messageId}`);
  assert.equal(generated.body.creditsUsed, 210);
  assert.equal(wallet.credits, 2790);
  assert.equal(meter.image, 2);
  assert.equal(savedObjects.size, 1);
  const sub = db.rows("account_subscriptions").find((row) => row.userId === uid);
  sub.status = "expired";
  const revoked = await request(server, "POST", "/api/chat", input("monicah", "Create image of a sunset"));
  assert.equal(revoked.body.code, "SUBSCRIPTION_REQUIRED");
  assert.equal(meter.image, 2);
  sub.status = "active";
  const history = await request(server, "GET", `/api/chat/history?agentId=monicah&conversationId=${generated.body.conversationId}`);
  assert.equal(history.body.messages.at(-1).media.url, generated.body.media.url);
  assert.equal(JSON.stringify(db.rows("chat_messages")).includes("imageBase64"), false);
  const video = await request(server, "POST", "/api/chat", input("monicah", "Generate video of a red horse", { conversationId: generated.body.conversationId }));
  assert.equal(video.status, 200, JSON.stringify(video.body));
  assert.equal(video.body.media?.isPreview, false);
  assert.equal(video.body.media?.model, "grok-imagine-video-1.5");
  assert.ok(video.body.creditsUsed >= 889);
  assert.equal(meter.video, 1);
  db.seed("custom_agents", {
    id: "custom_media_test", ownerId: uid, visibility: "private", status: "active",
    name: "Test agent", slug: "test-agent", category: "general", description: "",
    systemInstructions: "", developerInstructions: "", knowledgeText: "", model: "",
    connectedModels: [], capabilities: [], tools: [], tags: [],
  });
  for (const [agentId, extras] of [
    ["fezi", {}],
    ["custom_media_test", {}],
    ["fezi", { appId: "openai" }],
  ]) {
    const output = await request(server, "POST", "/api/chat", input(agentId, "عکس از یک اسب سفید بساز", extras));
    assert.equal(output.status, 200, `${agentId}: ${JSON.stringify(output.body)}`);
    assert.equal(output.body.media.type, "image");
  }
  assert.equal(meter.image, 5);
  const textOnly = await request(server, "POST", "/api/chat", input("monicah", "Create image of a violet tree", { model: "example/text-only" }));
  assert.equal(textOnly.status, 200, JSON.stringify(textOnly.body));
  assert.equal(textOnly.body.media.model, "stable-diffusion-xl");
  assert.equal(providerCalls.length, 0);
  const selected = await request(server, "POST", "/api/chat", input("monicah", "Create image of a violet tree", { model: "example/verified-image" }));
  assert.equal(selected.status, 200, JSON.stringify(selected.body));
  assert.equal(selected.body.media.model, "example/verified-image");
  assert.equal(providerCalls.length, 1);
  wallet.credits = 2500;
  const gapgpt = await request(server, "POST", "/api/chat", input("monicah", "Create image of a violin", { model: "gapgpt/z-image" }));
  assert.equal(gapgpt.status, 200, JSON.stringify(gapgpt.body));
  assert.equal(gapgpt.body.media.model, "gapgpt/z-image");
  assert.equal(providerCalls.at(-1).body.model, "gapgpt/z-image");
  const gemini = await request(server, "POST", "/api/chat", input("monicah", "Create image of a violin", { model: "gemini-2.5-flash-image" }));
  assert.equal(gemini.status, 200, JSON.stringify(gemini.body));
  assert.equal(gemini.body.media.model, "gemini-2.5-flash-image");
  assert.match(providerCalls.at(-1).path, /gemini-2\.5-flash-image:generateContent/u);
  const balanceBeforeInvalidResponse = wallet.credits;
  const savedBeforeInvalidResponse = savedObjects.size;
  meter.invalidModel = true;
  const invalidResponse = await request(server, "POST", "/api/chat", input("monicah", "Create image of a violet tree"));
  assert.equal(invalidResponse.body.code, "MEDIA_GENERATION_UNAVAILABLE");
  assert.equal(wallet.credits, balanceBeforeInvalidResponse, "response validation must happen before debit");
  assert.equal(savedObjects.size, savedBeforeInvalidResponse, "invalid response object must be removed");
});