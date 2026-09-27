import { Fragment, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { getGetDashboardQueryKey, useGetDashboard, useListAgents } from '@workspace/api-client-react';
import { useTranslation, useApiLocalization } from '../lib/i18n';
import { Card } from '../components/ui-parts';
import { Link } from 'wouter';
import { MessageSquare, Sparkles, Activity, Clock, Crown, ArrowRight, ArrowLeft, Folder, Plus, Shield, LayoutGrid } from 'lucide-react';
import horseRoundLogo from '@/assets/persian-dark-horse-round-small.webp';
import customAgentMaker from '@/assets/custom-agent-maker.svg';
import { AgentAvatar } from '../components/AgentAvatar';
import { StudioLogo, studioMeta, type StudioId } from '../components/StudioLogo';
import { SubscriptionBadge, SubscriptionHoverHint, SubscriptionPrompt } from '../components/SubscriptionPrompt';
import { requestGuestAccount } from '../lib/auth-gate';
import { WelcomeCarousel } from '../components/WelcomeCarousel';
import { SiInstagram, SiTelegram, SiThreads, SiX, SiYoutube } from 'react-icons/si';
import type { IconType } from 'react-icons';

const socialLinks: { name: string; handle: string; href: string; Icon: IconType }[] = [
  { name: 'Instagram', handle: '@pdh.ir', href: 'https://www.instagram.com/pdh.ir/', Icon: SiInstagram },
  { name: 'YouTube', handle: '@pdhyt', href: 'https://www.youtube.com/@pdhyt', Icon: SiYoutube },
  { name: 'Telegram', handle: '@Persiandarkhorse', href: 'https://t.me/Persiandarkhorse', Icon: SiTelegram },
  { name: 'Threads', handle: '@pdh.ir', href: 'https://www.threads.net/@pdh.ir', Icon: SiThreads },
  { name: 'X', handle: '@PersianDarkHors', href: 'https://x.com/PersianDarkHors', Icon: SiX },
];

export default function DashboardPage() {
  const { isSignedIn, userId } = useAuth();
  const { t, isRtl } = useTranslation();
  const apiLocale = useApiLocalization();
  const { data: dashboard, isLoading: dashLoading, isError: dashError, refetch: refetchDash } = useGetDashboard({ query: { queryKey: [...getGetDashboardQueryKey(), userId], enabled: Boolean(isSignedIn) } });
  const { data: agents, isLoading: agentsLoading, isError: agentsError, refetch: refetchAgents } = useListAgents();
  const [hasPaidAccess, setHasPaidAccess] = useState(false);
  const [hoveredPaidCard, setHoveredPaidCard] = useState<string | null>(null);
  const [subscriptionPromptOpen, setSubscriptionPromptOpen] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setHasPaidAccess(false);
      return;
    }
    let cancelled = false;
    fetch('/api/payments/status', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('billing status unavailable')))
      .then((data: { hasPaidAccess?: boolean }) => {
        if (!cancelled) setHasPaidAccess(Boolean(data.hasPaidAccess));
      })
      .catch(() => {
        if (!cancelled) setHasPaidAccess(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSignedIn]);

  const activeAgents = agents || [];
  const Arrow = isRtl ? ArrowLeft : ArrowRight;
  const studios = Object.keys(studioMeta) as StudioId[];

  return (
    <div className="fade-up min-w-0 pb-12 px-3 sm:px-4 md:px-0">

      {/* Hero Section */}
      <WelcomeCarousel isRtl={isRtl} agents={activeAgents.map((agent) => ({ id: agent.id, name: agent.name }))} />
      {((isSignedIn && dashError) || agentsError) && (
        <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <Shield size={18} className="shrink-0 text-red-400" />
          <span className="flex-1">{isRtl ? 'دریافت بخشی از اطلاعات داشبورد ناموفق بود.' : 'Some dashboard data could not be loaded.'}</span>
          <button type="button" onClick={() => { if (isSignedIn && dashError) refetchDash(); if (agentsError) refetchAgents(); }} className="rounded-lg bg-primary px-3 py-2 font-semibold text-primary-foreground">
            {isRtl ? 'تلاش دوباره' : 'Try Again'}
          </button>
        </div>
      )}

      {/* Top Stats */}
       <div className="delay-1 mb-9 grid grid-cols-1 gap-4 md:mb-12 md:grid-cols-3 md:gap-6">
        {/* Plan & Credits */}
        {isSignedIn && (
          <Card className="col-span-1 md:col-span-2 relative overflow-hidden group bg-surface/40 border border-border/50 backdrop-blur-sm p-0 flex flex-col md:flex-row shadow-sm hover:shadow-[0_8px_30px_-15px_rgba(229,185,90,0.1)] transition-shadow">
            <div className="absolute -end-16 -top-16 w-64 h-64 bg-primary/10 rounded-full blur-[80px] group-hover:bg-primary/20 transition-all duration-700 pointer-events-none"></div>

             <div className="relative z-10 flex flex-1 flex-col justify-between border-b border-border/40 bg-gradient-to-br from-surface/50 to-transparent p-5 md:border-b-0 md:border-e md:p-8">
               <div className="mb-4 flex flex-wrap items-start justify-between gap-3 md:mb-6">
                 <div className="min-w-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{t('dash_plan')}</p>
                   <h3 className="mt-2 flex min-w-0 items-center gap-3 text-xl font-bold text-foreground md:text-3xl">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                      <Crown size={20} className="text-primary" />
                    </div>
                     <span className="min-w-0 break-words">{apiLocale.getDashboardPlan(dashboard?.plan || '')}</span>
                  </h3>
                </div>
                 <Link href="/billing" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary hover:text-primary-foreground md:min-h-0">
                  {t('dash_manage_plan')} <Arrow size={14} />
                </Link>
              </div>
            </div>

            <div className="flex-1 p-6 md:p-8 relative z-10 flex flex-col justify-center">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">{t('dash_credits')}</p>
                   <div className="flex min-w-0 flex-wrap items-baseline gap-1.5">
                     <span className="font-mono text-3xl font-bold tracking-tighter text-foreground md:text-4xl">{dashboard?.credits ?? '-'}</span>
                     <span className="font-mono text-sm text-muted-foreground">/ {dashboard?.creditsLimit ?? '-'}</span>
                  </div>
                </div>
                <div className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                  {dashboard?.usagePercent !== undefined ? `${dashboard.usagePercent.toFixed(1)}% ` : '- '}
                  {isRtl ? 'مصرف شده' : 'Used'}
                </div>
              </div>
              <div className="h-2.5 w-full bg-background/80 rounded-full overflow-hidden border border-border/50 p-px">
                <div className="h-full bg-gradient-to-r from-primary/60 via-primary to-primary/80 rounded-full transition-all duration-1000 relative overflow-hidden" style={{ width: `${dashboard?.usagePercent || 0}%` }}>
                  <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.4),transparent)] -translate-x-full animate-[shimmer_2.5s_infinite]"></div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Chats Card */}
        <Card className={`relative overflow-hidden group bg-surface/40 border border-border/50 backdrop-blur-sm p-6 md:p-8 flex flex-col justify-between shadow-sm hover:shadow-[0_8px_30px_-15px_rgba(229,185,90,0.1)] transition-shadow ${!isSignedIn ? 'col-span-1 md:col-span-3' : ''}`}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent group-hover:from-primary/10 transition-colors duration-500 pointer-events-none"></div>
          <div className="relative z-10">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{isSignedIn ? t('dash_chats') : (isRtl ? 'Persian Dark Horse را کشف کنید' : 'Explore Persian Dark Horse')}</p>
            {isSignedIn
              ? <h3 className="text-4xl md:text-5xl font-bold mt-3 font-mono tracking-tighter text-foreground">{dashboard?.chats ?? '-'}</h3>
              : <p className="mt-3 text-base text-muted-foreground">{isRtl ? 'ایجنت‌ها و ابزارها را ببینید؛ برای ساختن یا گفتگو، حساب رایگان بسازید.' : 'Browse agents and tools. Create a free account when you are ready to make something.'}</p>}
          </div>
        </Card>
      </div>

      {/* Universe Grid */}
      <div className="delay-2 mb-12">
        <div className="flex items-center justify-between mb-6 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground tracking-widest uppercase">
              <LayoutGrid size={18} className="text-primary" />
              {t('dash_universe')}
            </h2>
            <div className="hidden sm:block h-4 w-px bg-border/60"></div>
            <p className="hidden sm:block text-xs font-medium text-muted-foreground uppercase tracking-wider">{agentsLoading ? '…' : activeAgents.length} Agents</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {agentsLoading && Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl border border-border/40 bg-surface/40" aria-hidden="true" />
          ))}
          {activeAgents.map(agent => {
            const gated = isSignedIn && agent.status === 'locked' && agent.id !== 'monicah' && agent.id !== 'arta' && !hasPaidAccess;
            const card = (
              <div
                className={`relative h-full flex flex-col p-6 rounded-2xl border transition-all duration-300 overflow-hidden group ${
                  gated
                    ? 'bg-surface/30 border-border/40 hover:border-primary/30'
                    : 'bg-surface/50 border-border/60 hover:border-primary/50 hover:bg-surface hover:-translate-y-1 hover:shadow-[0_10px_30px_-15px_rgba(229,185,90,0.2)]'
                }`}
                onMouseEnter={() => gated && setHoveredPaidCard(`agent-${agent.id}`)}
                onMouseLeave={() => setHoveredPaidCard(null)}
              >
                {/* Background glow for unlocked on hover */}
                {!gated && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />}

                <div className="relative z-10 flex items-start justify-between mb-5">
                  <div className="h-14 w-14 overflow-hidden rounded-xl border border-border/80 bg-background/50 shrink-0 shadow-inner p-0.5" style={{ borderColor: `${agent.accent || 'var(--primary)'}44` }}>
                    <div className="h-full w-full rounded-[10px] overflow-hidden" style={{ color: agent.accent || 'var(--primary)' }}>
                      <AgentAvatar agentId={agent.id} name={agent.name} className="h-full w-full opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-110" />
                    </div>
                  </div>
                  {gated ? (
                    <SubscriptionBadge className="shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-background border border-border/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300">
                      <Arrow size={14} className="transition-transform duration-300" />
                    </div>
                  )}
                </div>

                <div className="relative z-10 mb-3">
                  <h4 className="font-bold text-foreground text-base tracking-tight">{agent.name}</h4>
                  <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mt-1">{apiLocale.getAgentSpecialty(agent)}</p>
                </div>

                <p className="relative z-10 text-sm text-muted-foreground line-clamp-3 mb-6 flex-1 leading-relaxed">
                  {apiLocale.getAgentDescription(agent)}
                </p>

                <div className="relative z-10 mt-auto flex justify-between items-center text-xs pt-4 border-t border-border/40">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></span>
                    </span>
                    {t('agent_ready')}
                  </span>
                </div>
                {gated && <SubscriptionHoverHint visible={hoveredPaidCard === `agent-${agent.id}`} />}
              </div>
            );

            const agentCard = <Link key={agent.id} href={`/agents/${encodeURIComponent(agent.id)}`} className="block h-full">{card}</Link>;

            return (
              <Fragment key={agent.id}>
                {agentCard}
                {agent.id === 'negar' && (
                  <Link
                    href="/my-agents?create=1"
                    onClick={(event) => {
                      if (!isSignedIn) {
                        event.preventDefault();
                        requestGuestAccount(isRtl ? 'برای ساخت ایجنت ابتدا ثبت‌نام کنید.' : 'Sign up to create an Agent.');
                      }
                    }}
                    className="group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-2xl border border-dashed border-primary/40 bg-primary/[0.02] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/80 hover:bg-primary/[0.05] hover:shadow-[0_10px_30px_-15px_rgba(229,185,90,0.2)]"
                  >
                    <div className="absolute -end-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-3xl transition-opacity duration-500 group-hover:opacity-100 group-hover:bg-primary/20 pointer-events-none" />

                    <div className="relative z-10 flex items-center justify-between mb-5">
                      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-primary/30 bg-background/50 shadow-inner p-1">
                        <img src={customAgentMaker} alt="" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="w-8 h-8 rounded-full bg-background border border-primary/30 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                        <Plus size={14} />
                      </div>
                    </div>

                    <div className="relative z-10 mb-3">
                      <h4 className="font-bold text-foreground text-base tracking-tight">{isRtl ? 'ساخت Agent جدید' : 'Create New Agent'}</h4>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-[0.15em] mt-1">{isRtl ? 'Agent شخصی من' : 'Build your own specialist'}</p>
                    </div>

                    <p className="relative z-10 mt-auto flex-1 text-sm leading-relaxed text-muted-foreground">
                      {isRtl ? 'Agent شخصی خودت را بساز، آموزش بده و برای استفاده آماده کن.' : 'Create, configure, and prepare your own personal AI Agent.'}
                    </p>
                  </Link>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* Studios Section */}
      <section className="delay-2 mb-12">
        <div className="flex items-center justify-between mb-6 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground tracking-widest uppercase">
              <Sparkles size={18} className="text-primary" />
              {t('studios_title')}
            </h2>
            <div className="hidden sm:block h-4 w-px bg-border/60"></div>
            <p className="hidden sm:block text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('studios_desc')}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/prompt-studio" data-testid="link-dashboard-prompt-studio" className="group flex h-full min-h-48 flex-col rounded-2xl border border-primary/40 bg-primary/5 p-6 transition-colors hover:bg-primary/10">
            <Sparkles size={28} className="mb-5 text-primary" />
            <h3 className="text-base font-bold">{isRtl ? 'استودیو پرامپت' : 'Prompt Studio'}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{isRtl ? 'پرامپت‌ها را بسازید، ببینید و به اشتراک بگذارید.' : 'Create, explore and share prompts.'}</p>
          </Link>
          {studios.map((studioId) => {
            const studio = studioMeta[studioId];
            const gated = studio.requiresSubscription && !hasPaidAccess;
            const card = (
              <div
                className="relative group h-full flex flex-col p-6 rounded-2xl border border-border/60 bg-surface/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:bg-surface hover:shadow-[0_10px_30px_-15px_rgba(229,185,90,0.15)] overflow-hidden"
                onMouseEnter={() => gated && setHoveredPaidCard(`studio-${studioId}`)}
                onMouseLeave={() => setHoveredPaidCard(null)}
                onClick={() => gated && setSubscriptionPromptOpen(true)}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 pointer-events-none" style={{ background: `linear-gradient(135deg, ${studio.color} 0%, transparent 100%)` }} />

                <div className="relative z-10 flex items-start justify-between gap-3 mb-5">
                  <StudioLogo studioId={studioId} compact={false} />
                  {studio.requiresSubscription && gated && <SubscriptionBadge />}
                  {!gated && (
                    <div className="w-8 h-8 rounded-full bg-background border border-border/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300 opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100">
                      <Arrow size={14} />
                    </div>
                  )}
                </div>

                <div className="relative z-10 mt-auto">
                  <h3 className="font-bold text-foreground text-base tracking-tight mb-2">{t(studio.titleKey)}</h3>
                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{t(studio.descKey)}</p>
                </div>

                {gated && <SubscriptionHoverHint visible={hoveredPaidCard === `studio-${studioId}`} />}
              </div>
            );
            return gated
              ? <button key={studioId} type="button" className="block h-full w-full text-start" onClick={() => setSubscriptionPromptOpen(true)}>{card}</button>
              : <Link key={studioId} href={`/studio/${studioId}`} className="block h-full">{card}</Link>;
          })}
        </div>
      </section>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 delay-3">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6 border-b border-border/40 pb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-foreground tracking-widest uppercase">
              <Activity size={18} className="text-primary" />
              {isSignedIn ? t('dash_recent') : (isRtl ? 'برای شروع کاوش کنید' : 'Start exploring')}
            </h2>
          </div>

          <div className="bg-surface/30 border border-border/50 rounded-2xl overflow-hidden backdrop-blur-sm shadow-sm">
            <div className="divide-y divide-border/40">
              {isSignedIn ? dashboard?.recentActivity?.filter((act) => act.label !== 'Guardian').map((act, i) => (
                <div key={act.id || i} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 hover:bg-surface/60 transition-colors group">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-background/80 border border-border/50 flex items-center justify-center text-primary shrink-0 shadow-sm group-hover:border-primary/40 group-hover:bg-primary/5 transition-all">
                      {i % 2 === 0 ? <MessageSquare size={16} /> : <Folder size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{act.label}</p>
                      <p className="text-xs text-muted-foreground truncate mt-1">{apiLocale.getDashboardActivityDetail(act)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground font-mono shrink-0 sm:ms-auto ps-14 sm:ps-0 uppercase tracking-[0.1em] bg-background/50 px-2.5 py-1.5 rounded-lg border border-border/30">
                    <Clock size={12} className="text-primary/70" />
                    {apiLocale.getDashboardActivityTime(act)}
                  </div>
                </div>
              )) : (
                <div className="space-y-4 p-5 sm:p-8">
                  <p className="text-sm leading-7 text-muted-foreground">{isRtl ? 'پیش از ثبت‌نام، امکانات را بررسی کنید و ایجنت مناسب خود را انتخاب کنید.' : 'See what Persian Dark Horse can do and find the right agent before signing up.'}</p>
                  <div className="flex flex-wrap gap-3">
                    <Link href="/apps" className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50">{isRtl ? 'مشاهده ابزارها' : 'Browse tools'}</Link>
                    <Link href="/prompt-studio" className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50">{isRtl ? 'استودیو پرامپت' : 'Prompt Studio'}</Link>
                    <Link href="/about" className="rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground hover:border-primary/50">{isRtl ? 'درباره Persian Dark Horse' : 'About Persian Dark Horse'}</Link>
                  </div>
                </div>
              )}
              {isSignedIn && !dashLoading && !dashboard?.recentActivity?.length && (
                <div className="p-16 text-center flex flex-col items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-surface/50 border border-border/50 flex items-center justify-center text-muted-foreground/30 mb-4 shadow-inner">
                    <Activity size={24} />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">{t('dash_no_activity')}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Brand identity area */}
        <div className="hidden lg:flex flex-col items-center justify-center text-center p-8 border border-border/50 rounded-2xl bg-surface/30 backdrop-blur-sm relative overflow-hidden h-full min-h-[340px] shadow-sm group">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background/0 to-background/0 pointer-events-none transition-opacity duration-1000 group-hover:opacity-100 opacity-60"></div>
          <div className="absolute bottom-0 w-full h-1/2 bg-gradient-to-t from-background to-transparent pointer-events-none"></div>

          <div className="relative z-10 w-32 h-32 mb-8">
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse pointer-events-none"></div>
            <img src={horseRoundLogo} alt="Persian Dark Horse" className="w-full h-full rounded-full object-cover border border-primary/30 shadow-[0_0_30px_rgba(229,185,90,0.15)] relative z-10 bg-background group-hover:scale-105 transition-transform duration-700" />
          </div>

          <h3 className="text-xl font-black tracking-tight text-foreground relative z-10 mb-2">Persian Dark Horse</h3>
          <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em] relative z-10 mb-5">{isRtl ? 'فضای کار هوش مصنوعی' : 'AI WORKSPACE'}</p>

          <p className="text-sm text-muted-foreground relative z-10 max-w-[220px] leading-relaxed font-medium">
            {t('brand_tagline')}
          </p>
        </div>
      </div>

      <footer aria-labelledby="dashboard-social-heading" className="mt-8 mb-4 rounded-2xl border border-border/50 bg-surface/50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5 sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-3">
          <h2 id="dashboard-social-heading" className="text-sm font-semibold text-foreground">
            {isRtl ? 'ما را دنبال کنید' : 'Follow us'}
          </h2>
        </div>
        <nav aria-label={isRtl ? 'شبکه‌های اجتماعی' : 'Social media'}>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {socialLinks.map(({ name, handle, href, Icon }) => (
              <li key={name} className="min-w-0">
                <a
                  href={href}
                  aria-label={`${name} ${handle}`}
                  className="flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-border/40 px-3 py-2 text-foreground transition-colors hover:border-primary/30 hover:bg-background/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Icon size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 truncate text-xs font-medium">{name}</span>
                  <span dir="ltr" className="min-w-0 break-all text-xs text-muted-foreground">{handle}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </footer>

      <SubscriptionPrompt open={subscriptionPromptOpen} onClose={() => setSubscriptionPromptOpen(false)} />
    </div>
  );
}
