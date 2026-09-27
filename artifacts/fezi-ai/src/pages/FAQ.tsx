import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, ChevronDown, CircleHelp, LifeBuoy, Search, X } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import BrandSlideshow from '../components/BrandSlideshow';
import { faqCategories } from './faq-content';

const copy = {
  en: {
    eyebrow: 'PERSIAN DARK HORSE HELP CENTER', title: 'Frequently asked questions',
    intro: 'Practical answers about using Persian Dark Horse, account access, payments, privacy and what each feature can—and cannot—do.',
    search: 'Search questions and answers', all: 'All topics',
    questions: 'questions', noResults: 'No matching questions found.',
    clear: 'Clear search', needHelp: 'Still need help?',
    contact: 'Contact support', supportText: 'Send us a ticket with the page, action and error details. Never include passwords or private keys.',
    artwork: 'Persian Dark Horse artwork', previous: 'Previous image', next: 'Next image', pause: 'Pause slideshow', resume: 'Resume slideshow', about: 'About Persian Dark Horse', aboutText: 'Our story, our five Agents and the person behind FEZI.',
  },
  fa: {
    eyebrow: 'مرکز راهنمای اسب تیره فارسی', title: 'پرسش‌های متداول',
    intro: 'پاسخ‌های کاربردی درباره استفاده از اسب تیره فارسی، دسترسی حساب، پرداخت، حریم خصوصی و توانایی‌ها و محدودیت‌های هر بخش.',
    search: 'جست‌وجو در پرسش‌ها و پاسخ‌ها', all: 'همه موضوعات',
    questions: 'پرسش', noResults: 'پرسشی با این جست‌وجو پیدا نشد.',
    clear: 'پاک‌کردن جست‌وجو', needHelp: 'هنوز به راهنمایی نیاز دارید؟',
    contact: 'تماس با پشتیبانی', supportText: 'با ذکر صفحه، عملیات و متن خطا تیکت بفرستید. رمز عبور یا کلید خصوصی را هرگز ارسال نکنید.',
    artwork: 'تصاویر اسب تیره فارسی', previous: 'تصویر قبلی', next: 'تصویر بعدی', pause: 'توقف نمایش تصاویر', resume: 'ادامه نمایش تصاویر', about: 'دربارهٔ اسب تیره فارسی', aboutText: 'داستان ما، پنج Agent و سازندهٔ FEZI (متن به انگلیسی).',
  },
};

export default function FAQPage() {
  const { lang } = useTranslation();
  const language = lang === 'fa' ? 'fa' : 'en';
  const c = copy[language];
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const query = search.trim().toLocaleLowerCase();

  useEffect(() => {
    document.title = `${c.title} | Persian Dark Horse`;
    return () => { document.title = 'Persian Dark Horse'; };
  }, [c.title]);

  const visible = useMemo(() => faqCategories
    .filter((group) => category === 'all' || group.id === category)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !query || `${item.question[language]} ${item.answer[language]} ${group.title[language]}`
        .toLocaleLowerCase().includes(query)),
    }))
    .filter((group) => group.items.length > 0), [category, language, query]);

  const total = faqCategories.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-1 pb-14 sm:px-2">
      <BrandSlideshow labels={c} />
      <header className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/12 via-surface to-background px-5 py-8 sm:px-9 sm:py-11">
        <div className="pointer-events-none absolute -end-12 -top-12 h-48 w-48 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <span className="relative inline-flex items-center gap-2 text-[11px] font-bold tracking-[.16em] text-primary"><CircleHelp size={15} />{c.eyebrow}</span>
        <h1 className="relative mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{c.title}</h1>
        <p className="relative mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">{c.intro}</p>
        <Link href="/faq/about" data-testid="link-faq-about" className="relative mt-5 inline-flex min-h-11 items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm text-foreground hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <span><span className="block font-semibold text-primary">{c.about}</span><span className="block text-xs text-muted-foreground">{c.aboutText}</span></span>
          <ArrowRight size={17} className="shrink-0 text-primary rtl:rotate-180" aria-hidden="true" />
        </Link>
        <div className="relative mt-7 flex max-w-2xl items-center gap-3 rounded-2xl border border-border bg-background/90 px-4 shadow-sm focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/20">
          <Search className="shrink-0 text-muted-foreground" size={19} aria-hidden="true" />
          <input
            type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder={c.search} aria-label={c.search}
            className="min-h-14 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          {search && <button type="button" onClick={() => setSearch('')} aria-label={c.clear} className="rounded-lg p-2 text-muted-foreground hover:text-foreground"><X size={17} /></button>}
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="group" aria-label={c.all}>
        <button type="button" onClick={() => setCategory('all')} aria-pressed={category === 'all'}
          className={`min-h-11 rounded-xl border px-4 py-2 text-sm transition-colors ${category === 'all' ? 'border-primary bg-primary/15 font-semibold text-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>
          {c.all} <span className="ms-1 opacity-70">{total}</span>
        </button>
        {faqCategories.map((group) => (
          <button key={group.id} type="button" onClick={() => setCategory(group.id)} aria-pressed={category === group.id}
            className={`min-h-11 rounded-xl border px-4 py-2 text-sm transition-colors ${category === group.id ? 'border-primary bg-primary/15 font-semibold text-primary' : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'}`}>
            {group.title[language]} <span className="ms-1 opacity-70">{group.items.length}</span>
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="space-y-9">
          {visible.map((group) => (
            <section key={group.id} id={`faq-${group.id}`} aria-labelledby={`faq-title-${group.id}`} className="scroll-mt-24">
              <div className="mb-4 flex items-baseline gap-3 border-b border-border pb-3">
                <h2 id={`faq-title-${group.id}`} className="text-xl font-semibold text-foreground">{group.title[language]}</h2>
                <span className="text-xs text-muted-foreground">{group.items.length} {c.questions}</span>
              </div>
              <div className="space-y-2">
                {group.items.map((item, index) => (
                  <details key={`${group.id}-${index}-${query}`} open={query ? true : undefined}
                    className="group rounded-2xl border border-border bg-surface/70 open:border-primary/30 open:bg-surface">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-4 py-3 text-start text-sm font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:px-5 [&::-webkit-details-marker]:hidden">
                      <span>{item.question[language]}</span>
                      <ChevronDown size={18} className="shrink-0 text-primary transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="border-t border-border/70 px-4 pb-5 pt-4 text-sm leading-7 text-muted-foreground sm:px-5">{item.answer[language]}</div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div role="status" className="rounded-2xl border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">{c.noResults}</div>
      )}

      <aside className="flex flex-col gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-foreground"><LifeBuoy size={19} className="text-primary" />{c.needHelp}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">{c.supportText}</p>
        </div>
        <Link href="/support" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90">{c.contact}</Link>
      </aside>
    </main>
  );
}