export function stripChatTransportArtifacts(value: string) {
  return value
    .replace(/user\s*:\s*safeAttached\s+image\b[^\r\n]*/giu, "")
    .replace(/safeAttached\s+image\b[^\r\n]*/giu, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function containsPersianText(value: string) {
  return /[\u0600-\u06ff]/u.test(value);
}

export function chatResponseNeedsRepair(userMessage: string, response: string) {
  const cleanResponse = stripChatTransportArtifacts(response);
  if (cleanResponse.length < 8) return true;
  if (/safeAttached|user\s*:\s*|(?:provider|api|service)\s+(?:error|unavailable|failed|timed?\s*out)/iu.test(cleanResponse)) return true;
  if (/^(?:error|failed|unavailable|temporarily unavailable|request failed)\b/iu.test(cleanResponse)) return true;
  if (userMessage.length > 120 && cleanResponse.length < 40) return true;
  if (containsPersianText(userMessage) && userMessage.length > 24 && !containsPersianText(cleanResponse)) return true;
  return false;
}

export function chatContinuityMessage(userMessage: string, hasAttachments: boolean) {
  if (containsPersianText(userMessage)) {
    return hasAttachments
      ? "فایل پیوست‌شده دریافت شد، اما این بار نتوانستم آن را با اطمینان بررسی کنم. اعتباری برای این پاسخ کسر نشد؛ دوباره تلاش کنید یا متن بخش مهم را اینجا بفرستید."
      : "این بار نتوانستم پاسخ قابل‌اعتمادی آماده کنم. اعتباری کسر نشد؛ کمی بعد دوباره تلاش کنید یا درخواستتان را دقیق‌تر بنویسید.";
  }
  return hasAttachments
    ? "I received the attached file, but could not analyze it reliably this time. No Credits were charged for this reply. Try again, or paste the part you want me to review."
    : "I could not prepare a reliable answer this time. No Credits were charged for this reply. Please try again shortly or make your request more specific.";
}