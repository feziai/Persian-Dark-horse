import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const outfile = new URL("../../.local/chat-media-intent-tests.mjs", import.meta.url);
await build({
  entryPoints: [new URL("./chat-media-intent.ts", import.meta.url).pathname],
  outfile: outfile.pathname, bundle: true, platform: "node", format: "esm", logLevel: "silent",
});
const { resolveChatMediaIntent: intent, inlineMediaAccess: access } = await import(outfile.href);

test("English and Persian media requests classify without relying on agent identity", () => {
  for (const agent of ["fezi", "monicah", "custom_123", "app:claude"]) {
    assert.equal(intent("Creat image of two guys running", [])?.type, "image", agent);
    assert.equal(intent("Make image of a blue mountain", [])?.type, "image", agent);
    assert.equal(intent("Can you create an image of two guys running?", [])?.type, "image", agent);
    assert.equal(intent("Could you make a video of a running horse?", [])?.type, "video", agent);
    assert.equal(intent("یک تصویر از کوه برفی بساز", [])?.type, "image", agent);
    assert.equal(intent("Generate video of a running horse", [])?.type, "video", agent);
    assert.equal(intent("فیلم از اسب در حال دویدن بساز", [])?.type, "video", agent);
  }
});

test("short follow-ups reuse explicit user subjects, never assistant instructions", () => {
  const turns = ["Create image of two guys running"];
  for (const followUp of ["Creat now", "بساز", "عکسو بفرست", "Send me a picture"]) {
    assert.deepEqual(intent(followUp, turns), { type: "image", prompt: turns[0] });
  }
  assert.deepEqual(intent("Send me a picture", []), { type: "clarify", mediaType: "image" });
  assert.deepEqual(intent("Create image", []), { type: "clarify", mediaType: "image" });
  assert.deepEqual(intent("Creat now", []), { type: "clarify", mediaType: "image" });
  assert.deepEqual(intent("Creat now", ["Make image", "Two guys running"]), { type: "image", prompt: "Two guys running" });
  assert.deepEqual(intent("Creat now", ["Write a prompt for an image of two guys running"]),
    { type: "image", prompt: "two guys running" });
  assert.deepEqual(intent("بساز", ["پرامپت عکس دو مرد در حال دویدن"]),
    { type: "image", prompt: "دو مرد در حال دویدن" });
  assert.deepEqual(intent("Creat now", ["Write a prompt for an image", "Two guys running"]),
    { type: "image", prompt: "Two guys running" });
  assert.equal(intent("Write a prompt for an image of two guys running", []), null);
  assert.equal(intent("پرامپت عکس دو مرد در حال دویدن", []), null);
  assert.equal(intent("Creat now", ["Write a prompt for an image of two guys running", "Do not generate this image"]), null);
});

test("negation, quotations, how-to, and prompt-writing are not provider calls", () => {
  for (const text of [
    "Don't create an image of a dog", "How to make an image of a dog?",
    "Write a prompt to make a picture of a dog", "Explain how to generate video",
    "Can this model create images?", "Could this AI make a video?",
    "«بساز یک تصویر»", "تصویر از درخت نساز", "پرامپت ساخت عکس از گربه",
  ]) assert.equal(intent(text, []), null, text);
  assert.equal(intent("Creat now", ["Don't create an image of a dog"]), null);
});

test("subscription and media credits are mandatory regardless of agent", () => {
  for (const agent of ["fezi", "arta", "custom_123", "app:openai"]) {
    assert.equal(access(false, 99999, 889), "SUBSCRIPTION_REQUIRED", agent);
    assert.equal(access(true, 888, 889), "CREDITS_EXHAUSTED", agent);
    assert.equal(access(true, 889, 889), null, agent);
  }
});