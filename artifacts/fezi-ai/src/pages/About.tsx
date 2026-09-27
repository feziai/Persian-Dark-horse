import { useEffect } from 'react';
import { Link } from 'wouter';
import { Instagram, Send, ExternalLink, ArrowLeft, Info } from 'lucide-react';
import { SiX } from 'react-icons/si';
import { useTranslation } from '../lib/i18n';
import BrandSlideshow from '../components/BrandSlideshow';

const accounts = [
  { name: 'X', handle: '@persiandarkhors', href: 'https://x.com/persiandarkhors', Icon: SiX },
  { name: 'Instagram', handle: '@pdh.ir', href: 'https://www.instagram.com/pdh.ir/', Icon: Instagram },
  { name: 'Telegram', handle: '@persiandarkhorse', href: 'https://t.me/persiandarkhorse', Icon: Send },
] as const;

const TITLE = 'About Us | Persian Dark Horse';
const DESCRIPTION = 'The story of Persian Dark Horse: one platform for AI tools, custom AI Agents, and five in-house Agents, created by Fazel Esmaeil Zadeh (FEZI).';

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const created = !el;
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  const previous = el.getAttribute('content');
  el.setAttribute('content', value);
  return () => { if (created) el!.remove(); else if (previous !== null) el!.setAttribute('content', previous); };
}

const agents = [
  ['Manika', 'art and promoting'], ['Negar', 'coding and website development'], ['Arta', 'gaming'],
  ['Arwin', 'money and investment assistance'], ['FEZI', 'the mastermind AI'],
] as const;

const p = 'text-[15px] leading-8 text-muted-foreground sm:text-base [&_strong]:font-semibold [&_strong]:text-foreground';
const h2 = 'text-xl font-bold tracking-tight text-foreground sm:text-2xl';

