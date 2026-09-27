import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";

process.env.OPENROUTHERFREE = "mock-openrouter-only";
process.env.Gemeni_api_key = "mock-gemini-only";
const output = new URL("../../.local/chat-attachment-route-tests.mjs", import.meta.url);
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

test("Chat streams supported media, enforces 8 MB, and preserves video provider failover", async (t) => {
  database.reset();
  const app = express();
  const logs = [];
  app.use((req, _res, next) => {
    req.log = { warn: (...args) => logs.push(args), info() {}, error() {}, debug() {} };
    next();
  });
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}/api/files/analyze-upload`;
  const originalFetch = globalThis.fetch;
  let providerPayloads = [];
  let failOpenRouter = false;
  globalThis.fetch = async (endpoint, init) => {
    const payload = JSON.parse(init.body);
    providerPayloads.push({ endpoint: String(endpoint), payload });
    if (String(endpoint).includes("openrouter.ai")) {
      if (failOpenRouter) return Response.json({ error: "unavailable" }, { status: 503 });
      return Response.json({ choices: [{ message: { content: "Grounded fixture analysis" } }] });
    }
    if (String(endpoint).includes("generativelanguage.googleapis.com")) {
      return Response.json({ candidates: [{ content: { parts: [{ text: "Grounded frame fallback" }] } }] });
    }
    throw new Error("Unexpected provider");
  };
  const fixtureDir = mkdtempSync(join(tmpdir(), "fezi-upload-test-"));
  t.after(async () => {
    globalThis.fetch = originalFetch;
    await new Promise((resolve) => server.close(resolve));
    rmSync(fixtureDir, { recursive: true, force: true });
  });
  const videoPath = join(fixtureDir, "blue.webm");
  execFileSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "color=c=blue:s=32x32:d=1.5", "-c:v", "libvpx-vp9", "-y", videoPath]);
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==", "base64");
  const wav = Buffer.from("RIFF0000WAVEfmt test-audio");
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF");
  const send = async (mime, bytes, name) => {
    const res = await originalFetch(url, {
      method: "POST",
      headers: {
        "x-test-user-id": "attachment-route-test-user",
        "x-agent-id": "monicah",
        "x-file-name": name,
        "x-file-mime-type": mime,
        "content-type": mime,
      },
      body: bytes,
    });
    return { status: res.status, body: await res.json() };
  };

  for (const [mime, bytes, name, expectedPart] of [
    ["image/png", png, "pixel.png", "image_url"],
    ["audio/wav", wav, "tone.wav", "input_audio"],
    ["application/pdf", pdf, "page.pdf", "file"],
    ["video/webm", readFileSync(videoPath), "blue.webm", "image_url"],
  ]) {
    providerPayloads = [];
    const response = await send(mime, bytes, name);
    assert.equal(response.status, 200, `${mime}: ${JSON.stringify(response.body)}`);
    assert.equal(response.body.analysis, "Grounded fixture analysis");
    assert.ok(response.body.creditsUsed > 0);
    const parts = providerPayloads[0].payload.messages[1].content;
    assert.ok(parts.some((part) => part.type === expectedPart), `${mime} must reach provider as ${expectedPart}`);
    if (mime === "audio/wav") assert.equal(parts.find((part) => part.type === "input_audio").input_audio.format, "wav");
    if (mime === "video/webm") assert.ok(parts.some((part) => part.image_url?.url.startsWith("data:image/png;base64,")));
  }

  providerPayloads = [];
  failOpenRouter = true;
  const fallback = await send("video/webm", readFileSync(videoPath), "fallback.webm");
  assert.equal(fallback.status, 200);
  assert.equal(fallback.body.analysis, "Grounded frame fallback");
  assert.equal(providerPayloads.length, 2);
  assert.ok(providerPayloads[1].payload.contents[0].parts.some((part) => part.inlineData?.mimeType === "image/png"));
  failOpenRouter = false;

  providerPayloads = [];
  assert.equal((await send("application/zip", Buffer.from("unsupported"), "archive.zip")).status, 400);
  assert.equal((await send("application/pdf", Buffer.alloc(8 * 1024 * 1024 + 1), "large.pdf")).status, 413);
  assert.equal(providerPayloads.length, 0, "invalid uploads must not reach providers");
  assert.ok(!JSON.stringify(logs).includes("test-audio"), "uploaded content must not be logged");
});