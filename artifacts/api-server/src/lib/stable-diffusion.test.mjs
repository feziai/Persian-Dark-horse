import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import sharp from "sharp";

const originalKey = process.env.HUGGINGFACE_API_KEY;
const originalFetch = globalThis.fetch;
const model = "stabilityai/stable-diffusion-xl-base-1.0";
const mappingUrl = `https://huggingface.co/api/models/${model}?expand[]=inferenceProviderMapping`;
const routerUrl = "https://router.huggingface.co/fal-ai/fal-ai/fast-sdxl";
const cdnUrl = "https://v3.fal.media/files/mock/image.png";
const compiled = await build({
  entryPoints: [new URL("./stable-diffusion.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  logLevel: "silent",
});
const { requestStableDiffusionImage, isStableDiffusionAvailable, isStableDiffusionConfigured } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString("base64")}`);

// A real, encoded image generated locally. No external service or paid inference is called.
const pixels = Buffer.alloc(32 * 32 * 3);
for (let i = 0; i < pixels.length; i++) pixels[i] = i * 37 % 256;
const png = await sharp(pixels, { raw: { width: 32, height: 32, channels: 3 } }).png().toBuffer();
assert.ok(png.length >= 100);

function liveMapping() {
  return { id: model, inferenceProviderMapping: {
    "fal-ai": { status: "live", task: "text-to-image", providerId: "fal-ai/fast-sdxl" },
    together: { status: "error", task: "text-to-image", providerId: model },
  } };
}

test("SDXL adapter validates mapping and actual CDN image, with no other model route", async (t) => {
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.HUGGINGFACE_API_KEY;
    else process.env.HUGGINGFACE_API_KEY = originalKey;
  });
  delete process.env.HUGGINGFACE_API_KEY;
  assert.equal(isStableDiffusionAvailable(), false);
  assert.equal(isStableDiffusionConfigured(), false);
  let calls = [];
  globalThis.fetch = async (...args) => {
    calls.push(args);
    throw new Error("An unconfigured adapter made a request");
  };
  await assert.rejects(requestStableDiffusionImage("horse"), /unavailable/);
  assert.equal(calls.length, 0);

  process.env.HUGGINGFACE_API_KEY = "hf_mock_not_a_real_token";
  assert.equal(isStableDiffusionAvailable(), true);
  globalThis.fetch = async (url, options) => {
    calls.push([String(url), options]);
    if (String(url) === mappingUrl) return Response.json(liveMapping());
    if (String(url) === routerUrl)
      return Response.json({ images: [{ url: cdnUrl }] });
    if (String(url) === cdnUrl)
      return new Response(png, { headers: { "content-type": "image/png" } });
    throw new Error(`Unexpected endpoint: ${url}`);
  };
  calls = [];
  const image = await requestStableDiffusionImage("  a horse in a field  ");
  assert.equal(image.model, model);
  assert.equal(image.mimeType, "image/png");
  assert.deepEqual(Buffer.from(image.imageBase64, "base64"), png);
  assert.deepEqual(calls.map(([url]) => url), [mappingUrl, routerUrl, cdnUrl]);
  assert.deepEqual(JSON.parse(calls[1][1].body), { prompt: "a horse in a field" });
  assert.equal(calls[1][1].headers.authorization, `Bearer ${process.env.HUGGINGFACE_API_KEY}`);
  assert.ok(calls.every(([, options]) => options.signal && options.redirect === "error"));

  calls = [];
  await assert.rejects(requestStableDiffusionImage("horse", png.toString("base64"), "image/png"), /reference images are not supported/);
  assert.equal(calls.length, 0);
  await assert.rejects(requestStableDiffusionImage(" "), /prompt/);
  assert.equal(calls.length, 0);

  for (const invalidMapping of [
    { inferenceProviderMapping: {} },
    { inferenceProviderMapping: { "fal-ai": { ...liveMapping().inferenceProviderMapping["fal-ai"], status: "error" } } },
    { inferenceProviderMapping: { "fal-ai": { ...liveMapping().inferenceProviderMapping["fal-ai"], task: "image-to-image" } } },
    { inferenceProviderMapping: { "fal-ai": { ...liveMapping().inferenceProviderMapping["fal-ai"], providerId: "black-forest-labs/FLUX.1" } } },
  ]) {
    calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push([String(url), options]);
      if (String(url) === mappingUrl) return Response.json(invalidMapping);
      throw new Error("Unexpected generation/fallback call");
    };
    await assert.rejects(requestStableDiffusionImage("horse"), /no live fal-ai text-to-image provider mapping/);
    assert.deepEqual(calls.map(([url]) => url), [mappingUrl]);
  }

  const failureScenarios = [
    { name: "provider error", generation: Response.json({ error: "unavailable" }, { status: 503 }), error: /generation failed \(503\)/ },
    { name: "missing image", generation: Response.json({ images: [] }), error: /did not return an image/ },
    { name: "foreign URL", generation: Response.json({ images: [{ url: "https://example.com/image.png" }] }), error: /untrusted image URL/ },
    { name: "local URL", generation: Response.json({ images: [{ url: "http://127.0.0.1/image.png" }] }), error: /untrusted image URL/ },
    { name: "incorrect content type", generation: Response.json({ images: [{ url: cdnUrl }] }), image: new Response(png, { headers: { "content-type": "text/plain" } }), error: /invalid image type/ },
    { name: "non-image bytes", generation: Response.json({ images: [{ url: cdnUrl }] }), image: new Response(Buffer.alloc(150), { headers: { "content-type": "image/png" } }), error: /invalid image type/ },
    { name: "oversized image", generation: Response.json({ images: [{ url: cdnUrl }] }), image: new Response(Buffer.alloc(12 * 1024 * 1024 + 1), { headers: { "content-type": "image/png" } }), error: /exceeds size limit/ },
  ];
  for (const scenario of failureScenarios) {
    calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push([String(url), options]);
      if (String(url) === mappingUrl) return Response.json(liveMapping());
      if (String(url) === routerUrl) return scenario.generation.clone();
      if (String(url) === cdnUrl && scenario.image) return scenario.image.clone();
      throw new Error(`Unexpected fallback for ${scenario.name}: ${url}`);
    };
    await assert.rejects(requestStableDiffusionImage("horse"), scenario.error, scenario.name);
    assert.deepEqual(calls.map(([url]) => url), scenario.image
      ? [mappingUrl, routerUrl, cdnUrl]
      : [mappingUrl, routerUrl], scenario.name);
  }
});