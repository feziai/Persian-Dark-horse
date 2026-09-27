import { useEffect, useMemo, useState } from 'react';
import { Card, Button, Input, Textarea } from './ui-parts';
import { CalendarDays, Check, Copy, Diamond, ExternalLink, Gift, LoaderCircle, RefreshCw, Share2 } from 'lucide-react';
import { useTranslation } from '../lib/i18n';

type RewardTask = {
  id: string;
  slug: string;
  title: string;
  titleFa: string;
  description: string;
  descriptionFa: string;
  kind: string;
  rewardCredits: number;
  actionUrl: string | null;
  requiresManualReview: boolean;
  claim: { id: string; status: string; proofUrl?: string | null; proofText?: string | null } | null;
};

type RewardTaskResponse = {
  credits: number;
  creditsLimit: number;
  referralCode?: string | null;
  tasks: RewardTask[];
};

const SHARE_MESSAGE = 'Join me on Persian Dark Horse. We both get 500 credits when you sign up with my link.';

function taskLabel(task: RewardTask, isRtl: boolean) {
  return isRtl ? task.titleFa : task.title;
}

function taskDescription(task: RewardTask, isRtl: boolean) {
  return isRtl ? task.descriptionFa : task.description;
}

export function RewardTasks() {
  const { isRtl } = useTranslation();
  const [data, setData] = useState<RewardTaskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState('');
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [proofInputs, setProofInputs] = useState<Record<string, { profile: string; postUrl: string }>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch('/api/reward-tasks', { credentials: 'include' });
      const result = await response.json() as RewardTaskResponse & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Reward tasks are unavailable.');
      setData(result);
      setLastChecked(new Date());
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Reward tasks are unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    const onFocus = () => { void load(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const referralLink = useMemo(() => {
    const code = data?.referralCode;
    return code ? `${window.location.origin}${basePath}/referrals?ref=${code}` : '';
  }, [basePath, data?.referralCode]);
  const shareText = `${SHARE_MESSAGE}\n${referralLink}`;

  const claim = async (task: RewardTask, input: Record<string, string> = {}) => {
    setBusyTask(task.id);
    setError('');
    try {
      const response = await fetch(`/api/reward-tasks/${encodeURIComponent(task.id)}/claim`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The task could not be completed.');
      setProofInputs((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });
      await load(true);
    } catch (claimError) {
      setError(claimError instanceof Error ? claimError.message : 'The task could not be completed.');
    } finally {
      setBusyTask(null);
    }
  };

  const share = async (task: RewardTask) => {
    if (!referralLink) {
      setError(isRtl ? 'کد رفرال شما در دسترس نیست. صفحه را تازه‌سازی کنید.' : 'Your referral code is unavailable. Refresh to try again.');
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Persian Dark Horse', text: SHARE_MESSAGE, url: referralLink });
        await claim(task);
      } catch {
        // Closing the native share sheet is not an error and should not create a claim.
      }
      return;
    }
    setShareOpen(true);
  };

  const copyShareText = async (task?: RewardTask) => {
    try {
      if (!referralLink || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      if (task) {
        setShareOpen(false);
        await claim(task);
      }
    } catch {
      setError(isRtl ? 'کپی انجام نشد. متن را به‌صورت دستی از پنجرهٔ اشتراک‌گذاری کپی کنید.' : 'Could not copy. Select the text in the sharing dialog to copy it manually.');
    }
  };

  const copyReferralCode = async () => {
    if (!data?.referralCode) return;
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(isRtl ? 'کپی کردن کد انجام نشد.' : 'Could not copy the referral code.');
    }
  };

  if (loading) {
    return <Card className="flex items-center gap-3 text-sm text-muted-foreground"><LoaderCircle size={17} className="animate-spin text-primary" />{isRtl ? 'در حال بارگذاری پاداش‌ها…' : 'Loading free credit tasks…'}</Card>;
  }
  const completedCount = data?.tasks.filter((task) => task.claim?.status === 'completed').length ?? 0;
  const totalCount = data?.tasks.length ?? 0;
  const today = new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <section className="space-y-4">
      <Card className="relative overflow-hidden border-primary/25 bg-gradient-to-br from-primary/10 via-surface to-background">
        <div className="absolute -end-8 -top-8 h-28 w-28 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/35 bg-primary/10 text-primary shadow-[0_0_24px_rgba(229,185,90,0.18)]">
              <Diamond size={28} fill="currentColor" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{isRtl ? 'کیف الماس' : 'Diamond wallet'}</p>
              <p className="mt-1 text-3xl font-bold font-mono" dir="ltr">{data?.credits.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{isRtl ? 'کردیت قابل استفاده' : 'available credits'}</p>
            </div>
          </div>
          <div className="max-w-sm text-sm leading-6 text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground"><Gift size={16} className="text-primary" />{isRtl ? 'دریافت رایگان کردیت' : 'Get free credits'}</div>
            <p className="mt-1">{isRtl ? 'تسک‌ها را انجام دهید و پاداش هرکدام را در کیف الماس دریافت کنید.' : 'Complete tasks and receive each reward in your diamond wallet.'}</p>
          </div>
        </div>
      </Card>

      <Card>
        {data?.referralCode && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{isRtl ? 'کد رفرال شما (بدون نیاز به تأیید Google)' : 'Your referral code (no Google verification needed)'}</p>
              <p dir="ltr" className="mt-1 font-mono text-lg font-semibold tracking-widest text-primary" data-testid="text-reward-referral-code">{data.referralCode}</p>
            </div>
            <Button type="button" size="sm" data-testid="button-copy-reward-referral-code" onClick={() => void copyReferralCode()}><Copy size={14} />{copied ? (isRtl ? 'کپی شد' : 'Copied') : (isRtl ? 'کپی کد' : 'Copy code')}</Button>
            <a href={`${basePath}/referrals`} className="text-xs font-semibold text-primary hover:underline" data-testid="link-reward-referral-dashboard">{isRtl ? 'نمایش لینک و نمودار' : 'View link and chart'}</a>
          </div>
        )}
        <div className="mb-5 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"><CalendarDays size={14} />{isRtl ? 'فرصت‌های امروز' : "Today's opportunities"}</div>
              <h2 className="text-xl font-semibold">{isRtl ? 'هر روز برای فرصت‌های تازه سر بزنید' : 'Check back for new opportunities'}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{isRtl ? 'فهرست فرصت‌ها می‌تواند به‌روز شود؛ هر مأموریت یک‌باره فقط یک بار کردیت می‌دهد.' : 'The list may change over time; one-time tasks only pay once.'}</p>
              <p className="mt-2 text-xs text-muted-foreground">{today}{lastChecked ? ` · ${isRtl ? 'آخرین بررسی' : 'Last checked'} ${new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' }).format(lastChecked)}` : ''}</p>
            </div>
            <button type="button" onClick={() => void load(true)} disabled={refreshing} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 disabled:opacity-50">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />{isRtl ? 'تازه‌سازی' : 'Refresh'}
            </button>
          </div>
          <div className="mt-5 flex items-center justify-between gap-2 text-xs"><span className="text-muted-foreground">{isRtl ? 'پیشرفت مأموریت‌ها' : 'Task progress'}</span><span className="font-semibold text-primary" dir="ltr">{completedCount} / {totalCount}</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuenow={completedCount} aria-valuemin={0} aria-valuemax={totalCount} aria-label={isRtl ? 'پیشرفت مأموریت‌ها' : 'Task progress'}>
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${totalCount ? completedCount / totalCount * 100 : 0}%` }} />
          </div>
        </div>
        {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</p>}
        <div className="space-y-3">
          {data?.tasks.map((task, index) => {
            const claimStatus = task.claim?.status;
            const complete = claimStatus === 'completed';
            const pending = claimStatus === 'pending';
            const isTelegram = task.slug === 'join-telegram';
            const profileOnly = ['follow-x', 'follow-instagram', 'join-telegram', 'subscribe-youtube'].includes(task.slug);
            const isPost = task.slug === 'social-post';
            const isManual = task.kind === 'manual' || task.requiresManualReview;
            const proof = proofInputs[task.id] ?? { profile: '', postUrl: '' };
            const updateProof = (key: 'profile' | 'postUrl', value: string) => setProofInputs((current) => ({
              ...current, [task.id]: { profile: current[task.id]?.profile ?? '', postUrl: current[task.id]?.postUrl ?? '', [key]: value },
            }));
            const isBusy = busyTask === task.id;
            return (
              <div key={task.id} className={`rounded-2xl border p-4 transition-colors ${complete ? 'border-emerald-500/30 bg-emerald-500/5' : pending ? 'border-amber-400/30 bg-amber-400/5' : 'border-border bg-background/30'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${complete ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300' : pending ? 'border-amber-300/50 bg-amber-300/10 text-amber-200' : 'border-primary/35 bg-primary/10 text-primary'}`}>
                    {complete ? <Check size={16} /> : index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold">{taskLabel(task, isRtl)}</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{taskDescription(task, isRtl)}</p>
                      </div>
                      <span className="shrink-0 rounded-full border border-primary/30 px-2.5 py-1 text-xs font-semibold text-primary" dir="ltr">+{task.rewardCredits} credits</span>
                    </div>
                     {pending && <p className="mt-3 text-xs text-amber-600 dark:text-amber-200">{isRtl ? 'در انتظار بررسی دستی ادمین است؛ کردیت پس از تأیید اضافه می‌شود.' : 'Pending admin review; credits will be added after approval.'}</p>}
                     {claimStatus === 'rejected' && <p className="mt-3 text-xs text-red-500">{isRtl ? 'درخواست قبلی تأیید نشد. می‌توانید اطلاعات را اصلاح و دوباره ارسال کنید.' : 'The previous request was rejected. You can correct it and resubmit.'}</p>}
                     {(isPost || (!complete && !pending)) && isManual && (
                       <div className="mt-3 space-y-2">
                          {task.actionUrl && <a href={task.actionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 hover:bg-primary/10">{isTelegram ? (isRtl ? 'بازکردن کانال تلگرام' : 'Open Telegram channel') : task.slug === 'follow-x' ? (isRtl ? 'بازکردن پروفایل X' : 'Open X profile') : task.slug === 'follow-instagram' ? (isRtl ? 'بازکردن اینستاگرام' : 'Open Instagram') : task.slug === 'subscribe-youtube' ? (isRtl ? 'بازکردن کانال یوتیوب' : 'Open YouTube channel') : (isRtl ? 'بازکردن لینک' : 'Open link')} <ExternalLink size={13} /></a>}
                          <div className={`grid gap-2 ${profileOnly ? 'sm:grid-cols-[1fr_auto]' : 'md:grid-cols-[1fr_1fr_auto]'}`}>
                            {!profileOnly && <Input type={isPost ? 'url' : 'text'} value={proof.postUrl} onChange={(event) => updateProof('postUrl', event.target.value)} placeholder={isPost ? (isRtl ? 'لینک پست شما (https://...)' : 'Your post URL (https://...)') : (isRtl ? 'لینک مدرک' : 'Proof URL')} aria-label={isRtl ? 'لینک پست یا مدرک' : 'Post or proof URL'} dir="ltr" maxLength={2000} />}
                            <Input value={proof.profile} onChange={(event) => updateProof('profile', event.target.value)} placeholder={profileOnly || isPost ? (isRtl ? 'پروفایل شما، @username یا لینک پروفایل' : 'Your profile: @username or profile URL') : (isRtl ? 'توضیح کوتاه (اختیاری)' : 'Short note (optional)')} aria-label={profileOnly || isPost ? (isRtl ? 'پروفایل شما برای بررسی دستی' : 'Your profile for manual review') : (isRtl ? 'توضیح مدرک' : 'Proof note')} dir={profileOnly || isPost ? 'ltr' : 'auto'} maxLength={200} />
                            <Button type="button" size="sm" onClick={() => void claim(task, { proofText: proof.profile.trim(), ...(!profileOnly ? { proofUrl: proof.postUrl.trim() } : {}) })} disabled={isBusy || (profileOnly ? !proof.profile.trim() : isPost ? !proof.postUrl.trim() || !proof.profile.trim() : !proof.postUrl.trim())}>{isBusy ? <LoaderCircle size={14} className="animate-spin" /> : null}{isRtl ? 'ارسال برای بررسی' : 'Submit for review'}</Button>
                         </div>
                      </div>
                    )}
                     {!complete && !pending && !isManual && (
                      <div className="mt-3 flex flex-wrap gap-2">
                         {task.actionUrl && <a href={task.actionUrl.startsWith('/') ? `${basePath}${task.actionUrl}` : task.actionUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 hover:bg-primary/10">{task.kind === 'app' ? (isRtl ? 'بازکردن بخش اپلیکیشن' : 'Open app area') : (isRtl ? 'بازکردن لینک' : 'Open link')} <ExternalLink size={13} /></a>}
                        {task.kind === 'share' ? <Button type="button" size="sm" onClick={() => void share(task)} disabled={isBusy || !referralLink}><Share2 size={14} />{isRtl ? 'اشتراک‌گذاری' : 'Share'}</Button> : <Button type="button" size="sm" onClick={() => void claim(task)} disabled={isBusy}>{isBusy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}{task.slug === 'create-agent' ? (isRtl ? 'دریافت پاداش' : 'Claim reward') : (isRtl ? 'انجام شد' : 'Mark complete')}</Button>}
                      </div>
                    )}
                    {task.kind === 'share' && !complete && !pending && !referralLink && <p className="mt-2 text-xs text-amber-500">{isRtl ? 'کد رفرال در دسترس نیست؛ برای اشتراک‌گذاری صفحه را تازه‌سازی کنید.' : 'Referral code unavailable; refresh before sharing.'}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <Card className="w-full max-w-lg border-primary/30">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="font-semibold">{isRtl ? 'اشتراک‌گذاری پیام دعوت' : 'Share invitation'}</h3><p className="mt-1 text-xs text-muted-foreground">{isRtl ? 'یک روش را انتخاب کنید.' : 'Choose an app or copy the message.'}</p></div>
              <button type="button" onClick={() => setShareOpen(false)} className="text-sm text-muted-foreground hover:text-foreground">×</button>
            </div>
            <Textarea className="mt-4 min-h-28" value={shareText} readOnly />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Telegram', `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(SHARE_MESSAGE)}`],
                ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(shareText)}`],
                ['SMS', `sms:?&body=${encodeURIComponent(shareText)}`],
              ].map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer" onClick={() => setShareOpen(false)} className="inline-flex items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 hover:bg-primary/10">{label}</a>)}
              <Button type="button" size="sm" onClick={() => { const task = data?.tasks.find((item) => item.kind === 'share'); void copyShareText(task); }}><Copy size={13} />{copied ? (isRtl ? 'کپی شد' : 'Copied') : (isRtl ? 'کپی متن' : 'Copy')}</Button>
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}