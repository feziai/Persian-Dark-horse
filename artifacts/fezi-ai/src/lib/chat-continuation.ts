type AttachmentKind = 'image' | 'audio' | 'video' | 'pdf' | 'text' | 'file' | string;

function safeFileName(fileName: string) {
  return fileName.replace(/[<>\r\n]/g, '').slice(0, 120) || 'uploaded file';
}

export function fileAnalysisUnavailableMessage(fileName: string, kind: AttachmentKind, isRtl: boolean) {
  const name = safeFileName(fileName);
  const englishKind = kind === 'image' ? 'image' : kind === 'audio' ? 'audio file'
    : kind === 'video' ? 'video' : kind === 'pdf' ? 'PDF' : 'file';
  const persianKind = kind === 'image' ? 'تصویر' : kind === 'audio' ? 'فایل صوتی'
    : kind === 'video' ? 'ویدئو' : kind === 'pdf' ? 'PDF' : 'فایل';
  return isRtl
    ? `${persianKind} «${name}» دریافت شد، اما فعلاً نتوانستم آن را با اطمینان تحلیل کنم. فایل هنوز پیوست است؛ دوباره تلاش کنید یا بخش مهمش را اینجا بنویسید تا گفتگو ادامه پیدا کند.`
    : `I received your ${englishKind} “${name}”, but could not analyze it reliably right now. The file is still attached; retry or paste the important part here so we can continue.`;
}

export function attachedChatUnavailableMessage(isRtl: boolean) {
  return isRtl
    ? 'نتوانستم فایل پیوست‌شده را این بار تحلیل کنم. اعتباری کسر نشد؛ فایل برای تلاش دوباره پیوست شده است، یا می‌توانید متن بخش مهم را اینجا بفرستید.'
    : 'I could not analyze the attached file this time. No Credits were charged; the file is attached for another try, or you can paste the part you want me to review.';
}