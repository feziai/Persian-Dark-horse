import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

// Bundle workspace TypeScript exactly as the service does; no live API calls.
const output = new URL("../../.local/failover-tests.mjs", import.meta.url);
await build({
  entryPoints: [new URL("../routes/fezi-data.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["pino"],
  banner: { js: "import { createRequire as testRequire } from 'node:module'; const require = testRequire(import.meta.url);" },
  logLevel: "silent",
});
const { agents, createProviderAttempts, generateAgentReply } = await import(output.href);

test("a failed provider is replaced without changing the built-in agent's identity", async () => {
  const originalFetch = globalThis.fetch;
  process.env.DEEPSEEK = "test-only";
  process.env.OPENAI_API_KEY = "test-only";
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    const body = JSON.parse(options.body);
    const systemText = body.messages?.[0]?.content ?? body.systemInstruction?.parts?.[0]?.text;
    assert.ok(systemText.includes(agents[0].personality.roleEn));
    if (String(url).includes("generativelanguage") || String(url).includes("ollama")) return new Response("{}", { status: 400 });
    if (String(url).includes("deepseek")) return new Response("{}", { status: 401 });
    return Response.json({ choices: [{ message: { content: "پاسخ واقعی از سرویس جایگزین" } }] });
  };
  try {
    assert.deepEqual(createProviderAttempts(agents[0], "سلام").slice(0, 2).map((item) => item.name), ["gemini", "ollama"]);
    assert.ok(createProviderAttempts(agents[0], "سلام").findIndex((item) => item.name === "qwen") > createProviderAttempts(agents[0], "سلام").findIndex((item) => item.name === "openai"));
    assert.ok(createProviderAttempts(agents[0], "سلام").some((item) => item.name === "openai"));
    const result = await generateAgentReply(agents[0], "سلام، یک پاسخ بده");
    assert.equal(result.provider, "openai");
    assert.equal(calls.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("custom agent knowledge survives failure of its selected model", async () => {
  const originalFetch = globalThis.fetch;
  process.env.OPENROUTER_API_KEY = "test-only";
  const custom = {
    ...agents[0],
    id: "custom_test",
    name: "Test Agent",
    personality: { ...agents[0].personality, roleEn: "Reference knowledge: test-product is a blue notebook." },
  };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(String(url));
    assert.ok(JSON.parse(options.body).messages[0].content.includes("test-product is a blue notebook"));
    if (String(url).includes("openrouter")) return new Response("{}", { status: 503 });
    return Response.json({ choices: [{ message: { content: "The product is a blue notebook." } }] });
  };
  try {
    const result = await generateAgentReply(custom, "What is test-product?", "openrouter/free");
    assert.notEqual(result.provider, "openrouter-selected");
    assert.ok(calls.length >= 2);
    assert.match(result.message, /blue notebook/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});