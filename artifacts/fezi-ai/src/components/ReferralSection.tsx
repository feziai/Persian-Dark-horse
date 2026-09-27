import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useTranslation } from '../lib/i18n';
import { Card } from './ui-parts';
import { ArrowUpRight, Check, Copy, Gift, ShieldCheck } from 'lucide-react';

type ReferralStatus = {
  referralCode: string | null;
  googleVerified: boolean | null;
  reward: number;
  awarded: boolean;
  awardedAt: string | null;
  firstPurchaseRewarded: boolean;
};

export function ReferralSection() {
  const { isSignedIn } = useAuth();
  const { isRtl } = useTranslation();
  const [referralStatus, setReferralStatus] = useState<ReferralStatus | null>(null);
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralSubmitting, setReferralSubmitting] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralError, setReferralError] = useState('');

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')?.trim().toUpperCase() || '';
    if (/^[A-Z0-9]{12}$/.test(ref)) setReferralCodeInput(ref);
  }, []);

  useEffect(() => {
    if (!isSignedIn) {
      setReferralStatus(null);
      setReferralError('');
      return;
    }
    let cancelled = false;
    setReferralLoading(true);
    fetch('/api/referrals/status', { credentials: 'include' })
      .then((response) => response.ok
        ? response.json() as Promise<ReferralStatus>
        : response.json().then((data) => Promise.reject(new Error(data.error || 'Referral status unavailable'))))
      .then((data) => {
        if (!cancelled) {
          setReferralStatus(data);
          setReferralError('');
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setReferralError(error instanceof Error ? error.message : 'Referral status unavailable');
      })
      .finally(() => {
        if (!cancelled) setReferralLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  if (!isSignedIn) return null;

  const copyReferralCode = async () => {
    if (!referralStatus?.referralCode) return;
    try {
      await navigator.clipboard.writeText(referralStatus.referralCode);
      setReferralCopied(true);
      window.setTimeout(() => setReferralCopied(false), 1800);
    } catch {
      setReferralError(isRtl ? 'کپی کردن کد انجام نشد.' : 'Could not copy the referral code.');
    }
  };

  const claimReferral = async () => {
    const code = referralCodeInput.trim().toUpperCase();
    if (!/^[A-Z0-9]{12}$/.test(code)) {
      setReferralError(isRtl ? 'کد رفرال باید ۱۲ حرف یا عدد باشد.' : 'A referral code must be 12 letters or numbers.');
      return;
    }
    setReferralSubmitting(true);
    setReferralError('');
    try {
      const response = await fetch('/api/referrals/claim', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referralCode: code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || (isRtl ? 'ثبت رفرال انجام نشد.' : 'Referral could not be added.'));
      setReferralCodeInput('');
      setReferralStatus((current) => current ? { ...current, awarded: true } : current);
    } catch (error: unknown) {
      setReferralError(error instanceof Error ? error.message : (isRtl ? 'ثبت رفرال انجام نشد.' : 'Referral could not be added.'));
    } finally {
      setReferralSubmitting(false);
    }
  };

  return (
    <section>
      <Card className="relative overflow-hidden border-primary/20">
        <div className="absolute -end-10 -top-10 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="flex items-center gap-2">
              <Gift size={18} className="text-primary" />
              <h2 className="text-xl font-semibold">{isRtl ? 'رفرال و پاداش' : 'Referrals & rewards'}</h2>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {isRtl
                ? 'کد شخصی شما با هر روش ورود در دسترس است. برای ثبت کد دعوت و دریافت پاداش، حساب دعوت‌شده باید اتصال Google تأییدشده داشته باشد.'
                : 'Your code is available with any sign-in method. To claim an invitation and receive rewards, the invited account must have a verified Google connection.'}
            </p>
            <a href={`${import.meta.env.BASE_URL.replace(/\/$/, '')}/referrals`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
              {isRtl ? 'داشبورد رفرال، لینک و پوسترها' : 'Open referral dashboard, link and posters'} <ArrowUpRight size={14} />
            </a>
            {referralLoading ? (
              <p className="mt-4 text-xs text-muted-foreground">{isRtl ? 'در حال بارگذاری کد رفرال…' : 'Loading referral code…'}</p>
            ) : referralStatus?.referralCode ? (
              <div className="mt-5 rounded-2xl border border-primary/20 bg-background/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">{isRtl ? 'کد رفرال شخصی شما' : 'Your personal referral code'}</p>
                    <p className="mt-1 font-mono text-lg font-semibold tracking-[0.16em] text-primary" dir="ltr">{referralStatus.referralCode}</p>
                  </div>
                  <button type="button" onClick={() => void copyReferralCode()} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:border-primary/50 hover:bg-primary/10">
                    {referralCopied ? <Check size={14} /> : <Copy size={14} />}
                    {referralCopied ? (isRtl ? 'کپی شد' : 'Copied') : (isRtl ? 'کپی کد' : 'Copy code')}
                  </button>
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  {isRtl
                    ? `با هر رفرال هر دو طرف ${referralStatus.reward} کردیت می‌گیرید؛ به‌علاوه ۲۰٪ خرید دوستان مستقیم و ۲٪ خرید سطح دوم به بعد به‌صورت کردیت (از خریدار کسر نمی‌شود).`
                    : `Each referral gives both of you ${referralStatus.reward} credits, plus 20% of direct friends' purchases and 2% of level 2+ purchases as credits (never deducted from the buyer).`}
                </p>
              </div>
            ) : (
              <div className="mt-5 flex items-start gap-3 rounded-2xl border border-red-400/25 bg-red-400/5 p-4">
                <p className="text-sm leading-6 text-red-300">
                  {referralError || (isRtl ? 'کد رفرال در دسترس نیست. صفحه را دوباره بارگذاری کنید.' : 'Referral code is unavailable. Please reload the page.')}
                </p>
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <p className="text-sm font-semibold">{isRtl ? 'اضافه‌کردن کد رفرال' : 'Add a referral code'}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {isRtl ? 'کد ۱۲ حرفی دوستتان را وارد کنید. هر حساب فقط یک‌بار می‌تواند رفرال دریافت کند.' : 'Enter your friend’s 12-character code. Each account can claim a referral once.'}
            </p>
            {referralStatus && referralStatus.googleVerified !== true && <p className="mt-2 flex items-center gap-2 text-xs text-amber-400"><ShieldCheck size={14} />{referralStatus.googleVerified === null ? (isRtl ? 'وضعیت تأیید موقتاً در دسترس نیست؛ برای ثبت دعوت بعداً تلاش کنید. کد شخصی شما قابل اشتراک‌گذاری است.' : 'Verification status is temporarily unavailable; retry claiming later. You can still share your own code.') : (isRtl ? 'برای ثبت دعوت، ابتدا اتصال Google تأییدشده لازم است؛ کد شخصی شما همچنان قابل اشتراک‌گذاری است.' : 'Claiming an invitation requires a verified Google connection; you can still share your own code.')}</p>}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                value={referralCodeInput}
                onChange={(event) => setReferralCodeInput(event.target.value.replace(/[^a-z0-9]/gi, '').slice(0, 12).toUpperCase())}
                placeholder={isRtl ? 'کد رفرال' : 'Referral code'}
                maxLength={12}
                dir="ltr"
                className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 font-mono text-sm uppercase outline-none focus:border-primary"
              />
              <button type="button" onClick={() => void claimReferral()} disabled={referralSubmitting || !referralStatus?.googleVerified} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
                {referralSubmitting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />}
                {isRtl ? 'ثبت رفرال' : 'Add referral'}
              </button>
            </div>
            {referralStatus?.awarded && <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400"><Check size={14} />{isRtl ? 'پاداش رفرال شما ثبت شده است.' : 'Your referral reward has been recorded.'}</p>}
            {referralError && <p className="mt-3 text-xs leading-5 text-red-300">{referralError}</p>}
          </div>
        </div>
      </Card>
    </section>
  );
}