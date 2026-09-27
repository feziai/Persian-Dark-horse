import assert from "node:assert/strict";
import { after, test } from "node:test";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [new URL("./native-chat-video.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const {
  isNativeChatVideoConfigured,
  requestNativeChatVideo,
  NATIVE_CHAT_VIDEO_COST_USD,
  NATIVE_CHAT_VIDEO_MIN_CREDITS,
} = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);

const originalFetch = globalThis.fetch;
const originalKey = process.env.XAI_API_KEY;
process.env.XAI_API_KEY = "unit-test-only-not-a-real-key";
after(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.XAI_API_KEY;
  else process.env.XAI_API_KEY = originalKey;
});

const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 16]), Buffer.from("ftypisom0000", "ascii")]);
const videoUrl = "https://vidgen.x.ai/output/video.mp4";

function stubResponses({ statuses = ["done"], url = videoUrl, media = mp4, contentType = "video/mp4" } = {}) {
  const calls = [];
  let pollIndex = 0;
  globalThis.fetch = async (input, init) => {
    const target = String(input);
    calls.push({ target, init });
    if (target === "https://api.x.ai/v1/videos/generations") {
      return Response.json({ request_id: "safe_request-123" });
    }
    if (target === "https://api.x.ai/v1/videos/safe_request-123") {
      const status = statuses[Math.min(pollIndex++, statuses.length - 1)];
      return Response.json(status === "done"
        ? { status, model: "grok-imagine-video-1.5", video: { url, duration: 5, respect_moderation: true } }
        : { status });
    }
    if (target === videoUrl || target === url) {
      return new Response(media, { headers: { "content-type": contentType } });
    }
    throw new Error(`Unexpected mock URL: ${target}`);
  };
  return calls;
}

test("polls pending/done and downloads the provider MP4 without credentials", async () => {
  assert.equal(isNativeChatVideoConfigured(), true);
  assert.equal(NATIVE_CHAT_VIDEO_COST_USD, 0.4);
  assert.equal(NATIVE_CHAT_VIDEO_MIN_CREDITS, 889);
  const calls = stubResponses({ statuses: ["pending", "done"] });
  const result = await requestNativeChatVideo("A horse running across a field");
  assert.deepEqual(result.video, mp4);
  assert.equal(result.mimeType, "video/mp4");
  assert.equal(result.model, "grok-imagine-video-1.5");
  assert.equal(result.durationSeconds, 5);
  assert.deepEqual(calls.map(({ target }) => target), [
    "https://api.x.ai/v1/videos/generations",
    "https://api.x.ai/v1/videos/safe_request-123",
    "https://api.x.ai/v1/videos/safe_request-123",
    videoUrl,
  ]);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    model: "grok-imagine-video-1.5",
    prompt: "A horse running across a field",
    duration: 5,
    aspect_ratio: "16:9",
    resolution: "480p",
  });
  assert.equal(calls.every(({ init }) => init.redirect === "error"), true);
  assert.equal(calls.at(-1).init.headers, undefined);
});

test("failed provider status never starts a media download", async () => {
  const calls = stubResponses({ statuses: ["failed"] });
  await assert.rejects(requestNativeChatVideo("A scenic mountainside"), /generation failed/);
  assert.equal(calls.length, 2);
});

test("rejects off-domain, lookalike, insecure, and credentialed output URLs", async () => {
  for (const url of [
    "http://vidgen.x.ai/video.mp4",
    "https://vidgen.x.ai.evil.example/video.mp4",
    "https://127.0.0.1/video.mp4",
    "https://user:pass@vidgen.x.ai/video.mp4",
    "https://vidgen.x.ai:8443/video.mp4",
  ]) {
    const calls = stubResponses({ url });
    await assert.rejects(requestNativeChatVideo("A scenic mountainside"), /permitted host/);
    assert.equal(calls.length, 2, `must not download ${url}`);
  }
});

test("rejects malformed MP4 bytes and incorrect media content type", async () => {
  stubResponses({ media: Buffer.from("not an mp4 at all") });
  await assert.rejects(requestNativeChatVideo("A scenic mountainside"), /invalid MP4/);
  stubResponses({ contentType: "text/html" });
  await assert.rejects(requestNativeChatVideo("A scenic mountainside"), /did not return MP4/);
});

test("pre-aborted request does not call fetch", async () => {
  const calls = stubResponses();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(requestNativeChatVideo("A scenic mountainside", controller.signal), /abort/i);
  assert.equal(calls.length, 0);
});

test("unconfigured and invalid prompts fail before any paid API call", async () => {
  const calls = stubResponses();
  delete process.env.XAI_API_KEY;
  assert.equal(isNativeChatVideoConfigured(), false);
  await assert.rejects(requestNativeChatVideo("A scenic mountainside"), /not configured/);
  process.env.XAI_API_KEY = "unit-test-only-not-a-real-key";
  await assert.rejects(requestNativeChatVideo("x"), /prompt/);
  await assert.rejects(requestNativeChatVideo("x".repeat(4001)), /prompt/);
  assert.equal(calls.length, 0);
});