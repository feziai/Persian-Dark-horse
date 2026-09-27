import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const output = new URL("../../.local/chat-continuation-tests.mjs", import.meta.url);
await build({
  entryPoints: [new URL("../../../fezi-ai/src/lib/chat-continuation.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { attachedChatUnavailableMessage, fileAnalysisUnavailableMessage } = await import(output.href);

test("unavailable file analysis offers a relevant next step for every attachment type", () => {
  for (const [kind, fileName] of [
    ["image", "photo.png"],
    ["audio", "recording.wav"],
    ["video", "clip.mp4"],
    ["pdf", "report.pdf"],
    ["text", "notes.txt"],
    ["file", "archive-data.csv"],
  ]) {
    const message = fileAnalysisUnavailableMessage(fileName, kind, false);
    assert.ok(message.includes(fileName), `${kind} continuation should identify the file`);
    assert.match(message, /still attached/i, `${kind} continuation should preserve retry context`);
    assert.match(message, /continue/i, `${kind} continuation should offer a next step`);
    assert.doesNotMatch(message, /provider error|request failed/i);
  }
});

test("Persian and Chat attachment fallbacks explain how to continue without charge", () => {
  const persian = fileAnalysisUnavailableMessage("report.pdf", "pdf", true);
  assert.match(persian, /PDF/u);
  assert.match(persian, /دوباره تلاش کنید/u);
  const chatFallback = attachedChatUnavailableMessage(false);
  assert.match(chatFallback, /No Credits were charged/i);
  assert.match(chatFallback, /paste/i);
});