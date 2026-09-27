import { ReactNode, useState, useEffect, useRef } from 'react';
import { useAuth, useClerk, useUser } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { useTranslation } from '../lib/i18n';
import { useLocalStore } from '../lib/store';
import { useAccount } from '../lib/account';
import { accountAvatarSource, defaultFeziAvatar } from '../lib/avatar-options';
import horseRoundLogo from '@/assets/persian-dark-horse-round-small.webp';
import { 
  Grid2X2, MessageSquare, History, User, Palette,
   FolderOpen, Link as LinkIcon, Zap, Users,
   CreditCard, Settings, ShieldCheck, Menu, X, Search, ChevronLeft, ChevronRight, Grid3X3, LifeBuoy, CircleHelp, KeyRound, DatabaseZap, Bot, UserRound, Gem, Images, Video, Mic2, Code2, Home, Gift
} from 'lucide-react';
import { WalletConnectButton } from './WalletConnectButton';
import { CommunityBell } from './community/CommunityBell';
import { CommunityNewsFooter } from './CommunityNewsFooter';
import { CommunityPresence } from './CommunityPresence';
import { GlobalSearch } from './GlobalSearch';

export function Shell({ children }: { children: ReactNode }) {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileMenuTrigger = useRef<HTMLButtonElement>(null);
  const mobileMenuOpener = useRef<HTMLButtonElement | null>(null);
  const mobileDrawer = useRef<HTMLElement>(null);
  const [location] = useLocation();
  const { t, isRtl } = useTranslation();
  const { language } = useLocalStore(s => s.appSettings);
  const { sidebarCollapsed } = useLocalStore(s => s.personalization);
  const setAppSettings = useLocalStore(s => s.setAppSettings);
  const setPersonalization = useLocalStore(s => s.setPersonalization);
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [languageSuggestion, setLanguageSuggestion] = useState<'en' | 'fa' | null>(null);
  const [languageSuggestionDismissed, setLanguageSuggestionDismissed] = useState(false);

  const toggleLanguage = () => {
    const newLang = language === 'en' ? 'fa' : 'en';
    setAppSettings({ language: newLang });
  };

  useEffect(() => {
    try {
      if (localStorage.getItem('fezi-language-suggestion-dismissed') === '1') {
        setLanguageSuggestionDismissed(true);
        return;
      }
      const browserLanguage = (navigator.languages?.[0] || navigator.language || '').toLowerCase().split('-')[0];
      if ((browserLanguage === 'en' || browserLanguage === 'fa') && browserLanguage !== language) {
        setLanguageSuggestion(browserLanguage);
      }
    } catch {
      // Browser locale and local storage may be unavailable; the language switch remains available.
    }
  }, []);

  const openGlobalSearch = () => {
    window.dispatchEvent(new Event('fezi-open-global-search'));
  };

  const dismissLanguageSuggestion = () => {
    setLanguageSuggestionDismissed(true);
    setLanguageSuggestion(null);
    try {
      localStorage.setItem('fezi-language-suggestion-dismissed', '1');
    } catch {
      // The suggestion is still dismissed for this visit when storage is unavailable.
    }
  };

  const toggleSidebar = () => {
    setPersonalization({ sidebarCollapsed: !sidebarCollapsed });
  };

  const openMobileMenu = (opener: HTMLButtonElement) => {
    mobileMenuOpener.current = opener;
    setMobileOpen(true);
  };
  const closeMobileMenu = (restoreFocus = false) => {
    setMobileOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => (mobileMenuOpener.current ?? mobileMenuTrigger.current)?.focus());
  };

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    mobileDrawer.current?.querySelector<HTMLButtonElement>('button[data-testid="button-close-mobile-menu"]')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileOpen(false);
        window.requestAnimationFrame(() => (mobileMenuOpener.current ?? mobileMenuTrigger.current)?.focus());
      }
      if (event.key === 'Tab' && mobileDrawer.current) {
        const focusable = Array.from(mobileDrawer.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  const navItems = [
    { href: '/profile', label: t('nav_profile'), icon: User },
    { href: '/workspace', label: t('nav_dashboard'), icon: Grid2X2 },
    { href: '/chat', label: t('nav_workspace'), icon: MessageSquare },
    { href: '/chat?history=1', label: isRtl ? 'تاریخچه چت' : 'Chat history', icon: History },
    { href: '/apps', label: t('nav_apps'), icon: Grid3X3 },
    { href: '/projects', label: t('nav_projects'), icon: FolderOpen },
    { href: '/prompt-studio', label: isRtl ? 'استودیو پرامپت' : 'Prompt Studio', icon: Images },
    { href: '/connectors', label: t('nav_connectors'), icon: LinkIcon },
    { href: '/skills', label: t('nav_skills'), icon: Zap },
    { href: '/my-agents', label: isRtl ? 'ایجنت‌های من' : 'My Agents', icon: Bot },
    { href: '/personalize', label: t('nav_personalize'), icon: Palette },
    { href: '/billing', label: t('nav_billing'), icon: CreditCard },
    { href: '/api-keys', label: t('nav_api_keys'), icon: KeyRound },
    { href: '/free-apis', label: t('nav_free_apis'), icon: DatabaseZap },
    { href: '/settings', label: t('nav_settings'), icon: Settings },
    { href: '/admin', label: t('nav_guardian'), icon: ShieldCheck },
    { href: '/support', label: t('nav_support'), icon: LifeBuoy },
    { href: '/community', label: isRtl ? 'کامیونیتی' : 'Community', icon: Users },
    { href: '/faq', label: t('nav_faq'), icon: CircleHelp },
    { href: '/referrals', label: isRtl ? 'رفرال' : 'Referrals', icon: Gift },
  ];
  const visibleNavItems = [
    { href: '/', label: isRtl ? 'خانه' : 'Home', icon: Home },
    ...navItems,
  ];
  const searchItems = [
    { href: '/', label: isRtl ? 'خانه' : 'Home', keywords: 'homepage welcome' },
    ...navItems,
    { href: '/studio/image', label: isRtl ? 'استودیو تصویر' : 'Image Studio', keywords: 'image create artwork photo' },
    { href: '/studio/video', label: isRtl ? 'استودیو ویدیو' : 'Video Studio', keywords: 'video create motion film' },
    { href: '/studio/voice', label: isRtl ? 'استودیو صدا' : 'Voice Studio', keywords: 'voice audio speech' },
    { href: '/studio/code', label: isRtl ? 'استودیو کد' : 'Code Studio', keywords: 'coding developer programming' },
    { href: '/about', label: isRtl ? 'درباره ما' : 'About FEZI', keywords: 'company about' },
  ];
  const mobileGroups = [
    {
      title: isRtl ? 'شروع' : 'Start here',
      items: [
        { href: '/', label: isRtl ? 'خانه' : 'Home', icon: Home },
         navItems[1], navItems[2], navItems[3], navItems[4], navItems[5], navItems[17],
      ],
    },
    {
      title: isRtl ? 'خلق و ساخت' : 'Create',
      items: [
        { href: '/studio/image', label: isRtl ? 'استودیو تصویر' : 'Image Studio', icon: Images },
        { href: '/studio/video', label: isRtl ? 'استودیو ویدیو' : 'Video Studio', icon: Video },
        navItems[6],
        { href: '/studio/voice', label: isRtl ? 'استودیو صدا' : 'Voice Studio', icon: Mic2 },
        { href: '/studio/code', label: isRtl ? 'استودیو کد' : 'Code Studio', icon: Code2 },
        navItems[9],
      ],
    },
    {
      title: isRtl ? 'ابزارها' : 'Tools',
      items: [navItems[7], navItems[8], navItems[12], navItems[13]],
    },
    {
      title: isRtl ? 'حساب و راهنما' : 'Account & help',
       items: [navItems[0], navItems[10], navItems[11], navItems[19], navItems[14], navItems[15], navItems[16], navItems[18], { href: '/about', label: isRtl ? 'درباره Persian Dark Horse' : 'About Persian Dark Horse', icon: Home }],
    },
  ];

  const quickAccessGroups = [
    {
      title: t('footer_group_explore'),
      links: [
        { href: '/', label: t('footer_homepage') },
        navItems[4],
        { href: '/apps', label: t('footer_applications') },
        { href: '/apps', label: t('footer_other_apps') },
      ],
    },
    {
      title: t('footer_group_workspace'),
      links: [navItems[1], navItems[2], navItems[3], navItems[5], navItems[7], navItems[8]],
    },
    {
      title: t('footer_group_account'),
      links: [
        navItems[0],
        navItems[9],
        navItems[11],
        navItems[19],
        ...(isSignedIn ? [
          navItems[10],
          { href: '/billing', label: t('footer_payments') },
          { href: '/billing', label: t('footer_buy_credits') },
        ] : []),
      ],
    },
    {
      title: t('footer_group_help_contact'),
      links: [
        navItems[15],
        navItems[18],
        { href: '/support', label: t('footer_contact_us') },
        { href: '/support#support-tickets', label: t('footer_send_ticket') },
        { href: '/support#support-feedback', label: t('footer_send_feedback') },
        { href: '/support#support-collaboration', label: t('footer_collaboration') },
      ],
    },
    {
      title: t('footer_group_legal'),
      links: [
        { href: '/', label: t('footer_about') },
        { href: '/', label: t('footer_terms') },
        { href: '/', label: t('footer_privacy') },
      ],
    },
  ];

  // Helper to check active state (exact for home, startsWith for others)
  const isActive = (href: string) => {
    if (href === '/') return location === '/';
    const showingChatHistory = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('history') === '1';
    if (href === '/chat?history=1') return location.startsWith('/chat') && showingChatHistory;
    if (href === '/chat') return (location.startsWith('/chat') && !showingChatHistory) || location.startsWith('/agents/');
    // Match /chat or /agents
    return location.startsWith(href);
  };
   const mobilePrimaryActive = location.startsWith('/workspace') || isActive('/chat') || location.startsWith('/studio/') || location.startsWith('/community');

  const Chevron = isRtl ? ChevronRight : ChevronLeft;
  const { account } = useAccount(Boolean(isSignedIn), userId);
  const profileAvatar = accountAvatarSource(account?.profile.avatarId, user) || defaultFeziAvatar;
  const profileName = account?.profile.displayName?.trim() || user?.fullName?.trim() || 'Persian Dark Horse account';
  const profileUsername = account?.profile.username;
  const { signOut } = useClerk();
  const signOutTo = (path: string) => {
    void signOut({ redirectUrl: path });
  };

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground selection:bg-primary/30 selection:text-primary">
      <CommunityPresence />
      <GlobalSearch items={searchItems} isRtl={isRtl} hideTrigger />
      {/* Desktop Sidebar */}
      <aside className={`
        hidden md:flex flex-col
        sticky top-0 h-screen z-40 
        bg-surface border-e border-border 
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'w-20' : 'w-72'}
      `}>
        <div className={`p-5 flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          <Link href="/" className="flex items-center gap-3 group">
            <img src={horseRoundLogo} alt="Persian Dark Horse" className="w-10 h-10 rounded-full object-cover border border-gold/30 transition-transform group-hover:scale-105 shrink-0" />
            {!sidebarCollapsed && <span className="font-sans font-bold text-base tracking-tight text-gold whitespace-nowrap">Persian Dark Horse</span>}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1 overflow-x-hidden">
          {visibleNavItems.map(({ href, label, icon: Icon }) => (
            <Link 
              key={href} 
              href={href}
              data-testid={href === '/' ? 'link-desktop-home' : undefined}
              className={`
                flex items-center rounded-xl transition-all tactile-button overflow-hidden
                ${sidebarCollapsed ? 'justify-center p-3 w-12 h-12 mx-auto' : 'gap-3 px-4 py-3'}
                ${isActive(href) 
                  ? 'bg-primary/10 text-primary font-semibold' 
                  : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'}
              `}
              title={sidebarCollapsed ? label : undefined}
            >
              <Icon size={18} strokeWidth={isActive(href) ? 2.5 : 2} className="shrink-0" />
              {!sidebarCollapsed && <span className="text-[14px] truncate">{label}</span>}
            </Link>
          ))}
        </nav>

        <div className={`p-4 border-t border-border flex flex-col gap-2`}>
          {isSignedIn ? (
            <Link href="/profile" className={`flex items-center gap-3 rounded-xl border border-border p-2 hover:bg-surface-hover ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <img src={profileAvatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              {!sidebarCollapsed && <span className="flex min-w-0 flex-col"><span className="truncate text-xs font-medium">{profileName}</span>{profileUsername && <span className="truncate text-[10px] text-muted-foreground">@{profileUsername}</span>}</span>}
            </Link>
          ) : (
            <a href={`${basePath}/sign-up`} className={`flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-2 text-primary hover:bg-primary/10 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <img src={horseRoundLogo} alt="" className="h-8 w-8 rounded-full object-cover" />
              {!sidebarCollapsed && <span className="min-w-0 truncate text-xs font-semibold">Create account</span>}
            </a>
          )}
          {isSignedIn && !sidebarCollapsed && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => signOutTo(`${basePath}/sign-in`)} className="rounded-xl px-2 py-2 text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground">Switch account</button>
              <button type="button" onClick={() => signOutTo(`${basePath}/`)} className="rounded-xl px-2 py-2 text-[11px] text-muted-foreground hover:bg-surface-hover hover:text-foreground">Sign out</button>
            </div>
          )}
          <button 
            onClick={toggleLanguage}
            className={`flex items-center justify-center rounded-xl border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-all tactile-button text-sm font-medium ${sidebarCollapsed ? 'p-3 w-12 h-12 mx-auto' : 'py-2 px-4 w-full gap-2'}`}
            title={sidebarCollapsed ? t(language === 'en' ? 'switch_to_fa' : 'switch_to_en') : undefined}
          >
            {sidebarCollapsed ? (language === 'en' ? 'فا' : 'EN') : t(language === 'en' ? 'switch_to_fa' : 'switch_to_en')}
          </button>
          
          <button
            onClick={toggleSidebar}
            className={`flex items-center justify-center rounded-xl text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-all tactile-button ${sidebarCollapsed ? 'p-3 w-12 h-12 mx-auto' : 'py-2 px-4 w-full'}`}
          >
            <Chevron size={20} className={`transition-transform ${sidebarCollapsed ? (isRtl ? '' : 'rotate-180') : ''}`} />
          </button>
        </div>
      </aside>

       {/* Mobile route directory */}
      <aside className={`
        fezi-mobile-drawer fixed inset-y-0 start-0 z-[61]
        bg-surface border-e border-border
        transform transition-transform duration-300 ease-in-out
        flex flex-col md:hidden
        ${mobileOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full' : '-translate-x-full')}
       `} ref={mobileDrawer} id="fezi-mobile-menu" role="dialog" aria-modal={mobileOpen ? 'true' : undefined} aria-label={isRtl ? 'فهرست بخش‌ها' : 'All sections'} aria-hidden={!mobileOpen} inert={!mobileOpen}>
         <div className="px-5 py-4 flex items-center justify-between border-b border-primary/20">
          <Link href="/" className="flex items-center gap-3 group" onClick={() => setMobileOpen(false)}>
            <img src={horseRoundLogo} alt="Persian Dark Horse" className="w-10 h-10 rounded-full object-cover border border-gold/30 transition-transform group-hover:scale-105 shrink-0" />
             <span className="flex flex-col"><span className="font-sans font-bold text-sm tracking-tight text-gold leading-tight whitespace-nowrap">Persian Dark Horse</span><span className="text-[10px] text-muted-foreground">{isRtl ? 'فضای کار شما' : 'Your workspace'}</span></span>
          </Link>
           <button type="button" data-testid="button-close-mobile-menu" aria-label={isRtl ? 'بستن منو' : 'Close menu'} onClick={() => closeMobileMenu(true)} className="fezi-mobile-control flex h-11 w-11 items-center justify-center text-muted-foreground hover:text-foreground rounded-xl border border-border hover:bg-surface-hover">
            <X size={20} />
          </button>
        </div>

         <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4" aria-label={isRtl ? 'همه بخش‌ها' : 'All routes'}>
          {mobileGroups.map(group => (
             <div key={group.title} className="mb-5">
               <p className="fezi-mobile-drawer-heading px-3 pb-2 pt-2 text-[11px] font-bold uppercase text-primary/80">{group.title}</p>
               <div className="grid grid-cols-1 gap-1">
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    data-testid={`link-mobile-menu-${href.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}`}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive(href) ? 'page' : undefined}
                     className={`fezi-mobile-menu-link flex min-w-0 items-center gap-3 rounded-xl px-3 py-2 text-start text-[13px] ${
                       isActive(href) ? 'font-semibold' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                    }`}
                  >
                     <span className="fezi-mobile-menu-icon"><Icon size={18} strokeWidth={isActive(href) ? 2.3 : 1.9} aria-hidden="true" /></span>
                     <span className="min-w-0 flex-1">{label}</span>
                     {isActive(href) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

         <div className="fezi-mobile-drawer-footer p-3 border-t border-primary/20 bg-surface">
          {isSignedIn ? (
            <>
              <Link href="/profile" onClick={() => setMobileOpen(false)} data-testid="link-mobile-drawer-profile" className="mb-2 flex min-h-12 items-center gap-3 rounded-xl border border-border p-2.5">
                <img src={profileAvatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                <span className="flex min-w-0 flex-col"><span className="truncate text-xs font-medium">{profileName}</span>{profileUsername && <span className="truncate text-[10px] text-muted-foreground">@{profileUsername}</span>}</span>
              </Link>
              <div className="mb-2 flex justify-center"><WalletConnectButton isRtl={isRtl} compact placement="above" /></div>
              <div className="mb-2 grid grid-cols-2 gap-2">
                <button type="button" data-testid="button-mobile-switch-account" onClick={() => signOutTo(`${basePath}/sign-in`)} className="min-h-11 rounded-xl px-2 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">{isRtl ? 'تغییر حساب' : 'Switch account'}</button>
                <button type="button" data-testid="button-mobile-sign-out" onClick={() => signOutTo(`${basePath}/`)} className="min-h-11 rounded-xl px-2 py-2 text-xs text-muted-foreground hover:bg-surface-hover hover:text-foreground">{isRtl ? 'خروج' : 'Sign out'}</button>
              </div>
            </>
          ) : (
            <div className="mb-2 grid grid-cols-2 gap-2">
              <a href={`${basePath}/sign-in`} data-testid="link-mobile-sign-in" className="flex min-h-11 items-center justify-center rounded-xl border border-border px-2 text-xs font-semibold text-foreground">{isRtl ? 'ورود' : 'Sign in'}</a>
              <a href={`${basePath}/sign-up`} data-testid="link-mobile-sign-up" className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-2 text-xs font-semibold text-primary-foreground">{isRtl ? 'ساخت حساب' : 'Create account'}</a>
            </div>
          )}
          <button type="button"
            data-testid="button-mobile-language"
            onClick={toggleLanguage}
            className="w-full flex min-h-11 items-center justify-center gap-2 px-4 rounded-xl border border-border text-muted-foreground hover:bg-surface-hover hover:text-foreground transition-all tactile-button text-sm font-medium"
          >
            {language === 'en' ? 'فارسی' : 'English'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="fezi-mobile-scroll flex-1 flex flex-col min-w-0 md:h-screen overflow-y-auto">
         <header className="fezi-mobile-header flex-shrink-0 flex items-center border-b border-border sticky top-0 z-30 md:hidden">
          <button
            type="button"
            aria-label={isRtl ? 'باز کردن منو' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="fezi-mobile-menu"
            ref={mobileMenuTrigger}
            data-testid="button-mobile-menu"
             onClick={(event) => openMobileMenu(event.currentTarget)}
             className="fezi-mobile-control flex h-11 w-11 shrink-0 items-center justify-center me-2 text-muted-foreground hover:text-primary rounded-xl hover:bg-primary/10"
          >
            <Menu size={22} />
          </button>
           <Link href="/workspace" data-testid="link-mobile-brand" className="fezi-mobile-header-brand flex min-w-0 items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
             <img src={horseRoundLogo} alt="" className="h-9 w-9 shrink-0 rounded-full border border-gold/40 object-cover" />
             <span className="min-w-0 text-[11px] font-bold leading-tight tracking-tight text-primary sm:text-sm">Persian Dark Horse</span>
          </Link>
           <div className="ms-auto flex items-center gap-1">
             <button type="button" data-testid="button-global-search-mobile" aria-label={isRtl ? 'جستجو' : 'Search'} title={isRtl ? 'جستجو' : 'Search'} onClick={openGlobalSearch} className="fezi-mobile-control flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover hover:text-primary">
               <Search size={19} aria-hidden="true" />
             </button>
            <CommunityBell />
            <Link
              href="/profile"
              aria-label={t('nav_profile')}
              title={t('nav_profile')}
              data-testid="link-mobile-profile"
              className={`fezi-mobile-control flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                isActive('/profile')
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-surface-hover hover:text-primary'
              }`}
            >
              <UserRound size={19} strokeWidth={2.1} />
            </Link>
            <Link
              href="/billing"
              aria-label={t('nav_billing')}
              title={t('nav_billing')}
              data-testid="link-mobile-billing"
              className={`fezi-mobile-control flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
                isActive('/billing')
                  ? 'border-primary/60 bg-primary/15 text-primary'
                  : 'border-primary/30 bg-primary/10 text-primary hover:border-primary/60 hover:bg-primary/15'
              }`}
            >
              <Gem size={19} strokeWidth={2.1} />
            </Link>
          </div>
        </header>
        
         <main className="fezi-mobile-main flex-1 md:p-8 lg:p-10 max-w-6xl mx-auto w-full md:pb-10">
          <div className="mb-4 hidden items-center justify-end gap-3 md:flex">
             <button type="button" data-testid="button-global-search-desktop" aria-label={isRtl ? 'جستجو' : 'Search'} title={isRtl ? 'جستجو' : 'Search'} onClick={openGlobalSearch} className="flex h-11 w-11 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover hover:text-primary">
               <Search size={19} aria-hidden="true" />
             </button>
            <CommunityBell />
            <Link href="/billing" aria-label={t('nav_billing')} className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/30 text-primary"><Gem size={20} /></Link>
          </div>
         {!languageSuggestionDismissed && languageSuggestion && languageSuggestion !== language && (
           <aside
             data-testid="notice-language-suggestion"
             className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center"
             dir={isRtl ? 'rtl' : 'ltr'}
             aria-label={isRtl ? 'پیشنهاد زبان' : 'Language suggestion'}
           >
             <p className="min-w-0 flex-1 text-sm leading-6 text-foreground">
               {language === 'fa'
                 ? (languageSuggestion === 'en' ? 'زبان مرورگر شما انگلیسی است. آیا می‌خواهید FEZI را به انگلیسی تغییر دهید؟' : 'زبان مرورگر شما فارسی است. تنظیم زبان FEZI با انتخاب شما انجام می‌شود.')
                 : (languageSuggestion === 'fa' ? 'Your browser is set to Persian. Would you like to use FEZI in Persian?' : 'Your browser is set to English. Would you like to use FEZI in English?')}
               <span className="mt-0.5 block text-xs text-muted-foreground">
                 {isRtl
                   ? 'این فقط زبان داخلی FEZI را تغییر می‌دهد؛ وب‌سایت‌ها نمی‌توانند پنجره Google Translate مرورگر را به‌اجبار باز کنند.'
                   : 'This changes FEZI’s built-in language; websites cannot force the Google Translate browser popup to open.'}
               </span>
             </p>
             <div className="flex shrink-0 items-center gap-2">
               <button
                 type="button"
                 data-testid="button-language-suggestion-switch"
                 onClick={() => {
                   setAppSettings({ language: languageSuggestion });
                   dismissLanguageSuggestion();
                 }}
                 className="min-h-10 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
               >
                 {languageSuggestion === 'fa' ? 'فارسی' : 'English'}
               </button>
               <button
                 type="button"
                 data-testid="button-language-suggestion-dismiss"
                 aria-label={isRtl ? 'بستن پیشنهاد زبان' : 'Dismiss language suggestion'}
                 onClick={dismissLanguageSuggestion}
                 className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"
               >
                 <X size={17} aria-hidden="true" />
               </button>
             </div>
           </aside>
         )}
          {children}
          {(location === '/' || location === '/workspace' || location === '/about') && <CommunityNewsFooter isRtl={isRtl} />}
        </main>

        {location === '/' && (
           <footer className="fezi-mobile-footer border-t border-border bg-surface/30 px-4 py-8 md:px-8 lg:px-10">
            <div className="mx-auto max-w-6xl">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {t('footer_quick_access')}
                </p>
                <p className="text-[10px] text-muted-foreground/70">{t('footer_all_rights')}</p>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-7 md:grid-cols-3 xl:grid-cols-5 md:gap-x-10">
                {quickAccessGroups.map((group) => (
                  <div key={group.title} className="min-w-0">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-primary/80">
                      {group.title}
                    </p>
                    <div className="grid gap-2">
                      {group.links.map(({ href, label }) => (
                        <Link key={`${group.title}-${label}`} href={href} className="w-fit text-[11px] text-muted-foreground transition-colors hover:text-primary">
                          {label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </footer>
        )}
      </div>

      <nav className="fezi-mobile-tabs flex md:hidden" aria-label={isRtl ? 'ناوبری اصلی' : 'Main navigation'}>
        {[
          { href: '/workspace', label: t('nav_dashboard'), icon: Grid2X2, active: location.startsWith('/workspace') },
          { href: '/chat', label: isRtl ? 'چت' : 'Chat', icon: MessageSquare, active: isActive('/chat') || isActive('/chat?history=1') },
          { href: '/studio/image', label: isRtl ? 'ساخت' : 'Create', icon: Images, active: location.startsWith('/studio/') },
          { href: '/community', label: isRtl ? 'کامیونیتی' : 'Community', icon: Users, active: location.startsWith('/community') },
        ].map(({ href, label, icon: Icon, active }) => (
          <Link key={href} href={href} data-testid={`link-mobile-tab-${href.slice(1).replace('/', '-')}`} className="fezi-mobile-tab" aria-current={active ? 'page' : undefined}>
            <Icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
            <span className="max-w-full truncate px-1">{label}</span>
          </Link>
        ))}
         <button type="button" data-testid="button-mobile-more" className="fezi-mobile-tab" aria-label={isRtl ? 'همه بخش‌ها' : 'More sections'} aria-controls="fezi-mobile-menu" aria-expanded={mobileOpen} aria-current={!mobilePrimaryActive ? 'page' : undefined} onClick={(event) => openMobileMenu(event.currentTarget)}>
          <Menu size={21} strokeWidth={!mobilePrimaryActive ? 2.3 : 1.9} aria-hidden="true" />
          <span>{isRtl ? 'بیشتر' : 'More'}</span>
        </button>
      </nav>

      {/* Mobile Overlay */}
       <div
         className={`fezi-mobile-overlay md:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
         aria-hidden="true"
         onClick={() => closeMobileMenu(true)}
       />
    </div>
  );
}