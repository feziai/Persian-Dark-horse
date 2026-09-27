import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";

process.env.OPENROUTER_API_KEY = "mock-only";
const userId = "gpt-image-test-user";
const models = ["openai/gpt-image-2.5-flare", "openai/gpt-image-2.5-sunburst"];
const output = new URL("../../.local/gpt-image-route-tests.mjs", import.meta.url);
const stubs = new URL("./api-credit-test-stubs.mjs", import.meta.url).pathname;
await build({
  entryPoints: [new URL("../routes/fezi-data.ts", import.meta.url).pathname],
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
const originalFetch = globalThis.fetch;
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==";
const calls = [];
let generationResponse = { data: [{ b64_json: png }], usage: { cost: 0.08 } };
let catalogResponse = { data: models.map((id) => ({ id, name: id })) };
let imageCatalogStatus = 200;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).endsWith("/images/models")) return Response.json(catalogResponse, { status: imageCatalogStatus });
  if (String(url).endsWith("/models")) return Response.json({
    data: [{
      id: "openrouter/free", name: "Free Router",
      pricing: { prompt: "0", completion: "0" },
      architecture: { input_modalities: ["text"], output_modalities: ["text"] },
    }],
  });
  if (String(url).endsWith("/images")) {
    return generationResponse === null ? Response.json({ error: "provider unavailable" }, { status: 503 }) : Response.json(generationResponse);
  }
  throw new Error(`Unexpected test request: ${url}`);
};

function request(server, method, path, body, asUser = userId) {
  const payload = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1",
      port: server.address().port,
      path,
      method,
      headers: {
        "x-test-user-id": asUser,
        ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

test("GPT Image variants use the dedicated OpenRouter API, catalog and fixed post-success Credits", async (t) => {
  database.reset();
  const seedWallet = (id) => database.seed("account_credits", {
    userId: id, credits: 1000, creditsLimit: 1000, chats: 0,
    usageDay: new Date().toISOString().slice(0, 10), freeImagesToday: 0,
    freeVideosToday: 0, freeVideoUsageByTool: {},
  });
  seedWallet(userId);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { warn() {}, info() {}, error() {}, debug() {} };
    next();
  });
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await new Promise((resolve) => server.close(resolve));
  });

  imageCatalogStatus = 503;
  const degradedCatalog = await request(server, "GET", "/api/openrouter/models?agentId=monicah");
  assert.equal(degradedCatalog.status, 200);
  assert.equal(degradedCatalog.body.imageCatalogReachable, false);
  assert.deepEqual(degradedCatalog.body.modelCatalog.image, []);
  assert.deepEqual(degradedCatalog.body.modelCatalog.chat.map((model) => model.id), ["openrouter/free"]);
  const unavailableModel = await request(server, "POST", "/api/gemini/image", {
    agentId: "monicah", prompt: "A sunlit horse", model: models[0],
  });
  assert.equal(unavailableModel.status, 502);
  assert.equal(unavailableModel.body.code, "OPENROUTER_UNAVAILABLE");
  assert.equal((await request(server, "GET", "/api/payments/status")).body.credits, 1000);
  imageCatalogStatus = 200;
  const catalog = await request(server, "GET", "/api/openrouter/models?agentId=monicah");
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.imageCatalogReachable, true);
  assert.deepEqual(catalog.body.modelCatalog.image.map((item) => item.id).sort(), [...models].sort());
  assert.equal(catalog.body.modelCatalog.chat.length, 1);
  const disabledCatalog = await request(server, "GET", "/api/openrouter/models?agentId=arta");
  assert.deepEqual(disabledCatalog.body.modelCatalog.image, []);
  assert.ok(calls.some((call) => call.url.endsWith("/images/models")));

  for (const model of models) {
    const imageUser = `${userId}-${model.split("-").at(-1)}`;
    seedWallet(imageUser);
    const before = await request(server, "GET", "/api/payments/status", undefined, imageUser);
    assert.equal(before.body.credits, 1000);
    const response = await request(server, "POST", "/api/gemini/image", {
      agentId: "monicah",
      prompt: "A sunlit horse",
      model,
      aspectRatio: "3:2",
      imageBase64: png,
      mimeType: "image/png",
    }, imageUser);
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal(response.body.model, model);
    assert.equal(response.body.imageBase64, png);
    assert.equal(response.body.mimeType, "image/png");
    assert.equal(response.body.creditsUsed, 14);
    assert.equal("providerCostUsd" in response.body, false);
    const generationCall = calls.filter((call) => call.url.endsWith("/images")).at(-1);
    assert.equal(generationCall.init.method, "POST");
    assert.deepEqual(JSON.parse(generationCall.init.body), {
      model, prompt: "A sunlit horse", n: 1, output_format: "png", aspect_ratio: "3:2",
      input_references: [{ type: "image_url", image_url: { url: `data:image/png;base64,${png}` } }],
    });
    assert.equal(calls.some((call) => call.url.endsWith("/chat/completions")), false);
    // The mock database does not evaluate SQL arithmetic in wallet upserts;
    // verify the fixed charge from the public response rather than that stub.
  }

  for (const [index, malformed] of [
    { data: [], usage: { cost: 0.1 } },
    { data: [{ b64_json: "bad" }], usage: { cost: 0.1 } },
    { data: [{ b64_json: png }], usage: {} },
    null,
  ].entries()) {
    const failureUser = `${userId}-failure-${index}`;
    seedWallet(failureUser);
    generationResponse = malformed;
    const failed = await request(server, "POST", "/api/gemini/image", {
      agentId: "monicah", prompt: "A moonlit horse", model: models[0],
    }, failureUser);
    assert.equal(failed.status, 502);
    assert.equal(failed.body.code, "IMAGE_GENERATION_UNAVAILABLE");
    assert.equal((await request(server, "GET", "/api/payments/status", undefined, failureUser)).body.credits, 1000);
  }
  assert.equal(calls.some((call) => call.url.endsWith("/chat/completions")), false);
});