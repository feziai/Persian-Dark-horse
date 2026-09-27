import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const output = new URL("../../.local/chat-response-quality-tests.mjs", import.meta.url);
await build({
  entryPoints: [new URL("./chat-response-quality.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { chatContinuityMessage, chatResponseNeedsRepair, stripChatTransportArtifacts } = await import(output.href);

test("transport metadata is stripped and never accepted as a standalone answer", () => {
  const clean = stripChatTransportArtifacts("Here is the summary.\nsafeAttached image [transport payload]");
  assert.equal(clean, "Here is the summary.");
  assert.equal(chatResponseNeedsRepair("Summarize the upload", clean), false);
  assert.equal(chatResponseNeedsRepair("Summarize the upload", "safeAttached image [transport payload]"), true);
});

test("ordinary healthy responses pass the fast guard", () => {
  assert.equal(chatResponseNeedsRepair("What is photosynthesis?", "Photosynthesis turns light into chemical energy."), false);
});

test("final failure continuations stay related and explicitly avoid charging", () => {
  assert.match(chatContinuityMessage("Explain this document", true), /attached file/i);
  assert.match(chatContinuityMessage("Explain this document", true), /No Credits were charged/i);
  assert.match(chatContinuityMessage("سلام، این فایل چیست؟", true), /فایل پیوست‌شده/);
  assert.match(chatContinuityMessage("سلام، این فایل چیست؟", true), /اعتباری.*کسر نشد/u);
});