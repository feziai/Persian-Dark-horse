import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPromptCraftingMessage,
  isPromptCraftingRequest,
  isUsefulPromptResponse,
} from "./prompt-crafting.ts";

test("prompt requests reach the built-in creative and premium agents, but ordinary chat does not", () => {
  for (const agentId of ["monicah", "fezi", "arvin", "negar"]) {
    assert.equal(isPromptCraftingRequest(agentId, "پرامپت رو بهم بده"), true);
    assert.equal(isPromptCraftingRequest(agentId, "Create a prompt for a story"), true);
    assert.equal(isPromptCraftingRequest(agentId, "از اینجا ادامه بده"), false);
  }
  assert.equal(isPromptCraftingRequest("arta", "پرامپت رو بهم بده"), false);
  assert.equal(isPromptCraftingRequest("monicah", "پرامپت نمی‌خوام"), false);
});

test("a short follow-up carries the earlier user brief into a request for a finished prompt", () => {
  const brief = "چهار شخصیت نگار، FEZI، مانیکا و آروین در یک داستان سینمایی گروهی با هم روبه‌رو می‌شوند.";
  const request = buildPromptCraftingMessage("monicah", "پرامپت رو بهم بده", [brief, "باشه"]);
  assert.match(request, /PROMPT, not the finished story/);
  assert.match(request, /story\/video-generation prompt/);
  assert.match(request, /نگار، FEZI، مانیکا و آروین/);
  assert.match(request, /"پرامپت:"/);
  assert.match(request, /^PROMPT_CRAFTING_LANGUAGE=fa/u);
});

test("a generic acknowledgement or irrelevant refusal is not accepted as a prompt", () => {
  assert.equal(isUsefulPromptResponse("پیامت را گرفتم. بعداً ادامه می‌دهیم.", true), false);
  assert.equal(isUsefulPromptResponse("من نمی‌توانم این کار را انجام دهم.", true), false);
  assert.equal(isUsefulPromptResponse("پرامپت: من نمی‌توانم برای این چهار شخصیت یک داستان سینمایی بنویسم. لطفاً درخواست دیگری را برای من ارسال کن.", true), false);
  assert.equal(isUsefulPromptResponse(
    "پرامپت: داستانی سینمایی با چهار شخصیت نگار، FEZI، مانیکا و آروین بنویس. فضای داستان، تضاد شخصیت‌ها و پایان مشخص را به‌صورت صحنه‌ای توصیف کن.",
    true,
  ), true);
  assert.equal(isUsefulPromptResponse("Prompt: A detailed reusable story prompt with a four-character cast, cinematic tone, purposeful conflict, and a defined ending.", false), true);
});