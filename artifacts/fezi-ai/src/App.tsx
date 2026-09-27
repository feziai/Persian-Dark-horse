import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ClerkProvider, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setAuthTokenGetter, useListAgents } from '@workspace/api-client-react';
import { Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

import { useLanguageEffect } from './lib/i18n';
import { useTranslation } from './lib/i18n';
import { useLocalStore } from './lib/store';
import { Shell } from './components/Shell';

const DashboardPage = lazy(() => import('./pages/Dashboard'));
const ChatPage = lazy(() => import('./pages/Chat'));
const AgentPage = lazy(() => import('./pages/Agent'));
const ProjectsPage = lazy(() => import('./pages/Projects'));
const ManikaPromptsPage = lazy(() => import('./pages/ManikaPrompts'));
const ConnectorsPage = lazy(() => import('./pages/Connectors'));
const SkillsPage = lazy(() => import('./pages/Skills'));
const ProfilePage = lazy(() => import('./pages/Settings').then(module => ({ default: module.ProfilePage })));
const PersonalizePage = lazy(() => import('./pages/Settings').then(module => ({ default: module.PersonalizePage })));
const SettingsPage = lazy(() => import('./pages/Settings').then(module => ({ default: module.SettingsPage })));
const BillingPage = lazy(() => import('./pages/Billing'));
const AdminPage = lazy(() => import('./pages/Admin'));
const AppsPage = lazy(() => import('./pages/Apps'));
const SupportPage = lazy(() => import('./pages/Support'));
const ReferralsPage = lazy(() => import('./pages/Referrals'));
const FAQPage = lazy(() => import('./pages/FAQ'));
const AboutPage = lazy(() => import('./pages/About'));
const APIKeysPage = lazy(() => import('./pages/APIKeys'));
const FreeAPIsPage = lazy(() => import('./pages/FreeAPIs'));
const StudioPage = lazy(() => import('./pages/Studio'));
const CustomAgentsPage = lazy(() => import('./pages/CustomAgents'));
const CommunityPage = lazy(() => import('./pages/Community'));
const CommunityProfilePage = lazy(() => import('./pages/CommunityProfile'));
const CommunityMessagesPage = lazy(() => import('./pages/CommunityMessages'));
const PublicAgentSite = lazy(() => import('./pages/PublicAgentSite'));
import NotFound from '@/pages/not-found';
import horseRoundLogo from '@/assets/persian-dark-horse-round-small.webp';
import { ArrowRight, Bot, Code2, Image as ImageIcon, MessageSquare, Mic2, Search, Sparkles, Video, X } from 'lucide-react';
const NativeAuthPage = lazy(() => import('./components/NativeAuth').then(module => ({ default: module.NativeAuthPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

function AuthLoading() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-background text-primary"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;
}

function StudioAccessRoute() {
  const { id } = useParams<{ id: string }>();
  const { isLoaded, isSignedIn, userId } = useAuth();
  const { isRtl } = useTranslation();
  const [access, setAccess] = useState<{ userId: string; paid: boolean; error: boolean } | null>(null);
  const restricted = id === 'code' || id === 'voice';

  useEffect(() => {
    if (!restricted || !isLoaded || !isSignedIn || !userId) return;
    const controller = new AbortController();
    setAccess(null);
    fetch('/api/payments/status', { credentials: 'include', cache: 'no-store', signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ hasPaidAccess?: boolean }> : Promise.reject(new Error('Subscription status unavailable')))
      .then((data) => { if (!controller.signal.aborted) setAccess({ userId, paid: data.hasPaidAccess === true, error: false }); })
      .catch(() => { if (!controller.signal.aborted) setAccess({ userId, paid: false, error: true }); });
    return () => controller.abort();
  }, [restricted, isLoaded, isSignedIn, userId]);

  if (!restricted) return <StudioPage />;
  if (!isLoaded || (isSignedIn && (!access || access.userId !== userId))) return <AuthLoading />;
  if (isSignedIn && access?.paid) return <StudioPage />;
  return (
    <div className="mx-auto my-12 max-w-lg rounded-2xl border border-primary/30 bg-surface p-6 text-center sm:p-8" data-testid="studio-subscription-gate">
      <h1 className="text-xl font-bold">{id === 'code' ? (isRtl ? 'استودیو کد' : 'Code Studio') : (isRtl ? 'استودیو صدا' : 'Voice Studio')}</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {!isSignedIn ? (isRtl ? 'برای باز کردن این استودیو ابتدا وارد حساب شوید و اشتراک بخرید.' : 'Sign in and purchase a subscription to open this studio.')
          : access?.error ? (isRtl ? 'بررسی اشتراک ممکن نشد. دوباره تلاش کنید.' : 'Could not check your subscription. Please try again.')
          : (isRtl ? 'برای باز کردن این استودیو به اشتراک فعال نیاز دارید.' : 'An active subscription is required to open this studio.')}
      </p>
      <a href={`${basePath}${isSignedIn ? '/billing' : '/sign-in'}`} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground">
        {isSignedIn ? (isRtl ? 'دیدن اشتراک‌ها' : 'View subscriptions') : (isRtl ? 'ورود به حساب' : 'Sign in')}
      </a>
    </div>
  );
}

const landingSearchItems = [
  {
    id: 'chat',
    label: 'Persian Dark Horse Chat',
    description: 'Talk with specialized AI Agents in English or Persian.',
    keywords: 'chat conversation assistant گفتگو چت دستیار',
    href: '/chat?select=1',
    group: 'Workspace',
  },
  {
    id: 'image',
    label: 'AI Image Studio',
    description: 'Create and analyze images with AI.',
    keywords: 'image visual art تصویر عکس طراحی',
    href: '/studio/image',
    group: 'Create',
  },
  {
    id: 'prompt',
    label: 'Prompt Studio',
    description: 'Create, explore, and share prompts.',
    href: '/prompt-studio',
    keywords: 'prompt studio prompts پرامپت استودیو',
    group: 'Create',
  },
  {
    id: 'code',
    label: 'Coding Studio',
    description: 'Plan, write, review, and debug code.',
    keywords: 'code coding developer programming کد برنامه نویسی توسعه',
    href: '/studio/code',
    group: 'Create',
  },
  {
    id: 'research',
    label: 'Research Desk',
    description: 'Turn questions into focused research workflows.',
    keywords: 'research web search study پژوهش تحقیق جستجو',
    href: '/free-apis',
    group: 'Explore',
  },
  {
    id: 'agents',
    label: 'AI Agents',
    description: 'Choose Agents for writing, analysis, strategy, and more.',
    keywords: 'agent agents tools متخصص ایجنت ابزار',
    href: '/chat?select=1',
    group: 'Explore',
  },
  {
    id: 'voice',
    label: 'Persian Voice',
    description: 'Use speech-to-text and natural Persian voice replies.',
    keywords: 'voice audio speech فارسی صدا صوت مکالمه',
    href: '/studio/voice',
    group: 'Workspace',
  },
  {
    id: 'projects',
    label: 'Projects',
    description: 'Keep your work, files, and generated outputs organized.',
    keywords: 'projects files workspace پروژه فایل کار',
    href: '/projects',
    group: 'Workspace',
  },
  {
    id: 'connectors',
    label: 'Connectors',
    description: 'Bring connected apps and tools into your workspace.',
    keywords: 'connectors integrations apps اتصال یکپارچه سازی اپلیکیشن',
    href: '/connectors',
    group: 'Workspace',
  },
  {
    id: 'profile',
    label: 'Profile & Memory',
    description: 'Personalize FEZI and save the preferences you choose.',
    keywords: 'profile memory personalization preferences پروفایل حافظه شخصی سازی',
    href: '/profile',
    group: 'Account',
  },
] as const;

const landingFooterGroups = [
  {
    title: 'Explore',
    links: [
      { id: 'homepage', label: 'Homepage', href: '/' },
      { id: 'agents', label: 'Agents', href: '/chat?select=1' },
      { id: 'apps', label: 'Apps', href: '/apps' },
      { id: 'applications', label: 'Applications', href: '/apps' },
      { id: 'other-apps', label: 'Other apps', href: '/apps' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { id: 'apps', label: 'Apps', href: '/apps' },
      { id: 'studios', label: 'Studios', href: '/studio/image' },
      { id: 'free-apis', label: 'Free API Explorer', href: '/free-apis' },
    ],
  },
  {
    title: 'Help & Contact',
    links: [
      { id: 'about', label: 'About us', href: '/about' },
      { id: 'contact', label: 'Contact Us', href: '/support' },
      { id: 'support', label: 'Support', href: '/support' },
       { id: 'faq', label: 'FAQ', href: '/faq' },
      { id: 'ticket', label: 'Send a Ticket', href: '/support#support-tickets' },
      { id: 'feedback', label: 'Send Feedback', href: '/support#support-feedback' },
      { id: 'collaboration', label: 'Collaboration', href: '/support#support-collaboration' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { id: 'terms', label: 'Terms', href: '/#landing-terms' },
      { id: 'privacy', label: 'Privacy', href: '/#landing-privacy' },
    ],
  },
] as const;

const landingCapabilityCards = [
  {
    id: 'agents',
    label: 'Agents',
    description: 'Specialists for writing, strategy, research, games, and code.',
    detail: 'Choose a specialist',
    href: '/chat?select=1',
    icon: Bot,
    accent: '#d4af37',
  },
  {
    id: 'chat',
    label: 'Persian Dark Horse Chat',
    description: 'A focused conversation space for English and Persian work.',
    detail: 'Preview the workspace',
    href: '/chat?select=1',
    icon: MessageSquare,
    accent: '#76c7ff',
  },
  {
    id: 'video',
    label: 'Video Studio',
    description: 'Shape scenes, motion, short films, and visual direction.',
    detail: 'Open the studio',
    href: '/studio/video',
    icon: Video,
    accent: '#e88bff',
  },
  {
    id: 'image',
    label: 'Image Studio',
    description: 'Develop image concepts, references, portraits, and campaigns.',
    detail: 'Open the studio',
    href: '/studio/image',
    icon: ImageIcon,
    accent: '#78d7c2',
  },
  {
    id: 'prompt',
    label: 'Prompt Studio',
    description: 'Create, explore, and share prompts.',
    detail: 'Open Prompt Studio',
    href: '/prompt-studio',
    icon: Sparkles,
    accent: '#d4af37',
  },
  {
    id: 'code',
    label: 'Coding Studio',
    description: 'Plan, explain, debug, and build software with a guided brief.',
    detail: 'Open the studio',
    href: '/studio/code',
    icon: Code2,
    accent: '#a9a0ff',
  },
  {
    id: 'voice',
    label: 'Voice Studio',
    description: 'Prepare narration, Persian voice work, and audio direction.',
    detail: 'Open the studio',
    href: '/studio/voice',
    icon: Mic2,
    accent: '#f3a2b9',
  },
] as const;

function LandingPage() {
  const [location] = useLocation();
  const { isRtl } = useTranslation();
  const insideShell = location === '/about' || location === '/faq/about';
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return landingSearchItems.slice(0, 6);

    return landingSearchItems
      .map((item) => {
        const label = item.label.toLocaleLowerCase();
        const description = item.description.toLocaleLowerCase();
        const keywords = item.keywords.toLocaleLowerCase();
        const score = label.startsWith(normalized)
          ? 100
          : label.includes(normalized)
            ? 80
            : keywords.startsWith(normalized)
              ? 70
              : keywords.includes(normalized)
                ? 55
                : description.includes(normalized)
                  ? 35
                  : 0;
        return { item, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label))
      .slice(0, 7)
      .map(({ item }) => item);
  }, [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const openSearch = () => {
    setSearchOpen(true);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const selectSuggestion = (href: string) => {
    window.location.href = `${basePath}${href}`;
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchOpen(true);
      setActiveIndex((index) => suggestions.length ? (index + 1) % suggestions.length : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => suggestions.length ? (index - 1 + suggestions.length) % suggestions.length : 0);
    } else if (event.key === 'Enter' && suggestions[activeIndex]) {
      event.preventDefault();
      selectSuggestion(suggestions[activeIndex].href);
    } else if (event.key === 'Escape') {
      setSearchOpen(false);
      searchRef.current?.blur();
    }
  };

  return (
    <main className={`bg-background text-foreground md:min-h-[100dvh] md:px-5 md:py-6 ${insideShell ? '-mx-4 -mt-4 px-4 pt-4 pb-2 md:mx-0 md:mt-0' : 'min-h-[100dvh] px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]'}`}>
      <div className="mx-auto flex max-w-6xl flex-col md:min-h-[calc(100dvh-3rem)] md:justify-between">
        <header className={`${insideShell ? 'hidden md:flex' : 'flex'} items-center justify-between gap-3`}>
          <a data-testid="link-landing-home" href={basePath || "/"} className="flex min-w-0 items-center gap-2.5 rounded-xl md:gap-3">
            <img src={horseRoundLogo} alt="Persian Dark Horse" className="h-10 w-10 shrink-0 rounded-full border border-primary/40 object-cover md:h-11 md:w-11" />
            <span className="text-sm font-bold tracking-tight text-primary md:text-base">Persian Dark Horse</span>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            <a href={`${basePath}/apps`} className="hidden rounded-xl px-4 py-2 text-sm text-muted-foreground hover:bg-surface-hover hover:text-foreground sm:inline-flex">{isRtl ? 'برنامه‌ها' : 'Apps'}</a>
            <a data-testid="link-landing-sign-in" href={`${basePath}/sign-in`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-medium text-foreground hover:bg-surface-hover md:min-h-0 md:border-0 md:bg-transparent md:py-2 md:font-normal md:text-muted-foreground md:hover:text-foreground">{isRtl ? 'ورود' : 'Sign in'}</a>
            <a data-testid="link-landing-header-sign-up" href={`${basePath}/sign-up`} className="hidden rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 md:inline-flex">{isRtl ? 'ساخت حساب' : 'Create account'}</a>
          </div>
        </header>
        <section className="pt-7 pb-6 md:py-16">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary md:text-xs md:tracking-[0.28em]">Persian Dark Horse · AI Workspace</p>
            <h1 className="mt-3 max-w-4xl text-[2rem] font-bold leading-[1.12] tracking-tight md:mt-5 md:text-6xl md:leading-tight">Welcome to Persian Dark Horse</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:mt-6 md:text-lg md:leading-8"><span className="md:hidden">Explore Agents and creative studios before joining. Sign up when you're ready to make something.</span><span className="hidden md:inline">Browse Agents, Chat, Video, Image, Code, Voice, and more before you create an account. Your first real message or generated output starts after secure registration.</span></p>
            <div className="relative mt-5 max-w-2xl md:mt-8">
              <div className={`flex min-h-12 items-center gap-3 rounded-2xl border bg-surface px-4 py-2 shadow-xl shadow-black/10 transition-colors md:py-3 ${searchOpen ? 'border-primary/70 ring-2 ring-primary/10' : 'border-border hover:border-primary/45'}`}>
                <Search size={20} className="shrink-0 text-primary" aria-hidden="true" />
                <input
                  data-testid="input-landing-search"
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={() => window.setTimeout(() => setSearchOpen(false), 140)}
                  placeholder="Search Persian Dark Horse capabilities…"
                  aria-label="Search Persian Dark Horse capabilities"
                  aria-expanded={searchOpen}
                  aria-controls="landing-search-results"
                  role="combobox"
                  autoComplete="off"
                  dir="auto"
                  className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
                />
                {query && (
                  <button data-testid="button-landing-clear-search" type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setQuery(''); openSearch(); }} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground" aria-label="Clear search">
                    <X size={16} />
                  </button>
                )}
                <span className="hidden rounded-md border border-border px-2 py-1 text-[10px] text-muted-foreground sm:inline-block">⌘ K</span>
              </div>
              {searchOpen && (
                <div ref={suggestionRef} id="landing-search-results" role="listbox" className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/30">
                  <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{query.trim() ? 'Closest matches' : 'Explore Persian Dark Horse'}</p>
                    {query.trim() && <span className="text-[10px] text-muted-foreground">{suggestions.length} result{suggestions.length === 1 ? '' : 's'}</span>}
                  </div>
                  {suggestions.length ? (
                    <div className="max-h-[min(21rem,45dvh)] overflow-y-auto overscroll-contain p-2 md:max-h-[min(24rem,60vh)]">
                      {suggestions.map((item, index) => (
                        <button
                          key={item.id}
                          data-testid={`button-landing-search-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeIndex}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectSuggestion(item.href)}
                          className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors md:py-3 ${index === activeIndex ? 'bg-primary/10' : 'hover:bg-surface-hover'}`}
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary"><Search size={15} /></span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-semibold text-foreground">{item.label}</span>
                              <span className="shrink-0 text-[10px] text-muted-foreground">{item.group}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>
                          </span>
                          <ArrowRight size={15} className="shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-7 text-center">
                      <p className="text-sm font-medium">No close match found</p>
                      <p className="mt-1 text-xs text-muted-foreground">Try a broader word like chat, image, code, or research.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 md:mt-8 md:flex md:flex-wrap md:gap-3">
              <a data-testid="link-landing-start" href={`${basePath}/sign-up`} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground md:px-5 md:py-3">Start with Persian Dark Horse</a>
              <a data-testid="link-landing-apps" href={`${basePath}/apps`} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-surface px-3 py-2 text-center text-sm font-semibold hover:bg-surface-hover md:px-5 md:py-3">Explore all Apps</a>
            </div>
          </div>
        </section>
        <section aria-labelledby="landing-capabilities" className="border-y border-border/80 py-5 md:py-10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">Product preview</p>
              <h2 id="landing-capabilities" className="mt-2 text-xl font-semibold md:text-2xl">Explore Persian Dark Horse</h2>
            </div>
            <p className="max-w-md text-xs leading-5 text-muted-foreground"><span className="md:hidden">Look around freely. Create an account to send or generate.</span><span className="hidden md:inline">Every card is open to inspect. Registration appears only when an action would create, send, or generate something.</span></p>
          </div>
          <div className="mt-4 grid gap-2 md:mt-6 md:grid-cols-2 md:gap-3 lg:grid-cols-3">
            {landingCapabilityCards.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.id} data-testid={`link-landing-capability-${item.id}`} href={`${basePath}${item.href}`} className="group flex min-h-[72px] items-center justify-between gap-3 rounded-2xl border border-border bg-surface/70 p-3 transition active:scale-[.99] hover:border-primary/55 hover:bg-surface md:block md:p-4 md:hover:-translate-y-0.5">
                  <div className="flex min-w-0 items-center gap-3 md:items-start">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-current/20 bg-background" style={{ color: item.accent }}>
                      <Icon size={19} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        {item.label}
                        <Sparkles size={12} className="text-primary/60 opacity-0 transition group-hover:opacity-100" />
                      </span>
                      <span className="mt-0.5 block text-xs leading-4 text-muted-foreground md:mt-1 md:leading-5">{item.description}</span>
                      {(item.id === 'code' || item.id === 'voice') && <span className="mt-1 block text-[11px] font-semibold text-primary">{isRtl ? 'نیازمند اشتراک' : 'Subscription required'}</span>}
                    </span>
                  </div>
                  <ArrowRight size={17} className="shrink-0 text-primary md:hidden" aria-hidden="true" />
                  <span className="mt-4 hidden text-[11px] font-semibold text-primary md:block">{item.detail} <ArrowRight size={12} className="ms-1 inline transition group-hover:translate-x-0.5" /></span>
                </a>
              );
            })}
          </div>
        </section>
        <section className="border-t border-border pt-5 pb-5 md:pt-7" aria-labelledby="landing-quick-access">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p id="landing-quick-access" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">Quick Access</p>
              <p className="text-[10px] text-muted-foreground/70">Explore Persian Dark Horse</p>
            </div>
            <nav aria-label="Quick Access" className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 md:gap-x-6 md:gap-y-7 lg:grid-cols-4">
              {landingFooterGroups.map((group) => (
                <div key={group.title} className="min-w-0">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-primary/80">{group.title}</p>
                  <div className="grid gap-0.5 md:gap-2">
                    {group.links.map((item) => (
                      <a
                        key={item.id}
                         data-testid={`link-landing-footer-${group.title.toLowerCase().replace(/[^a-z]+/g, '-')}-${item.id}`}
                        href={`${basePath}${item.href}`}
                        className="inline-flex min-h-9 w-fit items-center text-xs text-muted-foreground transition-colors hover:text-primary md:min-h-0 md:text-[11px]"
                      >
                        {item.label}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
            <div className="grid gap-4 border-t border-border/70 pt-5 text-[10px] leading-5 text-muted-foreground/75 sm:grid-cols-3">
              <p id="landing-about"><span className="font-semibold text-foreground/80">About us</span><br />A bilingual AI workspace for chat, creation, research, and Agents. <a href={`${basePath}/about`} className="text-primary underline underline-offset-2">Our social accounts</a></p>
              <p id="landing-terms"><span className="font-semibold text-foreground/80">Terms</span><br />Use Persian Dark Horse responsibly and keep your account activity secure.</p>
              <p id="landing-privacy"><span className="font-semibold text-foreground/80">Privacy</span><br />Your workspace history and preferences stay under your control.</p>
            </div>
          </div>
        </section>
        <footer className="text-xs text-muted-foreground">Persian Dark Horse · Private by design. You control your profile data.</footer>
      </div>
    </main>
  );
}

function HomeRedirect() {
  return <Redirect to="/workspace" />;
}

function SignInPage() {
  const redirectParam = new URLSearchParams(window.location.search).get('redirect_url');
  const redirectUrl = redirectParam?.startsWith('/')
    ? `${basePath}${redirectParam}`
    : `${basePath}/workspace`;
  return <NativeAuthPage mode="sign-in" basePath={basePath} redirectUrl={redirectUrl} />;
}

function SignUpPage() {
  const redirectParam = new URLSearchParams(window.location.search).get('redirect_url');
  const redirectUrl = redirectParam?.startsWith('/')
    ? `${basePath}${redirectParam}`
    : `${basePath}/workspace`;
  return <NativeAuthPage mode="sign-up" basePath={basePath} redirectUrl={redirectUrl} />;
}

function AgentShortcutPage() {
  const { agentSlug = '' } = useParams<{ agentSlug: string }>();
  const { data: agents, isLoading } = useListAgents();
  const normalizedSlug = agentSlug.trim().toLowerCase();
  const agent = agents?.find((item) => item.id === normalizedSlug || item.slug?.toLowerCase() === normalizedSlug);

  if (isLoading) return <AuthLoading />;
  if (!agent) return <NotFound />;
  return <Redirect to={`/chat?agent=${encodeURIComponent(agent.id)}`} />;
}

const portalRootPaths = new Set([
  'workspace', 'chat', 'apps', 'about', 'agents', 'projects', 'connectors', 'skills',
  'profile', 'personalize', 'settings', 'billing', 'api-keys', 'free-apis',
  'studio', 'my-agents', 'support', 'community', 'referrals',
]);

function AgentShortcutEntry() {
  const { agentSlug = '' } = useParams<{ agentSlug: string }>();
  if (portalRootPaths.has(agentSlug.trim().toLowerCase())) return <PortalRoutes />;
  return <AgentShortcutPage />;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== userId) queryClient.clear();
    previousUserId.current = userId;
  }), [addListener]);
  return null;
}

function ClerkApiAuthBridge() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);

  return null;
}

function GuestAccountPrompt() {
  const { isLoaded, isSignedIn } = useAuth();
  const { isRtl } = useTranslation();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    const onAuthRequired = (event: Event) => {
      const detail = (event as CustomEvent<{ reason?: string }>).detail;
      setReason(detail?.reason || '');
      setOpen(true);
    };
    window.addEventListener('fezi:auth-required', onAuthRequired);
    return () => window.removeEventListener('fezi:auth-required', onAuthRequired);
  }, [isLoaded, isSignedIn]);

  useEffect(() => {
    if (isSignedIn) setOpen(false);
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const request = input instanceof Request ? input : null;
      const method = (init?.method || request?.method || 'GET').toUpperCase();
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const response = await originalFetch(input, init);
      const isGuestMutation = !isSignedIn
        && method !== 'GET'
        && method !== 'HEAD'
        && response.status === 401
        && url.includes('/api/')
        && !url.includes('/api/admin/');
      if (isGuestMutation) {
        window.dispatchEvent(new CustomEvent('fezi:auth-required', {
          detail: { reason: isRtl ? 'برای استفاده از این قابلیت حساب رایگان بسازید.' : 'Create an account to start using this feature.' },
        }));
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [isLoaded, isSignedIn, isRtl]);

  if (!open || isSignedIn) return null;
  const redirectUrl = `${window.location.pathname}${window.location.search}`;
  const encodedRedirect = encodeURIComponent(redirectUrl);
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/70 px-3 py-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-4" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-account-title"
        className="my-auto max-h-full w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-primary/25 bg-surface p-5 shadow-2xl shadow-black/40 sm:p-6"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <ArrowRight size={22} />
        </div>
        <h2 id="guest-account-title" className="text-xl font-semibold text-foreground">{isRtl ? 'برای شروع، حساب Persian Dark Horse بسازید' : 'Create a Persian Dark Horse account to get started'}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {isRtl
            ? 'همهٔ بخش‌ها برای مشاهده و انتخاب باز هستند. برای ارسال اولین پیام، ساخت تصویر، ویدیو، Agent یا هر خروجی دیگر، افتتاح حساب رایگان لازم است.'
            : 'Everything is open to explore. Create a free account to send your first message or generate an image, video, Agent, or other output.'}
          {reason && (!isRtl || /[\u0600-\u06FF]/.test(reason)) && !['community', 'comment', 'upload_image'].includes(reason) ? ` ${reason}` : ''}
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:mt-6 sm:flex-row-reverse">
          <a
            href={`${basePath}/sign-up?redirect_url=${encodedRedirect}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {isRtl ? 'افتتاح حساب رایگان' : 'Create free account'}
          </a>
          <a
            href={`${basePath}/sign-in?redirect_url=${encodedRedirect}`}
            className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-surface-hover"
          >
            {isRtl ? 'ورود به حساب' : 'Sign in'}
          </a>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-3 min-h-11 w-full rounded-xl px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground sm:mt-4"
        >
          {isRtl ? 'ادامهٔ مشاهده بدون حساب' : 'Continue exploring without an account'}
        </button>
      </div>
    </div>
  );
}

function PortalRoutes() {
  const { isLoaded } = useAuth();
  const [path] = useLocation();
  useLanguageEffect();
  if (!isLoaded && path !== '/workspace') return <AuthLoading />;
  return (
    <Shell>
      <Suspense fallback={<div className="flex min-h-64 items-center justify-center text-primary" role="status" aria-label="Loading page"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
      <Switch>
        <Route path="/workspace" component={DashboardPage} />
        <Route path="/community/messages/:userId?" component={CommunityMessagesPage} />
        <Route path="/community/profile/:id" component={CommunityProfilePage} />
        <Route path="/community/post/:id" component={CommunityPage} />
        <Route path="/community" component={CommunityPage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/apps" component={AppsPage} />
        <Route path="/about" component={AboutPage} />
        <Route path="/agents/:id" component={AgentPage} />
        <Route path="/projects" component={ProjectsPage} />
        <Route path="/prompt-studio/*?" component={ManikaPromptsPage} />
        <Route path="/manika-prompts">
          <Redirect to="/prompt-studio" />
        </Route>
        <Route path="/connectors" component={ConnectorsPage} />
        <Route path="/skills" component={SkillsPage} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/personalize" component={PersonalizePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/billing" component={BillingPage} />
        <Route path="/api-keys" component={APIKeysPage} />
        <Route path="/free-apis" component={FreeAPIsPage} />
        <Route path="/studio/:id" component={StudioAccessRoute} />
        <Route path="/my-agents" component={CustomAgentsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/support" component={SupportPage} />
        <Route path="/referrals" component={ReferralsPage} />
        <Route path="/faq/about" component={AboutPage} />
        <Route path="/faq" component={FAQPage} />
        <Route component={NotFound} />
      </Switch>
      </Suspense>
    </Shell>
  );
}

export default function App() {
  const { language } = useLocalStore((store) => store.appSettings);
  if (!clerkPubKey) {
    throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  }
  return (
    <ErrorBoundary>
      <ClerkProvider
        publishableKey={clerkPubKey}
        proxyUrl={clerkProxyUrl}
        appearance={{
          theme: shadcn,
          cssLayerName: "clerk",
          options: {
            logoPlacement: "inside",
            logoLinkUrl: basePath || "/",
            logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
          },
          variables: {
            colorPrimary: "#D4AF37",
            colorForeground: "#F4F1E8",
            colorMutedForeground: "#A8A29A",
            colorDanger: "#F87171",
            colorBackground: "#171717",
            colorInput: "#0B0B0B",
            colorInputForeground: "#F4F1E8",
            colorNeutral: "#3A3731",
            fontFamily: "Inter, sans-serif",
            borderRadius: "0.9rem",
          },
          elements: {
            rootBox: "w-full flex justify-center",
            cardBox: "bg-[#171717] rounded-2xl w-[440px] max-w-full overflow-hidden",
            card: "!shadow-none !border-0 !bg-transparent !rounded-none",
            footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
            headerTitle: "text-[#F4F1E8]",
            headerSubtitle: "text-[#A8A29A]",
            socialButtonsBlockButtonText: "text-[#F4F1E8]",
            formFieldLabel: "text-[#D8D2C7]",
            footerActionLink: "text-[#D4AF37]",
            footerActionText: "text-[#A8A29A]",
            dividerText: "text-[#A8A29A]",
            formFieldInput: "bg-[#0B0B0B] text-[#F4F1E8] border-[#3A3731]",
            formButtonPrimary: "bg-[#D4AF37] text-[#171717] hover:bg-[#E6C85C]",
            socialButtonsBlockButton: "bg-[#0B0B0B] border-[#3A3731]",
            dividerLine: "bg-[#3A3731]",
            logoBox: "h-12",
            logoImage: "h-12 w-12",
            main: "bg-transparent",
          },
        }}
        signInUrl={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        localization={{
          signIn: { start: { title: language === 'fa' ? "خوش آمدید" : "Welcome back", subtitle: language === 'fa' ? "برای ورود به فضای کار Persian Dark Horse وارد شوید" : "Sign in to access your Persian Dark Horse workspace" } },
          signUp: { start: { title: language === 'fa' ? "حساب Persian Dark Horse خود را بسازید" : "Create your Persian Dark Horse account", subtitle: language === 'fa' ? "فضای کار و تاریخچهٔ خود را یکجا نگه دارید" : "Keep your workspace and history together" } },
        }}
        routerPush={(to) => {
          window.history.pushState({}, "", stripBase(to));
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
        routerReplace={(to) => {
          window.history.replaceState({}, "", stripBase(to));
          window.dispatchEvent(new PopStateEvent("popstate"));
        }}
      >
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <ClerkQueryClientCacheInvalidator />
            <ClerkApiAuthBridge />
            <GuestAccountPrompt />
            <Suspense fallback={<AuthLoading />}>
            <WouterRouter base={basePath}>
              <Switch>
                <Route path="/sign-in/*?" component={SignInPage} />
                <Route path="/sign-up/*?" component={SignUpPage} />
                <Route path="/admin" component={AdminPage} />
                <Route path="/agent-site/:slug" component={PublicAgentSite} />
                <Route path="/apps" component={PortalRoutes} />
                <Route path="/referrals" component={PortalRoutes} />
                <Route path="/faq/about" component={PortalRoutes} />
                <Route path="/faq" component={PortalRoutes} />
                <Route path="/about" component={PortalRoutes} />
                <Route path="/prompt-studio/*?" component={PortalRoutes} />
                <Route path="/manika-prompts" component={PortalRoutes} />
                <Route path="/:agentSlug" component={AgentShortcutEntry} />
                <Route path="/" component={HomeRedirect} />
                <Route component={PortalRoutes} />
              </Switch>
            </WouterRouter>
            </Suspense>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ClerkProvider>
    </ErrorBoundary>
  );
}
