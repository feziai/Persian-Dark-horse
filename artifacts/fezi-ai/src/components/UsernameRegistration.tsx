import { useEffect, useState, type FormEvent } from 'react';
import { useClerk } from '@clerk/react';
import { Check, X } from 'lucide-react';

type Capabilities = {
  usernameOnly: boolean;
  usernameEnabled: boolean;
  socialProviders: string[];
};

type Props = {
  basePath: string;
  redirectUrl: string;
  isRtl: boolean;
  onEmail: () => void;
};

const usernamePattern = /^[a-zA-Z0-9_]{4,20}$/;

export function UsernameRegistration({ basePath, redirectUrl, isRtl, onEmail }: Props) {
  const clerk = useClerk();
  const signUp = clerk.client?.signUp;
  const isLoaded = clerk.loaded;
  const [capability, setCapability] = useState<Capabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState(false);
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [password, setPassword] = useState('');
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${basePath}/api/registration/capabilities`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Capabilities unavailable');
        return response.json() as Promise<Capabilities>;
      })
      .then(setCapability)
      .catch(() => { if (!controller.signal.aborted) setCapabilityError(true); });
    return () => controller.abort();
  }, [basePath]);

  useEffect(() => {
    setAvailability('idle');
    if (!capability?.usernameOnly || !usernamePattern.test(username)) return;
    setAvailability('checking');
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`${basePath}/api/registration/username-available?username=${encodeURIComponent(username)}`, { signal: controller.signal })
        .then(async response => {
          if (!response.ok) throw new Error('Availability unavailable');
          return response.json() as Promise<{ available: boolean }>;
        })
        .then(result => setAvailability(result.available ? 'available' : 'taken'))
        .catch(() => { if (!controller.signal.aborted) setAvailability('error'); });
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [username, basePath, capability?.usernameOnly]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isLoaded || !signUp || !capability?.usernameOnly || busy || availability !== 'available') return;
    if (!firstName.trim() || password.length < 8 || !usernamePattern.test(username)) return;
    setError('');
    setBusy(true);
    try {
      // Recheck both username stores before asking Clerk to create the account.
      const check = await fetch(`${basePath}/api/registration/username-available?username=${encodeURIComponent(username)}`);
      if (!check.ok || !(await check.json() as { available: boolean }).available) {
        setAvailability(check.ok ? 'taken' : 'error');
        throw new Error(isRtl ? 'این نام کاربری دیگر در دسترس نیست.' : 'This username is no longer available. Please choose another.');
      }
      const attempt = await signUp.create({ username, firstName: firstName.trim(), password });
      if (attempt.status === 'complete' && attempt.createdSessionId) {
        await clerk.setActive({ session: attempt.createdSessionId });
        window.location.assign(redirectUrl);
      } else {
        setError(isRtl ? 'Clerk برای این حساب به تأیید دیگری نیاز دارد. لطفاً با ایمیل ثبت‌نام کنید.' : 'Clerk requires another verification step for this account. Please use email registration.');
      }
    } catch (cause) {
      const clerkError = cause as { errors?: Array<{ longMessage?: string; message?: string }> };
      setError(clerkError.errors?.[0]?.longMessage ?? (cause instanceof Error ? cause.message : (isRtl ? 'ثبت‌نام انجام نشد.' : 'Registration could not be completed.')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {!capability?.usernameOnly && (
        <p data-testid="status-username-registration" role="status" className="rounded-xl border border-[#655d4d] bg-[#27231d] p-3 text-sm text-[#e7d5aa]">
          {capabilityError
            ? (isRtl ? 'امکان بررسی تنظیمات Clerk وجود ندارد. لطفاً با ایمیل ثبت‌نام کنید یا بعداً دوباره تلاش کنید.' : 'Clerk settings could not be checked. Please use email registration or try again later.')
            : capability === null
            ? (isRtl ? 'در حال بررسی تنظیمات ثبت‌نام…' : 'Checking registration settings…')
            : (isRtl ? 'ثبت‌نام بدون ایمیل در حال حاضر توسط تنظیمات Clerk فعال نیست. لطفاً با ایمیل ثبت‌نام کنید.' : 'Username-only registration is not enabled in Clerk right now. Please register with email instead.')}
        </p>
      )}
      {capability?.usernameOnly && (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm">{isRtl ? 'نام' : 'Name'}
            <input data-testid="input-registration-name" autoComplete="given-name" required maxLength={80} value={firstName} onChange={event => setFirstName(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#655d4d] bg-[#101010] px-3 text-base text-white" />
          </label>
          <label className="block text-sm">{isRtl ? 'نام کاربری' : 'Username'}
            <input data-testid="input-registration-username" autoComplete="username" required minLength={4} maxLength={20} pattern="[a-zA-Z0-9_]{4,20}" value={username} onChange={event => setUsername(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#655d4d] bg-[#101010] px-3 text-base text-white" />
          </label>
          <p data-testid="status-username-availability" role="status" aria-live="polite" className={`flex min-h-5 items-center gap-1 text-xs ${availability === 'available' ? 'text-green-400' : availability === 'taken' ? 'text-red-400' : 'text-[#c9bfae]'}`}>
            {availability === 'available' && <><Check size={16} /> {isRtl ? 'در دسترس (تا تأیید نهایی)' : 'Available (subject to final confirmation)'}</>}
            {availability === 'taken' && <><X size={16} /> {isRtl ? 'نام کاربری در دسترس نیست' : 'Username unavailable'}</>}
            {availability === 'checking' && (isRtl ? 'در حال بررسی نام کاربری…' : 'Checking username…')}
            {availability === 'error' && (isRtl ? 'بررسی نام کاربری ممکن نیست. کمی بعد دوباره تلاش کنید.' : 'Could not check availability. Try again shortly.')}
            {availability === 'idle' && (isRtl ? '۴ تا ۲۰ حرف انگلیسی، عدد یا زیرخط' : '4–20 letters, numbers, or underscores')}
          </p>
          <label className="block text-sm">{isRtl ? 'رمز عبور' : 'Password'}
            <input data-testid="input-registration-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#655d4d] bg-[#101010] px-3 text-base text-white" />
          </label>
          <p className="text-xs text-[#c9bfae]">{isRtl ? 'حداقل ۸ نویسه. Clerk ممکن است شرایط امنیتی دیگری داشته باشد.' : 'At least 8 characters. Clerk may enforce additional password rules.'}</p>
          {/* Clerk attaches its managed CAPTCHA to this documented container when enabled. */}
          <div id="clerk-captcha" />
          {error && <p data-testid="error-registration" role="alert" className="text-sm text-red-400">{error}</p>}
          <button data-testid="button-register-username" type="submit" disabled={busy || availability !== 'available' || !isLoaded}
            className="min-h-11 w-full rounded-xl bg-[#d4af37] px-4 font-semibold text-black disabled:opacity-50">
            {busy ? (isRtl ? 'در حال ساخت حساب…' : 'Creating account…') : (isRtl ? 'ساخت حساب' : 'Create account')}
          </button>
        </form>
      )}
      <button type="button" data-testid="button-register-email" onClick={onEmail} className="min-h-11 w-full rounded-xl border border-[#655d4d] px-4 text-sm hover:bg-white/5">
        {isRtl ? 'ثبت‌نام با ایمیل یا شبکه‌های اجتماعی' : 'Continue with email or social sign-up'}
      </button>
      {error && !capability?.usernameOnly && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </div>
  );
}