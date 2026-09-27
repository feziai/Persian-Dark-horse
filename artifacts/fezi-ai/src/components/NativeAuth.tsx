import { useState } from 'react';
import { SignIn, SignUp } from '@clerk/react';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import horseRoundLogo from '@/assets/persian-dark-horse-round-small.webp';
import { useTranslation } from '../lib/i18n';
import { UsernameRegistration } from './UsernameRegistration';

type NativeAuthMode = 'sign-in' | 'sign-up';

type NativeAuthProps = {
  mode: NativeAuthMode;
  basePath: string;
  redirectUrl: string;
};

export function NativeAuthPage({ mode, basePath, redirectUrl }: NativeAuthProps) {
  const isSignUp = mode === 'sign-up';
  const { isRtl } = useTranslation();
  // OAuth callbacks and Clerk's own verification paths must continue to render Clerk.
  const [emailFlow, setEmailFlow] = useState(true);

  return (
    <main className="min-h-[100dvh] bg-[#090909] px-4 py-6 text-[#f4f1e8] sm:px-6 sm:py-10" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[.9fr_1.1fr]">
        <section className="hidden rounded-[2rem] border border-[#3a3731] bg-[radial-gradient(circle_at_30%_15%,rgba(212,175,55,.18),transparent_44%),linear-gradient(145deg,#171717,#0b0b0b)] p-8 lg:block">
          <div className="flex items-center gap-3">
            <img src={horseRoundLogo} alt="Persian Dark Horse" className="h-12 w-12 rounded-full border border-[#d4af37]/50 object-cover" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-tight text-[#d4af37]">Persian Dark Horse</p>
              <p className="mt-1 text-xs text-[#a8a29a]">{isRtl ? (isSignUp ? 'حساب خود را بسازید' : 'خوش آمدید') : (isSignUp ? 'Create your account' : 'Welcome back')}</p>
            </div>
          </div>
          <h1 className="mt-16 text-4xl font-bold leading-tight">{isRtl ? 'یک فضای امن برای ایده‌های بزرگ.' : 'A private space for big ideas.'}</h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[#a8a29a]">
            {isRtl
              ? 'گفتگو، Agentها، استودیوهای ساخت و حافظهٔ شخصی شما در فضایی خصوصی.'
              : 'Chat, Agents, creative studios, and your personal memory in one private workspace.'}
          </p>
          <div className="mt-10 grid gap-3 text-sm text-[#d8d2c7]">
            {(isRtl
              ? ['Chat و Agentهای تخصصی', 'استودیوهای تصویر، ویدیو، کد و صدا', 'تاریخچه و تنظیمات شخصی شما']
              : ['Chat and specialist Agents', 'Image, video, code, and voice studios', 'Your personal history and settings']
            ).map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#d4af37]/12 text-[#d4af37]"><Check size={15} /></span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto min-w-0 w-full max-w-md rounded-[2rem] border border-[#3a3731] bg-[#171717] p-5 shadow-2xl shadow-black/30 sm:p-8">
          <div className="mb-7 flex items-center justify-between">
            <a href={`${basePath || ''}/`} className="inline-flex items-center gap-2 text-xs text-[#a8a29a] transition hover:text-[#f4f1e8]">
              <ArrowLeft size={15} />
              {isRtl ? 'بازگشت به پیش‌نمایش' : 'Back to preview'}
            </a>
            <Sparkles size={17} className="text-[#d4af37]" />
          </div>
          <div className="mb-7 lg:hidden">
            <div className="flex items-center gap-3">
              <img src={horseRoundLogo} alt="Persian Dark Horse" className="h-11 w-11 rounded-full border border-[#d4af37]/50 object-cover" />
              <div>
                <p className="text-sm font-bold tracking-tight text-[#d4af37]">Persian Dark Horse</p>
                <p className="mt-1 text-xs text-[#a8a29a]">{isRtl ? (isSignUp ? 'حساب خود را بسازید' : 'خوش آمدید') : (isSignUp ? 'Create your account' : 'Welcome back')}</p>
              </div>
            </div>
          </div>
          <div className="mb-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">PERSIAN DARK HORSE</p>
            <h2 className="mt-3 text-2xl font-bold">{isRtl
              ? (isSignUp ? 'حساب Persian Dark Horse خود را بسازید' : 'به Persian Dark Horse برگردید')
              : (isSignUp ? 'Create your Persian Dark Horse account' : 'Welcome back to Persian Dark Horse')}</h2>
            <p className="mt-2 text-sm leading-6 text-[#a8a29a]">
              {isRtl
                ? (isSignUp
                  ? 'روش ثبت‌نام خود را انتخاب کنید.'
                  : 'با حساب امن خود وارد فضای کاری‌تان شوید.')
                : (isSignUp
                  ? 'Choose how you would like to create your account.'
                  : 'Sign in to your secure workspace.')}
            </p>
          </div>

          <div className={`min-w-0 w-full [&_.cl-rootBox]:min-w-0 [&_.cl-cardBox]:min-w-0 [&_.cl-cardBox]:w-full ${isSignUp && !emailFlow ? '' : 'flex justify-center'}`} dir="ltr">
            {isSignUp && !emailFlow ? (
              <UsernameRegistration basePath={basePath} redirectUrl={redirectUrl} isRtl={isRtl} onEmail={() => setEmailFlow(true)} />
            ) : isSignUp ? (
              <SignUp
                appearance={{
                  options: { socialButtonsPlacement: 'top' },
                  elements: {
                    socialButtonsBlockButton: { color: '#f4f1e8', border: '1px solid #655d4d', minHeight: '44px' },
                    socialButtonsBlockButtonText: { color: '#f4f1e8' },
                  },
                }}
                routing="path"
                path={`${basePath}/sign-up`}
                signInUrl={`${basePath}/sign-in`}
                fallbackRedirectUrl={redirectUrl}
              />
            ) : (
              <SignIn
                routing="path"
                path={`${basePath}/sign-in`}
                signUpUrl={`${basePath}/sign-up`}
                fallbackRedirectUrl={redirectUrl}
              />
            )}
          </div>
          {isSignUp && emailFlow && window.location.pathname.replace(/\/$/, '') === `${basePath}/sign-up` && (
            <button data-testid="button-register-username-choice" type="button" onClick={() => setEmailFlow(false)} className="mt-5 min-h-11 w-full rounded-xl border border-[#655d4d] text-sm text-[#e7d5aa]">
              {isRtl ? 'ثبت‌نام با نام کاربری' : 'Sign up with username'}
            </button>
          )}
        </section>
      </div>
    </main>
  );
}