export type ChatMediaIntent = { type: "image" | "video"; prompt: string } | { type: "clarify"; mediaType: "image" | "video" } | null;

const requestVerb = /(?:\b(?:create|creat|generate|make|draw|paint|render|produce|show|send|give|build)\b|بساز|بکش|بفرست|درست کن|تولید کن|نشون بده|نشان بده)/iu;
const imageNoun = /(?:\b(?:image|picture|photo|illustration|artwork|drawing)\b|عکس|تصویر|نقاشی)/iu;
const videoNoun = /(?:\b(?:video|clip|movie|animation)\b|ویدیو|فیلم|کلیپ|انیمیشن)/iu;
const continuation = /^(?:creat(?:e)? now|make (?:it|one|that|this)(?: now)?|do it(?: now)?|send (?:it|me (?:(?:the|a) )?(?:picture|image|photo|video|clip))|(?:همونو|همان را|همین رو|این رو|اونو|اون رو)?\s*(?:بساز|بفرست|درست کن|نشون بده|نشان بده)(?:\s*(?:الان|حالا|لطفا))?|عکسو بفرست|فیلمو بفرست)[.!؟\s]*$/iu;
const negative = /(?:\b(?:do not|don't|dont|never|no need to|without|instead of|how (?:do|can|to)|teach me|explain|write (?:a |the )?prompt|prompt for|instructions for)\b|نساز|نکش|نفرست|نمیخوام|نمی‌خوام|چطور|چگونه|آموزش|پرامپت|راهنما)/iu;
const hardNegation = /(?:\b(?:do not|don't|dont|never|no need to|without)\b|نساز|نکش|نفرست|نمیخوام|نمی‌خوام)/iu;
const promptWriting = /(?:\b(?:write|draft|give|make)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:image\s+|video\s+)?prompt\b|پرامپت)/iu;
const unsafeQuote = /["“”«»`]/u;

function subjectOf(message: string, type: "image" | "video"): string | null {
  const noun = type === "image" ? imageNoun : videoNoun;
  const cleaned = message.replace(/^[\s.!?؟]+|[\s.!?؟]+$/gu, "");
  if (cleaned.length < 3 || continuation.test(cleaned)) return null;
  const subject = cleaned
    .replace(/^(?:(?:please|can you|could you|would you|لطفا|لطفاً)\s*)+/iu, "")
    .replace(/^(?:creat(?:e)?|generate|make|draw|paint|render|produce|show|send|give|build)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:image|picture|photo|illustration|artwork|drawing|video|clip|movie|animation)(?:\s+(?:of|about|showing|with|from))?\s*/iu, "")
    .replace(/^(?:عکس|تصویر|فیلم|ویدیو|کلیپ)(?:ی)?\s*(?:از|درباره)?\s*/u, "")
    .replace(/(?:رو|را)\s*(?:بساز|بکش|بفرست|درست کن|تولید کن)\s*$/u, "")
    .trim();
  if (!subject || subject === cleaned && noun.test(cleaned) && cleaned.length < 23) return null;
  return cleaned;
}

/** Only first-party user turns are inspected. Never pass attachment text or agent output here. */
export function resolveChatMediaIntent(message: string, previousUserTurns: string[]): ChatMediaIntent {
  const text = message.trim();
  if (!text || negative.test(text) || unsafeQuote.test(text) || /^(?:what|why|when|where|is|are|آیا|چیست|یعنی)/iu.test(text)) return null;
  if (/^(?:can|could|would)\b/iu.test(text)
    && !/^(?:can|could|would)\s+you\s+(?:please\s+)?(?:creat(?:e)?|generate|make|draw|paint|render|produce|show|send|give|build)\b/iu.test(text)) return null;
  const explicitType = videoNoun.test(text) ? "video" : imageNoun.test(text) ? "image" : null;
  const shortFollowUp = continuation.test(text);
  if (!shortFollowUp && (!explicitType || !requestVerb.test(text))) return null;
  let type: "image" | "video" | null = explicitType;
  let prompt = subjectOf(text, type ?? "image");
  if (shortFollowUp) {
    let subjectTurn: string | null = null;
    for (const turn of [...previousUserTurns].reverse()) {
      // An earlier user-authored prompt brief is legitimate context for a
      // *later* explicit "create now"; a prohibition is not.
      if (hardNegation.test(turn)) return null;
      if (unsafeQuote.test(turn)) continue;
      const priorType: "image" | "video" | null = videoNoun.test(turn) ? "video" : imageNoun.test(turn) ? "image" : null;
      const priorPromptWriting = promptWriting.test(turn);
      if (!priorType || (!requestVerb.test(turn) && !priorPromptWriting)) {
        if (!subjectTurn && !priorType && turn.trim().length >= 3 && turn.length <= 4000 && !/[?؟]/u.test(turn)) subjectTurn = turn.trim();
        continue;
      }
      const priorSubject = priorPromptWriting
        ? subjectOf(turn
          .replace(/^(?:write|draft|give|make)\s+(?:me\s+)?(?:an?\s+|the\s+)?(?:image\s+|video\s+)?prompt\s+(?:for|about)\s+(?:an?\s+|the\s+)?/iu, "")
          .replace(/^(?:یک\s+)?پرامپت\s*(?:برای\s*)?/u, "")
          .replace(/^(?:an?\s+|the\s+)?(?:image|picture|photo|video|clip|movie)(?:\s+(?:of|about|showing))?\s*/iu, "")
          .replace(/^(?:عکس|تصویر|ویدیو|فیلم|کلیپ)(?:ی)?\s*(?:از)?\s*/u, ""), priorType)
        : subjectOf(turn, priorType);
      type ??= priorType;
      prompt = subjectTurn ?? priorSubject;
      if (prompt) break;
    }
  }
  if (!type) return shortFollowUp ? { type: "clarify", mediaType: "image" } : null;
  return prompt ? { type, prompt } : { type: "clarify", mediaType: type };
}

export function inlineMediaAccess(activeSubscription: boolean, availableCredits: number, requiredCredits: number):
  | "SUBSCRIPTION_REQUIRED" | "CREDITS_EXHAUSTED" | null {
  if (!activeSubscription) return "SUBSCRIPTION_REQUIRED";
  if (!Number.isFinite(availableCredits) || availableCredits < requiredCredits) return "CREDITS_EXHAUSTED";
  return null;
}