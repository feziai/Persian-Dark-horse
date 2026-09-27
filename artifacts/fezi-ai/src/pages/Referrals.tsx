import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth, useUser } from '@clerk/react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, Check, Copy, Download, ExternalLink, Gift, Info, Instagram, Link2, RefreshCw, Send, Share2, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { useAccount } from '../lib/account';
import { accountAvatarSource, defaultFeziAvatar } from '../lib/avatar-options';
import { useToast } from '@/hooks/use-toast';

type Dashboard = {
  referralCode: string | null;
  googleVerified: boolean | null;
  reward: number;
  directRate: number;
  networkRate: number;
  directCount: number;
  networkCount: number;
  totalEarnedCredits: number;
  signupEarnedCredits: number;
  purchaseEarnedCredits: number;
  joinedByMonth: Array<{ month: string; direct: number; network: number }>;
};

type ReferralStatus = { referralCode: string | null; googleVerified: boolean | null; awarded: boolean };

const PENDING_KEY = 'fezi-pending-referral';
const CODE_RE = /^[A-Z0-9]{12}$/;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function storageGet(key: string) {
  try { return localStorage.getItem(key) || ''; } catch { return ''; }
}
function storageSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable (private mode) */ }
}
function storageRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const created = !el;
  const prev = el?.getAttribute('content') ?? null;
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
  return () => { if (created) el?.remove(); else if (prev !== null) el?.setAttribute('content', prev); };
}

const POSTERS = [
  { src: '/referral/poster-1.png', outdated: true, en: 'How the referral works', fa: 'رفرال چطور کار می‌کند' },
  { src: '/referral/poster-2.png', outdated: true, en: 'Multi-tier network', fa: 'شبکهٔ چندسطحی' },
  { src: '/referral/poster-4.png', outdated: false, en: 'Welcome bonus: 500 + 500', fa: 'هدیهٔ خوش‌آمد: ۵۰۰ + ۵۰۰' },
  { src: '/referral/poster-5.png', outdated: false, en: 'Referral growth tree', fa: 'درخت رشد رفرال' },
  { src: '/referral/poster-3.png', outdated: false, en: 'Growth over time', fa: 'رشد در طول زمان' },
];

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as { error?: string; message?: string }).error || (data as { message?: string }).message || `HTTP ${response.status}`);
  return data as T;
}

function pct(rate: number) {
  return `${Math.round(rate * 1000) / 10}%`;
}

