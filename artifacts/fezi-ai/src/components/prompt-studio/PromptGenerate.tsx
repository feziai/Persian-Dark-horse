import { useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '@clerk/react';
import { useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Check, Copy, Globe2, Image as ImageIcon, Send, Sparkles, Video } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { requestGuestAccount } from '../../lib/auth-gate';
import { generateStudioPrompt, PromptStudioActionError, type GeneratePromptResult } from '../../lib/prompt-studio-actions';
import { Button } from '../ui-parts';

export default function PromptGenerate() {
  const { isRtl } = useTranslation();
  const { isSignedIn, getToken } = useAuth();
  const [, setLocation] = useLocation();
  const [kind, setKind] = useState<'image' | 'video'>('image');
  const [model, setModel] = useState('');
  const [brief, setBrief] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [duration, setDuration] = useState('');
  const [result, setResult] = useState<GeneratePromptResult | null>(null);
  const [submittedBrief, setSubmittedBrief] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [copied, setCopied] = useState(false);
  const price = kind === 'image' ? 60 : 65;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending || !brief.trim()) return;
    if (!isSignedIn) {
      requestGuestAccount(isRtl ? 'برای ساخت پرامپت وارد حساب شوید.' : 'Sign in to generate a prompt.');
      return;
    }
    setPending(true);
    setError('');
    setCopyError('');
    setResult(null);
    setCopied(false);
    try {
      const next = await generateStudioPrompt({
        kind, brief: brief.trim(), language: isRtl ? 'fa' : 'en',
        ...(model.trim() ? { model: model.trim() } : {}),
        ...(websiteUrl.trim() ? { websiteUrl: websiteUrl.trim() } : {}),
        ...(kind === 'video' && duration ? { durationSeconds: Number(duration) } : {}),
      }, getToken);
      setResult(next);
      setSubmittedBrief(brief.trim());
    } catch (cause) {
      setError(cause instanceof PromptStudioActionError && cause.status === 402
        ? (isRtl ? 'اعتبار کافی نیست. برای ادامه اعتبار خود را افزایش دهید.' : 'Not enough credits. Add credits to continue.')
        : (isRtl ? 'ساخت پرامپت انجام نشد. دوباره تلاش کنید؛ اعتباری برای این تلاش نمایش داده نمی‌شود.' : 'Could not generate a prompt. Please try again.'));
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopyError(isRtl ? 'کپی انجام نشد. متن را به‌صورت دستی انتخاب کنید.' : 'Copy failed. You can select the text manually.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-10">
      <div className="flex items-center gap-3">
        <Button data-testid="button-back-gallery" variant="ghost" size="sm" onClick={() => setLocation('/prompt-studio')} aria-label={isRtl ? 'بازگشت به گالری' : 'Back to gallery'}>
          {isRtl ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
        </Button>
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">PROMPT STUDIO / GENERATE</span>
      </div>

      <div className="rounded-[1.75rem] border border-primary/20 bg-[radial-gradient(circle_at_85%_0%,hsl(var(--primary)/.16),transparent_48%)] px-5 py-7 sm:px-9 sm:py-10">
        <div className="flex items-center gap-2 text-primary"><Sparkles size={17} /><span className="text-xs font-semibold">{isRtl ? 'ایده تا پرامپت' : 'Idea to prompt'}</span></div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">{isRtl ? 'ایده‌ات را بگو. جزئیاتش با ما.' : 'Start with a thought. Leave with a shot.'}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">{isRtl ? 'یک توضیح کوتاه کافی است. مدل تصویر یا ویدیوی دلخواهتان را بنویسید؛ اگر هنوز مدلی انتخاب نکرده‌اید، خالی بگذارید. پرامپت تصویر یا سناریوی ویدیویی ثانیه‌به‌ثانیه دریافت کنید.' : 'A short brief is enough. Name your preferred image or video model, or leave it blank if undecided. Get an image prompt or a second-by-second video direction.'}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><Sparkles size={17} /></div>
              <div><p className="font-semibold">{isRtl ? 'چه چیزی می‌سازیم؟' : 'What are we making?'}</p><p className="mt-1 text-xs text-muted-foreground">{isRtl ? 'فقط چند جزئیات، بدون پرسش‌های اضافه.' : 'Just the essentials. No long questionnaire.'}</p></div>
            </div>
            <form onSubmit={submit} className="space-y-5">
              <fieldset disabled={pending} className="space-y-5">
                <div className="grid grid-cols-2 gap-2" role="group" aria-label={isRtl ? 'نوع پرامپت' : 'Prompt type'}>
                  {(['image', 'video'] as const).map(option => {
                    const Icon = option === 'image' ? ImageIcon : Video;
                    return <button data-testid={`button-kind-${option}`} type="button" key={option} aria-pressed={kind === option} onClick={() => setKind(option)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors ${kind === option ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:border-primary/40'}`}><Icon size={17} />{option === 'image' ? (isRtl ? 'تصویر' : 'Image') : (isRtl ? 'ویدیو' : 'Video')}</button>;
                  })}
                </div>
                <label className="block space-y-2"><span className="text-sm font-medium">{isRtl ? 'نام مدل' : 'Model name'} <span className="text-xs font-normal text-muted-foreground">({isRtl ? 'اختیاری' : 'optional'})</span></span><input data-testid="input-model" value={model} onChange={e => setModel(e.target.value)} maxLength={120} placeholder={isRtl ? 'مثلاً Midjourney یا Veo' : 'e.g. Midjourney or Veo'} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" dir="auto" /></label>
                <label className="block space-y-2"><span className="text-sm font-medium">{isRtl ? 'ایدهٔ کوتاه شما' : 'Your brief'} <span className="text-primary">*</span></span><textarea data-testid="input-brief" required value={brief} onChange={e => setBrief(e.target.value)} maxLength={4000} rows={4} placeholder={isRtl ? 'مثلاً: یک عطر روی سنگ مرمر، نور صبح، حس مجلهٔ مد...' : 'e.g. A perfume bottle on marble, morning light, editorial mood...'} className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none focus:border-primary" dir="auto" /></label>
                <label className="block space-y-2"><span className="text-sm font-medium">{isRtl ? 'نشانی سایت' : 'Website URL'} <span className="text-xs font-normal text-muted-foreground">({isRtl ? 'اختیاری' : 'optional'})</span></span><input data-testid="input-website" type="url" value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://example.com" className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" dir="ltr" /></label>
                {kind === 'video' && <label className="block space-y-2"><span className="text-sm font-medium">{isRtl ? 'مدت ویدیو (۴ تا ۶۰ ثانیه)' : 'Video duration (4–60 seconds)'} <span className="text-xs font-normal text-muted-foreground">({isRtl ? 'اختیاری' : 'optional'})</span></span><input data-testid="input-duration" type="number" min="4" max="60" step="1" value={duration} onChange={e => setDuration(e.target.value)} placeholder={isRtl ? 'مثلاً ۱۵' : 'e.g. 15'} className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" dir="ltr" /></label>}
              </fieldset>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <span className="text-xs text-muted-foreground">{isRtl ? `هزینهٔ هر ساخت: ${price} اعتبار` : `${price} credits per generation`}</span>
                <Button data-testid="button-generate-prompt" type="submit" disabled={pending || !brief.trim()} className="min-h-11 gap-2">{pending ? <span className="inline-block h-4 w-4 animate-pulse rounded bg-primary-foreground/50" /> : <Send size={16} />}{pending ? (isRtl ? 'در حال ساخت...' : 'Generating...') : (isRtl ? 'ساخت پرامپت' : 'Generate prompt')}</Button>
              </div>
            </form>
          </div>
          {error && <div data-testid="status-generate-error" role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error} {error.includes(isRtl ? 'اعتبار کافی' : 'Not enough') && <button data-testid="button-open-billing" type="button" onClick={() => setLocation('/billing')} className="ms-2 font-semibold underline">{isRtl ? 'مشاهدهٔ اعتبار' : 'View billing'}</button>}</div>}
          {pending && <div role="status" className="space-y-3 rounded-2xl border border-border bg-surface p-6"><div className="h-3 w-28 animate-pulse rounded bg-primary/20" /><div className="h-4 w-4/5 animate-pulse rounded bg-muted" /><div className="h-4 w-3/5 animate-pulse rounded bg-muted" /></div>}
          {result && <section data-testid="section-generated-prompt" aria-live="polite" className="overflow-hidden rounded-2xl border border-primary/30 bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><p className="text-sm font-semibold">{isRtl ? 'پرامپت آماده است' : 'Your prompt is ready'}</p><p className="mt-1 text-xs text-muted-foreground">{isRtl ? `${result.creditsUsed} اعتبار مصرف شد · مانده: ${result.remainingCredits}` : `${result.creditsUsed} credits used · ${result.remainingCredits} remaining`}</p></div><Button data-testid="button-copy-generated" variant="secondary" size="sm" onClick={copy} className="gap-2">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? (isRtl ? 'کپی شد' : 'Copied') : (isRtl ? 'کپی رایگان' : 'Copy again, free')}</Button></div>
            <div className="px-5 py-5"><p className="mb-4 text-xs text-muted-foreground">{isRtl ? 'براساس ایدهٔ شما:' : 'From your brief:'} <span dir="auto" className="text-foreground">{submittedBrief}</span></p><pre data-testid="text-generated-prompt" dir="auto" className="whitespace-pre-wrap break-words font-sans text-sm leading-8 text-foreground">{result.prompt}</pre>{result.websiteChecked && <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs text-muted-foreground"><Globe2 size={14} />{isRtl ? 'سایت بررسی شد' : 'Website checked'}{result.websiteTitle ? ` · ${result.websiteTitle}` : ''}</p>}</div>
          </section>}
          {copyError && <p role="alert" className="text-sm text-red-400">{copyError}</p>}
        </div>
        <aside className="h-fit rounded-2xl border border-border bg-surface/50 p-5 text-xs leading-6 text-muted-foreground">
          <p className="mb-3 font-semibold text-foreground">{isRtl ? 'پیش از ساخت' : 'Before you generate'}</p>
          <p>{isRtl ? 'تصویر: ۶۰ اعتبار' : 'Image: 60 credits'}</p><p>{isRtl ? 'ویدیو: ۶۵ اعتبار' : 'Video: 65 credits'}</p>
          <div className="mt-4 border-t border-border pt-4">{isRtl ? 'متن خروجی پس از ساخت بدون هزینهٔ دوباره قابل کپی است.' : 'Once generated, your result can be copied without another charge.'}</div>
        </aside>
      </div>
    </div>
  );
}