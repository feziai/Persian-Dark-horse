import { useEffect, useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import modelsImage from '../assets/welcome-banners/models.png';
import agentBuilderImage from '../assets/welcome-banners/create-agent.png';
import promptImage from '../assets/welcome-banners/prompt-gallery.webp';
import agentsImage from '../assets/welcome-banners/agents.webp';

type Banner = {
  id: string;
  title: string;
  text: string;
  imageUrl: string;
  buttonLabel: string;
  buttonHref: string;
  enabled: boolean;
  sortOrder: number;
  fa?: { title: string; text: string; buttonLabel: string };
  featuredAgents?: boolean;
};
export type WelcomeCarouselProps = { isRtl: boolean; agents?: { id: string; name: string }[] };

const featuredBanners: Banner[] = [
  {
    id: 'featured-agents', title: 'Meet the agents',
    text: 'Choose an agent below to open its page, then start or resume a chat.',
    fa: { title: 'با ایجنت‌ها آشنا شوید', text: 'یکی از ایجنت‌های زیر را انتخاب کنید تا صفحه‌اش باز شود و سپس گفتگو را آغاز یا ادامه دهید.', buttonLabel: 'دیدن همه ایجنت‌ها' },
    imageUrl: agentsImage, buttonLabel: 'Explore All Agents', buttonHref: '/apps', enabled: true, sortOrder: 0, featuredAgents: true,
  },
  {
    id: 'featured-plans', title: 'Explore Persian Dark Horse plans',
    text: 'Compare subscriptions and check the current checkout price. Promotional artwork does not apply a discount automatically.',
    fa: { title: 'پلن‌های فزی را ببینید', text: 'اشتراک‌ها و قیمت نهایی صفحه پرداخت را بررسی کنید. تصویر تبلیغاتی به‌تنهایی تخفیف اعمال نمی‌کند.', buttonLabel: 'اشتراک' },
    imageUrl: modelsImage, buttonLabel: 'Subscription', buttonHref: '/billing', enabled: true, sortOrder: 1,
  },
  {
    id: 'featured-prompts', title: 'Explore Prompt Studio',
    text: 'Search inside an unlimited photo gallery and discover prompts to inspire your next creation.',
    fa: { title: 'استودیو پرامپت را کشف کنید', text: 'در گالری نامحدود عکس‌ها جست‌وجو کنید و برای کار بعدی خود پرامپت پیدا کنید.', buttonLabel: 'استودیو پرامپت' },
    imageUrl: promptImage, buttonLabel: 'Prompt Studio', buttonHref: '/prompt-studio', enabled: true, sortOrder: 2,
  },
  {
    id: 'featured-create-agent', title: 'Create your own agent',
    text: 'Give your agent a purpose, personality and appearance, then manage how it is shared.',
    fa: { title: 'ایجنت خودتان را بسازید', text: 'برای ایجنت هدف، شخصیت و ظاهر تعیین کنید و نحوه اشتراک‌گذاری آن را مدیریت کنید.', buttonLabel: 'ساخت ایجنت' },
    imageUrl: agentBuilderImage, buttonLabel: "Let's Create an Agent", buttonHref: '/my-agents?create=1', enabled: true, sortOrder: 3,
  },
];

function safeHref(href: string) {
  if (href.startsWith('/') && !href.startsWith('//') && !href.startsWith('/\\')) return href;
  try { const url = new URL(href); if (url.protocol === 'https:') return url.href; } catch { /* Invalid link */ }
  return null;
}

export function WelcomeCarousel({ isRtl, agents = [] }: WelcomeCarouselProps) {
  const [managedBanners, setManagedBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<number | null>(null);
  const banners = [...featuredBanners, ...managedBanners];

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/community/banners', { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Banners unavailable (${response.status})`);
        const data: { banners: Banner[] } = await response.json();
        if (!Array.isArray(data.banners)) throw new Error('Invalid banners response');
        setManagedBanners(data.banners.filter((banner) => banner.enabled && banner.imageUrl?.trim()).sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(() => { /* The four bundled banners still work if managed banners are unavailable. */ });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (banners.length < 2 || paused || reducedMotion) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % banners.length), 7000);
    return () => window.clearInterval(timer);
  }, [banners.length, paused, reducedMotion]);

  const move = (by: number) => setIndex((current) => (current + by + banners.length) % banners.length);
  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) > 40 && banners.length > 1) move(distance < 0 ? 1 : -1);
  };

  const active = banners[index];
  const href = safeHref(active.buttonHref);
  const title = isRtl && active.fa ? active.fa.title : active.title;
  const text = isRtl && active.fa ? active.fa.text : active.text;
  const buttonLabel = isRtl && active.fa ? active.fa.buttonLabel : active.buttonLabel;

  return (
    <section aria-label={isRtl ? 'بنرهای خوش‌آمدگویی' : 'Welcome banners'} aria-roledescription="carousel" dir={isRtl ? 'rtl' : 'ltr'} tabIndex={0}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); move(event.key === 'ArrowRight' ? -1 : 1); } }}
      onTouchStart={(event) => { touchStart.current = event.touches[0].clientX; }} onTouchEnd={onTouchEnd}
      className="relative mb-7 min-w-0 overflow-hidden rounded-3xl border border-primary/25 bg-surface text-foreground shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-primary md:mb-10" data-testid="welcome-carousel">
      <div className="flex" dir="ltr" style={{ transform: `translateX(-${index * 100}%)`, transition: reducedMotion ? 'none' : 'transform 500ms ease' }}>
        {banners.map((banner, position) => (
          <div key={banner.id} aria-hidden={position !== index} className="min-w-0 w-full shrink-0" dir={isRtl ? 'rtl' : 'ltr'}>
            <img src={banner.imageUrl} alt="" className="aspect-[3/2] w-full bg-black object-contain" loading={position === 0 ? 'eager' : 'lazy'} />
          </div>
        ))}
      </div>
      <div className="relative border-t border-border bg-surface p-4 pb-16 sm:p-6 sm:pb-20">
        <h2 className="text-lg font-bold sm:text-2xl">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{text}</p>
        {active.featuredAgents && agents.length > 0 && (
          <nav aria-label={isRtl ? 'انتخاب ایجنت' : 'Choose an agent'} className="mt-4 flex flex-wrap gap-2">
            {agents.map((agent) => (
              <Link key={agent.id} href={`/agents/${encodeURIComponent(agent.id)}`}
                className="inline-flex min-h-11 items-center rounded-xl border border-primary/40 px-3 text-sm font-semibold text-foreground hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                {agent.name}
              </Link>
            ))}
          </nav>
        )}
        {href && buttonLabel?.trim() && (
          href.startsWith('https:')
            ? <a href={href} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground">{buttonLabel}</a>
            : <Link href={href} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground" data-testid="link-banner-cta">{buttonLabel}</Link>
        )}
      </div>
      <div className="absolute bottom-3 end-4 flex items-center gap-2 sm:bottom-5 sm:end-6">
        <button type="button" onClick={() => move(-1)} aria-label={isRtl ? 'بنر قبلی' : 'Previous banner'} data-testid="button-banner-previous" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground hover:border-primary"><ArrowLeft size={18} /></button>
        <span className="min-w-10 text-center text-xs text-muted-foreground" aria-live="polite">{index + 1} / {banners.length}</span>
        <button type="button" onClick={() => move(1)} aria-label={isRtl ? 'بنر بعدی' : 'Next banner'} data-testid="button-banner-next" className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground hover:border-primary"><ArrowRight size={18} /></button>
      </div>
    </section>
  );
}