function formatMonth(month: string, fa: boolean) {
  const d = new Date(`${month.slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return month;
  return d.toLocaleDateString(fa ? 'fa-IR' : 'en-US', { month: 'short', year: '2-digit' });
}

export default function ReferralsPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const { isRtl } = useTranslation();
  const fa = isRtl;
  const { toast } = useToast();
  const tx = (en: string, f: string) => (fa ? f : en);

  const urlRef = useMemo(() => {
    const r = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() || '';
    return CODE_RE.test(r) ? r : '';
  }, []);
  const [pendingRef, setPendingRef] = useState(() => urlRef || storageGet(PENDING_KEY));

  useEffect(() => {
    if (urlRef) storageSet(PENDING_KEY, urlRef);
  }, [urlRef]);

  useEffect(() => {
    const prevTitle = document.title;
    const title = fa ? 'رفرال و اشتراک رایگان | Persian Dark Horse' : 'Referrals — earn credits | Persian Dark Horse';
    const desc = fa
      ? 'با لینک رفرال Persian Dark Horse هر دو طرف ۵۰۰ کردیت می‌گیرید؛ ۲۰٪ از کردیت خریدهای تأییدشدهٔ دوستان مستقیم و ۲٪ از سطح دوم به بعد به‌صورت کردیت.'
      : 'Join Persian Dark Horse with a referral link: 500 credits for both of you, plus 20% of direct and 2% of level-2+ approved credit purchases as credits.';
    document.title = title;
    const cleanups = [
      upsertMeta('name', 'description', desc),
      upsertMeta('property', 'og:title', title),
      upsertMeta('property', 'og:description', desc),
      upsertMeta('property', 'og:type', 'website'),
    ];
    return () => { document.title = prevTitle; cleanups.forEach(c => c()); };
  }, [fa]);

  const { account } = useAccount(!!isSignedIn, user?.id);
  const [claimMsg, setClaimMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [manualText, setManualText] = useState('');
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [status, setStatus] = useState<ReferralStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const userId = isSignedIn ? user?.id ?? null : null;
  const reqRef = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const req = ++reqRef.current;
    if (!quiet) { setLoading(true); setError(''); }
    try {
      const [d, s] = await Promise.all([
        fetch('/api/referrals/dashboard', { credentials: 'include' }).then(r => readJson<Dashboard>(r)),
        fetch('/api/referrals/status', { credentials: 'include' }).then(r => readJson<ReferralStatus>(r)).catch(() => null),
      ]);
      if (req !== reqRef.current) return;
      setDash(d);
      setStatus(s);
      setError('');
    } catch (e) {
      if (req !== reqRef.current) return;
      if (!quiet) setError(e instanceof Error ? e.message : 'Error');
    } finally {
      if (req === reqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reqRef.current++;
    setDash(null); setStatus(null); setError(''); setClaimMsg(null);
    if (!userId) { setLoading(false); return; }
    void load();
    const onFocus = () => { if (document.visibilityState === 'visible') void load(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    const timer = window.setInterval(onFocus, 60_000);
    return () => {
      reqRef.current++;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      window.clearInterval(timer);
    };
  }, [userId, load]);

  const code = dash?.referralCode || null;
  const link = code ? `${window.location.origin}${basePath}/referrals?ref=${code}` : '';
  const signupHref = `${basePath}/sign-up?redirect_url=${encodeURIComponent(`/referrals${pendingRef ? `?ref=${pendingRef}` : ''}`)}`;
  const signinHref = `${basePath}/sign-in?redirect_url=${encodeURIComponent(`/referrals${pendingRef ? `?ref=${pendingRef}` : ''}`)}`;

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: tx(`${label} copied`, `${label} کپی شد`) });
    } catch {
      setManualText(value);
      toast({ title: tx('Copy failed — select and copy manually.', 'کپی نشد؛ لطفاً دستی کپی کنید.'), variant: 'destructive' });
    }
  };

  const shareText = tx(
    'Join me on Persian Dark Horse. We both get 500 credits when you sign up with my link.',
    'به Persian Dark Horse بپیوند. با ثبت‌نام از لینک من، هر دو ۵۰۰ کردیت می‌گیریم.',
  );

  const nativeShare = async () => {
    if (!link) return;
    const fallback = async () => {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${link}`);
        toast({ title: tx('Sharing unavailable here — invite text and link copied.', 'اشتراک‌گذاری در دسترس نیست؛ متن و لینک کپی شد.') });
      } catch {
        setManualText(`${shareText}\n${link}`);
        toast({ title: tx('Sharing and copying are unavailable. Copy the text below manually.', 'اشتراک‌گذاری و کپی در دسترس نیست؛ متن زیر را دستی کپی کنید.'), variant: 'destructive' });
      }
    };
    if (!navigator.share) { await fallback(); return; }
    try {
      await navigator.share({ title: 'Persian Dark Horse', text: shareText, url: link });
      toast({ title: tx('Shared', 'اشتراک‌گذاری شد') });
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') toast({ title: tx('Share cancelled', 'اشتراک‌گذاری لغو شد') });
      else await fallback();
    }
  };

  const posterCaption = (p: typeof POSTERS[number]) => {
    const correction = p.outdated
      ? tx('Correction: this original artwork shows 10%; the current direct-purchase reward is 20% (level 2 and beyond: 2%). ', 'اصلاحیه: این پوستر اصلی ۱۰٪ نوشته؛ پاداش فعلی خرید مستقیم ۲۰٪ است (سطح دوم به بعد ۲٪). ')
      : '';
    return `${correction}${shareText} ${tx('Sample figures on posters are illustrative, not guaranteed earnings.', 'اعداد نمونهٔ پوسترها صرفاً نمایشی‌اند و درآمد تضمینی نیستند.')}${link ? `\n${link}` : ''}`;
  };

  const downloadPoster = async (p: typeof POSTERS[number]) => {
    const a = document.createElement('a');
    a.href = `${basePath}${p.src}`;
    a.download = `persian-dark-horse-${p.src.split('/').pop()}`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const sharePoster = async (p: typeof POSTERS[number], instagram = false) => {
    const caption = posterCaption(p);
    try {
      const blob = await fetch(`${basePath}${p.src}`).then(r => { if (!r.ok) throw new Error(); return r.blob(); });
      const file = new File([blob], p.src.split('/').pop() || 'poster.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: caption, title: 'Persian Dark Horse' });
        toast({ title: tx('Shared', 'اشتراک‌گذاری شد'), description: instagram ? tx('Choose Instagram in the share sheet if it is installed.', 'اگر اینستاگرام نصب است آن را در منو انتخاب کنید.') : undefined });
        return;
      }
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') { toast({ title: tx('Share cancelled', 'اشتراک‌گذاری لغو شد') }); return; }
    }
    await downloadPoster(p);
    let copied = true;
    try { await navigator.clipboard.writeText(caption); } catch { copied = false; setManualText(caption); }
    toast({
      title: copied ? tx('Poster downloaded, caption copied', 'پوستر دانلود شد و متن کپی شد') : tx('Poster downloaded. Caption could not be copied — copy it from the box below.', 'پوستر دانلود شد. متن کپی نشد؛ آن را از کادر زیر کپی کنید.'),
      variant: copied ? undefined : 'destructive',
      description: instagram
        ? tx('Instagram does not allow posting from websites. Open Instagram, create a post with the downloaded image and paste the caption.', 'اینستاگرام اجازهٔ انتشار مستقیم از وب را نمی‌دهد. اینستاگرام را باز کنید، تصویر دانلودشده را پست کنید و متن را جای‌گذاری کنید.')
        : undefined,
    });
  };

  // claim
  const [claiming, setClaiming] = useState(false);
  const dismissPending = () => { storageRemove(PENDING_KEY); setPendingRef(''); };
  const claim = async () => {
    if (!pendingRef) return;
    setClaiming(true); setClaimMsg(null);
    try {
      const res = await fetch('/api/referrals/claim', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referralCode: pendingRef }) })
        .then(r => readJson<{ awarded?: boolean; reward?: number; alreadyClaimed?: boolean; newlyAwarded?: boolean }>(r));
      storageRemove(PENDING_KEY);
      const isNew = res.awarded === true && res.alreadyClaimed !== true && res.newlyAwarded !== false && !status?.awarded;
      const amt = typeof res.reward === 'number' ? res.reward : null;
      setClaimMsg({ ok: true, text: isNew && amt
        ? tx(`Referral accepted. ${amt} credits were added for you and your friend.`, `رفرال پذیرفته شد. ${amt} کردیت برای شما و دوستتان ثبت شد.`)
        : tx('This referral was already recorded for your account. No new credits were added.', 'این رفرال قبلاً برای حساب شما ثبت شده بود و کردیت جدیدی اضافه نشد.') });
      setPendingRef('');
      void load();
    } catch (e) {
      setClaimMsg({ ok: false, text: e instanceof Error ? e.message : 'Error' });
    } finally { setClaiming(false); }
  };
  const ownCode = pendingRef && code === pendingRef;
  const alreadyReferred = status?.awarded;

  const displayName = account?.profile.displayName || user?.fullName || user?.username || tx('Your account', 'حساب شما');
  const avatar = accountAvatarSource(account?.profile.avatarId, user) || defaultFeziAvatar;
  const directRate = dash ? pct(dash.directRate) : '20%';
  const networkRate = dash ? pct(dash.networkRate) : '2%';
  const reward = dash?.reward ?? 500;
  const chartData = useMemo(() => (dash?.joinedByMonth ?? []).map(m => ({ ...m, label: formatMonth(m.month, fa) })), [dash, fa]);
  const chartEmpty = chartData.every(m => !m.direct && !m.network);

  const panel = 'rounded-3xl border border-border bg-surface/70 p-5 sm:p-6';

  return (
    <div dir={fa ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-5xl space-y-6 pb-16">
      {/* 1. Identity */}
      {!isLoaded ? (
        <div className={`${panel} h-28 animate-pulse`} />
      ) : isSignedIn ? (
        <section className={`${panel} relative overflow-hidden`}>
          <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex items-center gap-4">
            <img src={avatar} alt="" className="h-16 w-16 rounded-2xl border border-primary/40 object-cover sm:h-20 sm:w-20" />
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em] text-primary">{tx('Referral dashboard', 'داشبورد رفرال')}</p>
              <h1 className="truncate text-2xl font-semibold sm:text-3xl">{displayName}</h1>
              {account?.profile.username && <p className="text-sm text-muted-foreground" dir="ltr">@{account.profile.username}</p>}
            </div>
          </div>
        </section>
      ) : (
        <section className={`${panel} relative overflow-hidden`}>
          <div className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary">{tx('Invitation', 'دعوت‌نامه')}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">
            {pendingRef ? tx('You were invited to Persian Dark Horse', 'به Persian Dark Horse دعوت شده‌اید') : tx('Invite friends, earn credits', 'دوستانتان را دعوت کنید، کردیت بگیرید')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            {tx(`Sign in to get your own referral code, regardless of sign-in method. To accept an invitation and receive ${reward} credits each, the invited account must have a verified Google connection.`, `برای دریافت کد رفرال خود با هر روشی وارد شوید. برای پذیرش دعوت و دریافت ${reward} کردیت برای هر نفر، حساب دعوت‌شده باید اتصال Google تأییدشده داشته باشد.`)}
          </p>
          {pendingRef && <p className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">{tx('Invite code', 'کد دعوت')}: <span dir="ltr" className="font-mono tracking-[0.15em] text-primary">{pendingRef}</span></p>}
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <a href={signupHref} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90"><UserPlus size={16} />{tx('Create free account', 'افتتاح حساب رایگان')}</a>
            <a href={signinHref} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border px-5 text-sm font-semibold hover:bg-surface-hover">{tx('I already have an account', 'حساب دارم')}</a>
          </div>
          {pendingRef && <p className="mt-3 text-xs text-muted-foreground">{tx('The invite code is kept through sign-up; you will confirm it on return.', 'کد دعوت در طول ثبت‌نام حفظ می‌شود و پس از بازگشت آن را تأیید می‌کنید.')}</p>}
        </section>
      )}

      {/* Claim capture */}
      {isSignedIn && (pendingRef || claimMsg) && !loading && (
        <section className={`rounded-3xl border p-5 ${claimMsg?.ok ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-primary/35 bg-primary/5'}`} aria-live="polite">
          {claimMsg ? (
            <p className={`flex items-start gap-2 text-sm ${claimMsg.ok ? 'text-emerald-500' : 'text-red-400'}`}>{claimMsg.ok ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}{claimMsg.text}</p>
          ) : null}
          {pendingRef && (ownCode ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{tx('This is your own code and cannot be claimed.', 'این کد خودتان است و قابل ثبت نیست.')}</span><button type="button" onClick={dismissPending} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">{tx('Dismiss', 'بستن')}</button></div>
          ) : alreadyReferred ? (
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><span>{tx('Your account already has a referral recorded; only one is allowed.', 'برای حساب شما قبلاً رفرال ثبت شده و فقط یک‌بار مجاز است.')}</span><button type="button" onClick={dismissPending} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">{tx('Dismiss', 'بستن')}</button></div>
          ) : (
            <div className={claimMsg ? 'mt-3' : ''}>
              <p className="font-semibold">{tx('Accept this invitation?', 'این دعوت را می‌پذیرید؟')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{tx('You were invited with code', 'با این کد دعوت شده‌اید')} <span dir="ltr" className="font-mono text-primary">{pendingRef}</span>. {tx(`Accepting links your account to the inviter and gives you both ${reward} credits.`, `با پذیرش، حساب شما به دعوت‌کننده متصل شده و هر دو ${reward} کردیت می‌گیرید.`)}</p>
              {dash && dash.googleVerified !== true && <p className="mt-2 flex items-start gap-2 text-xs text-amber-500"><ShieldCheck size={14} className="mt-0.5 shrink-0" />{dash.googleVerified === null ? tx('Verification status is temporarily unavailable. Your code remains saved on this device; please retry later.', 'وضعیت تأیید موقتاً در دسترس نیست. کد روی این دستگاه ذخیره می‌ماند؛ بعداً دوباره تلاش کنید.') : tx('Accepting an invitation requires a verified Google connection on your account. Your own code can still be shared.', 'برای پذیرش دعوت، اتصال Google تأییدشده در حساب شما لازم است. کد شخصی‌تان همچنان قابل اشتراک‌گذاری است.')}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void claim()} disabled={claiming || !dash?.googleVerified} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50">{claiming && <RefreshCw size={14} className="animate-spin" />}{tx('Accept referral', 'پذیرش رفرال')}</button>
                <button type="button" onClick={dismissPending} className="min-h-11 rounded-xl border border-border px-4 text-sm">{tx('Not now, discard', 'رد کردن')}</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {manualText && (
        <section className={`${panel} border-amber-500/40`} aria-live="polite">
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{tx('Copy this text manually', 'این متن را دستی کپی کنید')}</p><button type="button" onClick={() => setManualText('')} className="rounded-xl border border-border px-3 py-1.5 text-xs">{tx('Close', 'بستن')}</button></div>
          <textarea readOnly value={manualText} onFocus={e => e.currentTarget.select()} className="mt-3 min-h-24 w-full rounded-xl border border-border bg-background/60 p-3 text-sm" dir="auto" />
        </section>
      )}

      {/* 2. Code + link */}
      {isSignedIn && (
        loading && !dash ? (
          <div className="grid gap-4 md:grid-cols-2"><div className={`${panel} h-32 animate-pulse`} /><div className={`${panel} h-32 animate-pulse`} /></div>
        ) : error ? (
          <section className={`${panel} flex flex-wrap items-center justify-between gap-3 border-red-500/40`}>
            <p className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle size={16} />{tx('Referral data could not be loaded.', 'اطلاعات رفرال بارگذاری نشد.')} <span className="text-xs opacity-70">{error}</span></p>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"><RefreshCw size={14} />{tx('Retry', 'تلاش دوباره')}</button>
          </section>
        ) : dash && code ? (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
              <div className={panel}>
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Gift size={14} />{tx('Referral code', 'کد رفرال')}</p>
                <p dir="ltr" className="mt-2 font-mono text-2xl font-semibold tracking-[0.18em] text-primary">{code}</p>
                <button type="button" onClick={() => void copy(code, tx('Code', 'کد'))} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:border-primary/50 hover:bg-primary/10"><Copy size={14} />{tx('Copy code', 'کپی کد')}</button>
              </div>
              <div className={panel}>
                <p className="flex items-center gap-2 text-xs text-muted-foreground"><Link2 size={14} />{tx('Referral link', 'لینک رفرال')}</p>
                <p dir="ltr" className="mt-2 break-all rounded-xl bg-background/60 px-3 py-2 font-mono text-sm">{link}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copy(link, tx('Link', 'لینک'))} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground"><Copy size={14} />{tx('Copy link', 'کپی لینک')}</button>
                  <button type="button" onClick={() => void nativeShare()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10"><Share2 size={14} />{tx('Share', 'اشتراک‌گذاری')}</button>
                  <a href={`https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(link)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10">X <ExternalLink size={12} /></a>
                  <a href={`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10"><Send size={13} />Telegram</a>
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${link}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10">WhatsApp <ExternalLink size={12} /></a>
                  <button type="button" onClick={() => void sharePoster(POSTERS[2], true)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10"><Instagram size={14} />Instagram</button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [tx('Direct joins', 'عضو مستقیم'), dash.directCount],
                [tx('Network joins', 'عضو شبکه'), dash.networkCount],
                [tx('Signup credits', 'کردیت ثبت‌نام'), dash.signupEarnedCredits],
                [tx('Purchase credits', 'کردیت خرید'), dash.purchaseEarnedCredits],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded-2xl border border-border bg-surface/50 p-4"><p className="text-xs text-muted-foreground">{l}</p><p className="mt-1 font-mono text-xl font-semibold">{Number(v).toLocaleString(fa ? 'fa-IR' : 'en-US')}</p></div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{tx('Total earned', 'مجموع دریافتی')}: <span className="font-mono text-foreground">{dash.totalEarnedCredits.toLocaleString(fa ? 'fa-IR' : 'en-US')}</span> {tx('credits', 'کردیت')}</p>
          </section>
        ) : dash ? (
          <section className={`${panel} flex flex-wrap items-center justify-between gap-3 border-red-500/40`}>
            <p className="flex items-center gap-2 text-sm text-red-400"><AlertTriangle size={16} />{tx('Your referral code is unavailable. Please retry.', 'کد رفرال شما در دسترس نیست. دوباره تلاش کنید.')}</p>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"><RefreshCw size={14} />{tx('Retry', 'تلاش دوباره')}</button>
          </section>
        ) : null
      )}

      {/* 3. Chart */}
      {isSignedIn && dash && code && !error && (
        <section className={panel}>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">{tx('People who joined through your link', 'افرادی که با لینک شما عضو شدند')}</h2>
              <p className="text-xs text-muted-foreground">{tx('Monthly joins, direct invites vs. level 2 and beyond', 'عضویت ماهانه؛ مستقیم در برابر سطح دوم به بعد')}</p>
            </div>
            <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"><RefreshCw size={12} className={loading ? 'animate-spin' : ''} />{tx('Refresh', 'به‌روزرسانی')}</button>
          </div>
          {chartEmpty ? (
            <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border px-4 py-10 text-center">
              <Users className="text-primary" size={28} />
              <p className="mt-3 font-semibold">{tx('No one has joined yet', 'هنوز کسی عضو نشده')}</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">{tx('Share your link above. Joins appear here as soon as they are recorded.', 'لینک خود را به اشتراک بگذارید. عضویت‌ها بلافاصله پس از ثبت اینجا نمایش داده می‌شوند.')}</p>
            </div>
          ) : (
            <>
              <div className="mt-4 h-64 w-full" dir="ltr" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip cursor={{ fill: 'hsl(var(--primary) / 0.08)' }} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="direct" stackId="j" name={tx('Direct', 'مستقیم')} fill="#61A9BD" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="network" stackId="j" name={tx('Network (level 2+)', 'شبکه (سطح ۲+)')} fill="#CED14E" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-xs text-muted-foreground">{tx('View as table', 'نمایش جدول')}</summary>
                <table className="mt-2 w-full text-start text-xs">
                  <caption className="sr-only">{tx('Monthly joins through your referral link', 'عضویت ماهانه از لینک رفرال')}</caption>
                  <thead><tr className="text-muted-foreground"><th className="py-1 text-start">{tx('Month', 'ماه')}</th><th className="text-start">{tx('Direct', 'مستقیم')}</th><th className="text-start">{tx('Network', 'شبکه')}</th></tr></thead>
                  <tbody>{chartData.map(m => <tr key={m.month} className="border-t border-border"><td className="py-1">{m.label}</td><td className="font-mono">{m.direct}</td><td className="font-mono">{m.network}</td></tr>)}</tbody>
                </table>
              </details>
            </>
          )}
        </section>
      )}

      {/* 4. Tutorial */}
      <section className={`${panel} relative overflow-hidden`}>
        <h2 className="text-2xl font-semibold leading-snug sm:text-3xl">{tx('How to get a lifetime free subscription through the referral system?', 'چطور از طریق سیستم رفرال اشتراک رایگان مادام‌العمر بگیریم؟')}</h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{tx('Persian Dark Horse is an ecosystem that grows with its community. Invite your friends, colleagues and anyone who could use AI Agents, studios and chat — every person who joins through your link becomes part of your network, and their activity can earn you workspace credits.', 'Persian Dark Horse یک اکوسیستم است که با جامعه‌اش رشد می‌کند. دوستان، همکاران و هر کسی را که از ایجنت‌ها، استودیوها و چت هوش مصنوعی استفاده می‌کند دعوت کنید؛ هر کسی که با لینک شما عضو شود بخشی از شبکهٔ شما می‌شود و فعالیتش می‌تواند برای شما کردیت فضای کار بسازد.')}</p>
        <ol className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            [tx('Invite', 'دعوت'), tx(`Your link works regardless of how you signed in. When a friend accepts your invitation with a verified Google account, you both get ${reward} credits.`, `لینک شما مستقل از روش ورودتان کار می‌کند. وقتی دوستتان دعوت شما را با حساب Google تأییدشده بپذیرد، هر دو ${reward} کردیت می‌گیرید.`)],
            [tx('Direct purchases', 'خرید مستقیم'), tx(`Every time a friend you invited directly completes an approved, qualifying credit purchase, you receive ${directRate} of the purchased workspace credits as credits.`, `هر بار دوستی که مستقیم دعوت کرده‌اید یک خرید کردیت تأییدشده و واجد شرایط انجام دهد، ${directRate} از کردیت فضای کار خریداری‌شده به شما می‌رسد.`)],
            [tx('Level 2 and beyond', 'سطح دوم به بعد'), tx(`When people they invite (and further down) complete qualifying credit purchases, you receive ${networkRate} of those purchased credits.`, `وقتی افرادی که آن‌ها دعوت کرده‌اند (و سطوح بعدی) خرید کردیت واجد شرایط انجام دهند، ${networkRate} از آن کردیت‌ها را دریافت می‌کنید.`)],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-border bg-background/40 p-4">
              <span className="font-mono text-xs text-primary">0{i + 1}</span>
              <p className="mt-1 font-semibold">{t}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm leading-7">{tx('These extra credits come from Persian Dark Horse — they are never deducted from the buyer. If your network’s purchases earn enough credits to cover your plan, you can keep using it without paying.', 'این کردیت‌های اضافه از طرف Persian Dark Horse پرداخت می‌شوند و هرگز از خریدار کسر نمی‌شوند. اگر خریدهای شبکهٔ شما کردیت کافی برای پوشش اشتراکتان ایجاد کند، می‌توانید بدون پرداخت از آن استفاده کنید.')}</p>
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-6 text-muted-foreground"><Info size={14} className="mt-1 shrink-0 text-amber-500" />{tx('Purchase rewards depend entirely on real purchases by people you referred. Referrals do not automatically grant lifetime membership, and there is no guaranteed income. Credits are for use on Persian Dark Horse.', 'پاداش خرید کاملاً به خرید واقعی افراد معرفی‌شده بستگی دارد. رفرال به‌طور خودکار عضویت مادام‌العمر نمی‌دهد و هیچ درآمد تضمینی وجود ندارد. کردیت‌ها برای استفاده در Persian Dark Horse هستند.')}</p>
      </section>

      {/* 5. Posters */}
      <section>
        <h2 className="text-lg font-semibold">{tx('Promotional posters', 'پوسترهای تبلیغاتی')}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{tx('Original artwork. Sample numbers, growth curves and claims on posters are illustrative only — not your account metrics or guaranteed results.', 'آثار اصلی. اعداد نمونه، نمودارها و ادعاهای روی پوسترها صرفاً نمایشی‌اند و آمار حساب شما یا نتیجهٔ تضمینی نیستند.')}</p>
        <div className="mt-4 columns-1 gap-4 sm:columns-2">
          {POSTERS.map(p => (
            <figure key={p.src} className="mb-4 break-inside-avoid overflow-hidden rounded-3xl border border-border bg-surface/70">
              <img src={`${basePath}${p.src}`} alt={fa ? p.fa : p.en} loading="lazy" className="w-full" />
              <figcaption className="space-y-3 p-4">
                <p className="text-sm font-semibold">{fa ? p.fa : p.en}</p>
                {p.outdated && <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-600 dark:text-amber-300">{tx('Original artwork shows 10%. Current terms: 20% of direct purchases, 2% for level 2 and beyond.', 'این پوستر اصلی ۱۰٪ نوشته است. شرایط فعلی: ۲۰٪ خرید مستقیم، ۲٪ سطح دوم به بعد.')}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void sharePoster(p)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10"><Share2 size={13} />{tx('Share', 'اشتراک')}</button>
                  <button type="button" onClick={() => void sharePoster(p, true)} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10"><Instagram size={13} />Instagram</button>
                  <button type="button" onClick={() => { void downloadPoster(p); toast({ title: tx('Download started', 'دانلود آغاز شد') }); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10"><Download size={13} />{tx('Download', 'دانلود')}</button>
                  <button type="button" onClick={() => void copy(posterCaption(p), tx('Caption', 'متن'))} className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold hover:bg-primary/10"><Copy size={13} />{tx('Copy caption', 'کپی متن')}</button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}
