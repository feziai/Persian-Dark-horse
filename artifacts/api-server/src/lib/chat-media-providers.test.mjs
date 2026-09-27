import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

for (const name of ["stable-diffusion", "native-chat-video"]) {
  await build({
    entryPoints: [new URL(`./${name}.ts`, import.meta.url).pathname],
    outfile: new URL(`../../.local/mock-${name}.mjs`, import.meta.url).pathname,
    bundle: true, platform: "node", format: "esm", logLevel: "silent",
  });
}
const sd = await import(new URL("../../.local/mock-stable-diffusion.mjs", import.meta.url).href);
const native = await import(new URL("../../.local/mock-native-chat-video.mjs", import.meta.url).href);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(100)]);
const mp4 = Buffer.from([0, 0, 0, 16, 102, 116, 121, 112, 105, 115, 111, 109]);

test("Stable Diffusion rejects missing credentials, references, invalid mappings and external URLs before fetching media", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.HUGGINGFACE_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.HUGGINGFACE_API_KEY; else process.env.HUGGINGFACE_API_KEY = originalKey; });
  delete process.env.HUGGINGFACE_API_KEY;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Unexpected network call"); };
  assert.equal(sd.isStableDiffusionConfigured(), false);
  await assert.rejects(sd.requestStableDiffusionImage("a landscape"), /token is not configured/u);
  assert.equal(requests, 0);
  process.env.HUGGINGFACE_API_KEY = "hf_mock_not_real";
  await assert.rejects(sd.requestStableDiffusionImage("a landscape", "dGVzdA==", "image/png"), /reference images are not supported/u);
  assert.equal(requests, 0);
  globalThis.fetch = async () => { requests++; return Response.json({ inferenceProviderMapping: {} }); };
  await assert.rejects(sd.requestStableDiffusionImage("a landscape"), /no live fal-ai/u);
  assert.equal(requests, 1);
  requests = 0;
  globalThis.fetch = async (_url, options) => {
    requests++;
    assert.equal(options.redirect, "error");
    return requests === 1
      ? Response.json({ inferenceProviderMapping: { "fal-ai": { status: "live", task: "text-to-image", providerId: "fal-ai/mock-model" } } })
      : Response.json({ images: [{ url: "https://example.com/unsafe.png" }] });
  };
  await assert.rejects(sd.requestStableDiffusionImage("a landscape"), /untrusted image URL/u);
  assert.equal(requests, 2, "untrusted CDN URLs are never fetched");
});

test("Stable Diffusion mock serves validated image bytes without paid provider calls", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.HUGGINGFACE_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.HUGGINGFACE_API_KEY; else process.env.HUGGINGFACE_API_KEY = originalKey; });
  process.env.HUGGINGFACE_API_KEY = "hf_mock_not_real";
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return Response.json({ inferenceProviderMapping: { "fal-ai": { status: "live", task: "text-to-image", providerId: "fal-ai/mock-model" } } });
    if (calls.length === 2) return Response.json({ images: [{ url: "https://fal.media/test.png" }] });
    return new Response(png, { headers: { "content-type": "image/png" } });
  };
  const result = await sd.requestStableDiffusionImage("a landscape");
  assert.equal(result.mimeType, "image/png");
  assert.deepEqual(Buffer.from(result.imageBase64, "base64"), png);
  assert.equal(calls.length, 3);
});

test("native video mock rejects missing key and untrusted CDN before any media download", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.XAI_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = originalKey; });
  delete process.env.XAI_API_KEY;
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error("Unexpected network call"); };
  await assert.rejects(native.requestNativeChatVideo("running horse"), /not configured/u);
  assert.equal(requests, 0);
  process.env.XAI_API_KEY = "mock-never-live";
  globalThis.fetch = async () => {
    requests++;
    return requests === 1 ? Response.json({ request_id: "mock-id" })
      : Response.json({ status: "done", video: { url: "https://evil.example.com/video.mp4" } });
  };
  await assert.rejects(native.requestNativeChatVideo("running horse"), /outside the permitted host/u);
  assert.equal(requests, 2);
});

test("native video mock validates MP4 response shape without paid calls", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.XAI_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; if (originalKey === undefined) delete process.env.XAI_API_KEY; else process.env.XAI_API_KEY = originalKey; });
  process.env.XAI_API_KEY = "mock-never-live";
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return Response.json({ request_id: "mock-id" });
    if (calls.length === 2) return Response.json({ status: "done", video: { url: "https://vidgen.x.ai/mock.mp4", duration: 5 } });
    return new Response(mp4, { headers: { "content-type": "video/mp4" } });
  };
  const result = await native.requestNativeChatVideo("running horse");
  assert.equal(result.mimeType, "video/mp4");
  assert.equal(result.durationSeconds, 5);
  assert.deepEqual(result.video, mp4);
  assert.equal(calls.length, 3);
});