export default function AboutPage() {
  const { isRtl } = useTranslation();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  useEffect(() => {
    document.title = TITLE;
    const restores = [
      setMeta('name', 'description', DESCRIPTION),
      setMeta('property', 'og:title', TITLE),
      setMeta('property', 'og:description', DESCRIPTION),
      setMeta('name', 'twitter:title', TITLE),
      setMeta('name', 'twitter:description', DESCRIPTION),
    ];
    return () => { document.title = 'Persian Dark Horse'; restores.forEach((r) => r()); };
  }, []);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-1 pb-20 sm:px-2">
      <Link href="/faq" data-testid="link-about-back-faq" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <ArrowLeft size={17} className="rtl:rotate-180" aria-hidden="true" />{isRtl ? 'بازگشت به پرسش‌های متداول' : 'Back to FAQ'}
      </Link>

      <BrandSlideshow testIdPrefix="about" labels={isRtl
        ? { artwork: 'تصاویر اسب تیره فارسی', previous: 'تصویر قبلی', next: 'تصویر بعدی', pause: 'توقف نمایش تصاویر', resume: 'ادامه نمایش تصاویر' }
        : { artwork: 'Persian Dark Horse artwork', previous: 'Previous image', next: 'Next image', pause: 'Pause slideshow', resume: 'Resume slideshow' }} />

      <article lang="en" dir="ltr" className="space-y-8 text-left">
        <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-surface to-background px-5 py-8 sm:px-9 sm:py-11">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
          <p className="relative text-[11px] font-bold tracking-[.16em] text-primary">ABOUT US</p>
          <h1 className="relative mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Persian Dark Horse</h1>
          <p className={`relative mt-4 max-w-3xl ${p}`}>
            Welcome to the world of <strong>Persian Dark Horse</strong>, the ultimate platform for all your AI needs. Our website was created with a simple purpose in mind – <strong>to solve the problem of multiple subscriptions and massive money expenses.</strong> We understand the frustration of having to write thousands of codes just to create a small icon in your app. That's why we are here to make your life easier.
          </p>
        </header>

        <section aria-labelledby="about-one-place" className="space-y-3 px-1 sm:px-2">
          <h2 id="about-one-place" className={h2}>Everything in one place</h2>
          <p className={p}>
            With Persian Dark Horse, you have access to <strong>all the tools you need in the palm of your hand.</strong> No more opening multiple apps or websites to stay updated with the latest news. We have it all covered for you. Our website is equipped with the best AI models and is constantly updated on a daily basis.
          </p>
        </section>

        <section aria-labelledby="about-your-agent" className="space-y-4 rounded-3xl border border-border bg-surface p-5 sm:p-8">
          <h2 id="about-your-agent" className={h2}>Create your own AI agent</h2>
          <p className={p}>
            But that's not all, we also offer you the unique opportunity to <strong>create your own AI agent.</strong> Yes, you heard it right. With Persian Dark Horse, you can customize your agent's permissions and choose from a variety of AI models such as Seedance 2:5, the best video generation AI, Open AI Chat GPT models like Astra, Luna, Sol, Terra, or even Google Gemini Omni for videos, Nano Banana for pictures, and many more. You can even create your agent's <strong>character, face, and gender</strong> – just like creating a human.
          </p>
          <p role="note" data-testid="text-about-model-note" className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm leading-6 text-foreground/85">
            <Info size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <span>Model names above are examples from our brand story. Available models, features, and access depend on the current catalog and your plan.</span>
          </p>
        </section>

        <section aria-labelledby="about-share" className="space-y-4 px-1 sm:px-2">
          <h2 id="about-share" className={h2}>Share it, build with it</h2>
          <p className={p}>
            Don't keep your masterpiece to yourself, <strong>share your agent with the public</strong> and let others see the wonders of your creation. And for all the developers out there, you can <strong>get an API key for your agent</strong> and integrate it into your website. We offer <strong>five different agents</strong> for various tasks – Manika for art and promoting, Negar for coding and website development, Arta for gaming, Arwin for money and investment assistance, and FEZI, the mastermind AI.
          </p>
          <ul aria-label="Our five agents" className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 lg:grid-cols-5">
            {agents.map(([name, role]) => (
              <li key={name} className="rounded-2xl border border-border bg-surface/70 px-4 py-3">
                <span className="block font-semibold text-foreground">{name}</span>
                <span className="block text-xs leading-5 text-muted-foreground">{role}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="about-founder" className="space-y-3 rounded-3xl border border-primary/20 bg-primary/5 p-5 sm:p-8">
          <h2 id="about-founder" className={h2}>Built by one person</h2>
          <p className={p}>
            Persian Dark Horse was created by one person – <strong>Fazel Esmaeil Zadeh, also known as FEZI.</strong> And the best part? He didn't use a computer, <strong>just a Xiaomi phone and a lot of hard work.</strong> Our company is named Persian Dark Horse and we have some massive projects in the pipeline. We are proud to announce the launch of our <strong>AI app store</strong> where we will be sharing our apps first.
          </p>
        </section>

        <section aria-labelledby="about-journey" className="space-y-3 px-1 sm:px-2">
          <h2 id="about-journey" className={h2}>Join the journey</h2>
          <p className={p}>
            Our tone of voice is <strong>friendly and formal</strong> because we want to ensure that our customers feel welcomed and valued. At Persian Dark Horse, we believe in the power of AI and its ability to simplify our lives. Join us on this journey and experience the wonders of our platform firsthand. We are committed to making your experience with us a seamless and hassle-free one. So why wait? Visit our website now and say hello to your new AI companion, <strong>Persian Dark Horse.</strong>
          </p>
        </section>
      </article>

      <section aria-labelledby="about-social-heading">
        <h2 id="about-social-heading" className="mb-4 text-xl font-semibold">{isRtl ? 'شبکه‌های اجتماعی رسمی' : 'Our official social accounts'}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map(({ name, handle, href, Icon }) => (
            <a key={name} href={href} target="_blank" rel="noopener noreferrer"
              className="flex min-h-28 items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              aria-label={`${name} ${handle} — ${isRtl ? 'بازکردن پروفایل' : 'Open profile'}`}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={21} /></span>
              <span className="min-w-0 flex-1"><span className="block font-semibold">{name}</span><span dir="ltr" className="mt-1 block break-all text-sm text-muted-foreground">{handle}</span></span>
              <ExternalLink size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          ))}
        </div>
      </section>
      <p className="text-sm text-muted-foreground">{isRtl ? 'برای پرسش یا پشتیبانی با ما در تماس باشید.' : 'Have a question or need help?'}{' '}
        <a href={`${basePath}/support`} className="font-semibold text-primary underline underline-offset-4">{isRtl ? 'تماس و پشتیبانی' : 'Contact and support'}</a>
      </p>
    </main>
  );
}
