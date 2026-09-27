import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { Link } from 'wouter';
import { useTranslation, type TranslationKey } from '../lib/i18n';
import { Card } from '../components/ui-parts';
import { ArrowUpRight, LockKeyhole, Sparkles, Video } from 'lucide-react';
import { videoAppCatalog } from '../lib/video-apps';
import { BrandLogo } from '../components/BrandLogo';

type AppCategory = 'models' | 'creation' | 'workflows';

type AIApp = {
  id: string;
  name: string;
  category: AppCategory;
  description: TranslationKey;
  icon: string;
  accent: string;
  provider?: string;
  capabilities?: string[];
  models?: string[];
  unlocked?: boolean;
  live?: boolean;
};
type LiveModel = {
  id: string;
  name: string;
  provider: string;
  providerLabel: string;
  free: boolean;
  supportsReasoning: boolean;
};
type LiveModelCategory = 'chat' | 'code' | 'image' | 'audio' | 'video';
type LiveModelCatalog = {
  modelCounts: Record<LiveModelCategory | 'total', number>;
  modelCatalog: Record<LiveModelCategory, LiveModel[]>;
};

const accents: Record<string, string> = { claude: '#e5b95a', deepseek: '#62a8ff', gapgpt: '#a98bff', openai: '#68d7a5', mistral: '#ff9c65', image: '#68c8ff', code: '#73e0bd', research: '#d4af37', voice: '#f58fba' };

const fallbackApps: AIApp[] = [
  { id: 'claude', name: 'Claude', category: 'models', description: 'app_desc_claude', icon: 'bot', accent: accents.claude, provider: 'Anthropic' },
  { id: 'deepseek', name: 'DeepSeek', category: 'models', description: 'app_desc_deepseek', icon: 'code', accent: accents.deepseek, provider: 'DeepSeek' },
  { id: 'gapgpt', name: 'Persian Dark Horse', category: 'models', description: 'app_desc_gapgpt', icon: 'zap', accent: accents.gapgpt, provider: 'Persian Dark Horse' },
  { id: 'openai', name: 'OpenAI', category: 'models', description: 'app_desc_openai', icon: 'sparkles', accent: accents.openai, provider: 'OpenAI' },
  { id: 'mistral', name: 'Mistral', category: 'models', description: 'app_desc_mistral', icon: 'bot', accent: accents.mistral, provider: 'Mistral' },
  { id: 'image', name: 'AI Image', category: 'creation', description: 'app_desc_image', icon: 'image', accent: accents.image },
  { id: 'code', name: 'Coding Studio', category: 'workflows', description: 'app_desc_code', icon: 'code', accent: accents.code },
  { id: 'research', name: 'Research Desk', category: 'workflows', description: 'app_desc_research', icon: 'search', accent: accents.research },
  { id: 'voice', name: 'Persian Voice', category: 'workflows', description: 'app_desc_voice', icon: 'mic', accent: accents.voice },
];

const rankedAppNames = [
  'Claude Code', 'Cline', 'CodeGPT', 'Codex', 'Cursor', 'DeepSeek Harness', 'Descript', 'Framer', 'Freebuff', 'Hello Minds',
  'Hermes Agent', 'HighLevel', 'ISEKAI ZERO', 'Janitor AI', 'Kilo Code', 'Lemonade', 'omp', 'OpenClaw', 'OpenHands', 'pi',
];

const rankedApps: AIApp[] = rankedAppNames.map((name, index) => ({
  id: `ranked-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  name,
  category: 'workflows',
  description: index < 6 ? 'app_desc_code' : index < 12 ? 'app_desc_research' : 'app_desc_claude',
  icon: index < 6 ? 'code' : 'sparkles',
  accent: index < 10 ? '#73e0bd' : '#d4af37',
  provider: 'Third-party app',
  capabilities: [index < 6 ? 'Coding & developer tools' : index < 12 ? 'Research & productivity' : 'Agent workflows', 'Uses Persian Dark Horse routing'],
  unlocked: false,
  live: true,
}));

const appRoutes: Record<string, string> = {
  claude: '/chat?tool=claude',
  deepseek: '/chat?tool=deepseek',
  gapgpt: '/chat?tool=gapgpt',
  openai: '/chat?tool=openai',
  mistral: '/chat?tool=mistral',
  image: '/studio/image',
  code: '/studio/code',
  research: '/free-apis',
  voice: '/studio/voice',
};

function getAppRoute(app: AIApp) {
  return appRoutes[app.id] ?? '/chat?select=1';
}

export default function AppsPage() {
  const { isSignedIn } = useAuth();
  const { t } = useTranslation();
  const [apps, setApps] = useState<AIApp[]>([...fallbackApps, ...rankedApps]);
  const [currentPlan, setCurrentPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [liveCatalog, setLiveCatalog] = useState<LiveModelCatalog | null>(null);
  const [liveCategory, setLiveCategory] = useState<LiveModelCategory>('chat');
  const [liveModelId, setLiveModelId] = useState('openrouter/free');
  const [appPage, setAppPage] = useState(1);
  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    fetch('/api/access/catalog', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('catalog unavailable')))
      .then((data: { apps?: AIApp[]; currentPlanId?: string }) => {
        if (data.apps?.length) setApps([
          ...data.apps.map((app) => ({
            ...app,
            provider: app.provider || 'Third-party app',
            accent: accents[app.id] || '#a98bff',
          })),
          ...rankedApps,
        ]);
        if (data.currentPlanId) setCurrentPlan(data.currentPlanId);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [isSignedIn]);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/openrouter/models', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<LiveModelCatalog> : Promise.reject(new Error('Persian Dark Horse catalog unavailable')))
      .then((data) => {
        if (!cancelled) {
          setLiveCatalog(data);
          setLiveModelId(data.modelCatalog.chat[0]?.id ?? 'openrouter/free');
        }
      })
      .catch(() => {
        if (!cancelled) setLiveCatalog(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const sections: Array<{ key: AppCategory; title: TranslationKey }> = [
    { key: 'models', title: 'apps_models' },
    { key: 'creation', title: 'apps_creation' },
    { key: 'workflows', title: 'apps_workflows' },
  ];
  const appPageSize = 10;
  const totalAppPages = Math.max(1, Math.ceil(apps.length / appPageSize));
  const pagedApps = apps.slice((appPage - 1) * appPageSize, appPage * appPageSize);
  const liveModels = liveCatalog?.modelCatalog[liveCategory] ?? [];
  const selectedLiveModel = liveModels.find((model) => model.id === liveModelId) ?? liveModels[0];

  return (
     <div className="fade-up min-w-0 space-y-6 md:space-y-8">
       <div className="rounded-3xl border border-primary/20 bg-[radial-gradient(circle_at_80%_0%,hsl(var(--primary)/.18),transparent_45%),linear-gradient(135deg,hsl(var(--surface)),hsl(var(--background)))] p-4 sm:p-6 md:p-8">
         <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">PERSIAN DARK HORSE</p>
          <h1 className="mt-3 text-2xl md:text-4xl font-bold leading-tight">{t('apps_title')}</h1>
           <p className="mt-3 text-sm leading-7 text-muted-foreground">{t('apps_desc')}</p>
            {isSignedIn && <p className="mt-4 text-xs text-primary">Current plan: <span className="font-mono">{currentPlan}</span> · {loading ? 'Syncing access…' : 'Access is checked by the server'}</p>}
        </div>
      </div>

       <Card className="min-w-0 overflow-hidden border-primary/25">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">LIVE MODEL UNIVERSE</p>
            <h2 className="mt-2 text-xl font-semibold">All available model options</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              This global catalog shows every live Persian Dark Horse capability. Each App limits its chat picker to models supported by that App.
            </p>
          </div>
          {liveCatalog && <div className="flex flex-wrap gap-1.5">
            {(Object.entries(liveCatalog.modelCounts) as Array<[string, number]>).map(([key, count]) => (
              <span key={key} className="rounded-full bg-primary/10 px-2 py-1 text-[10px] text-primary">{key}: {count}</span>
            ))}
          </div>}
        </div>
        {liveCatalog ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[.7fr_.9fr_1.5fr_7.5rem]">
            <select
              value={liveCategory}
              onChange={(event) => {
                const nextCategory = event.target.value as LiveModelCategory;
                const nextModels = liveCatalog.modelCatalog[nextCategory];
                setLiveCategory(nextCategory);
                setLiveModelId(nextModels[0]?.id ?? 'openrouter/free');
              }}
               className="min-h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary"
            >
              <option value="chat">Chat</option>
              <option value="code">Coding / tools</option>
              <option value="image">Image</option>
              <option value="audio">Audio</option>
              <option value="video">Video output</option>
            </select>
            <select
              value={selectedLiveModel?.id ?? 'openrouter/free'}
              onChange={(event) => setLiveModelId(event.target.value)}
               className="min-h-11 min-w-0 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-foreground outline-none focus:border-primary"
              dir="ltr"
            >
              {liveModels.map((model, index) => (
                <option key={model.id} value={model.id}>
                  {model.name} · {model.providerLabel}{model.supportsReasoning ? ' · reasoning' : ''} · Route {(index + 1).toString().padStart(2, '0')}
                </option>
              ))}
            </select>
            {selectedLiveModel && (
              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                <BrandLogo name={selectedLiveModel.name} id={selectedLiveModel.id} provider={selectedLiveModel.providerLabel} size={24} />
                <span className="min-w-0 truncate text-xs text-foreground">{selectedLiveModel.name}</span>
              </div>
            )}
             <Link href={`/chat?model=${encodeURIComponent(selectedLiveModel?.id ?? 'openrouter/free')}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
              Use in Chat <ArrowUpRight size={14} />
            </Link>
          </div>
        ) : (
          <p className="mt-4 text-xs text-muted-foreground">Live model catalog is temporarily unavailable.</p>
        )}
      </Card>

      {sections.map((section) => (
        <section key={section.key} className="space-y-4">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles size={18} className="text-primary" />
            {t(section.title)}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pagedApps.filter((app) => app.category === section.key).map((app) => {
                return (
                 <Link key={app.id} href={getAppRoute(app)} className="group block">
                 <Card className="relative h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-primary/50">
                  <div className="absolute -end-8 -top-8 h-24 w-24 rounded-full opacity-10 blur-2xl" style={{ backgroundColor: app.accent }} />
                  <div className="relative flex items-start gap-4">
                     <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-background" style={{ color: app.accent }}>
                       <Sparkles size={22} />
                    </div>
                     <div className="min-w-0">
                       <div className="flex flex-wrap items-center gap-2">
                       <div className="flex items-center gap-2"><BrandLogo name={app.name} id={app.id} provider={app.provider} size={22} /><h3 className="font-semibold">{app.name}</h3></div>
                          {isSignedIn && (app.unlocked ? <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">Included</span> : <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-400"><LockKeyhole size={10} /> {app.category === 'models' ? 'Rider+ required to send' : 'Plan required'}</span>)}
                         {app.live === false && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-muted-foreground">Catalog</span>}
                       </div>
                       <p className="mt-1 text-[11px] uppercase tracking-wider text-primary/80">{app.provider || (app.category === 'models' ? 'Persian Dark Horse model tier' : app.category === 'creation' ? 'Persian Dark Horse creation tool' : 'Persian Dark Horse workflow')}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(app.description)}</p>
                       {app.capabilities?.length ? <p className="mt-3 text-[11px] leading-5 text-muted-foreground">{app.capabilities.join(' · ')}</p> : null}
                    </div>
                  </div>
                     <span className="relative mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-primary transition-colors group-hover:border-primary/50 group-hover:bg-primary/10">
                      {app.category === 'models' ? 'Open chat' : app.unlocked ? t('apps_open') : 'Open app page'} <ArrowUpRight size={14} />
                    </span>
                </Card>
                 </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section id="video-apps" className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              <Video size={18} className="text-primary" />
              Video Apps
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              All video workflows available in Persian Dark Horse Video Studio. Open any card to inspect its controls and preview path.
            </p>
          </div>
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {videoAppCatalog.length} workflows
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {videoAppCatalog.map((app) => (
            <Link key={app.id} href={`/studio/video?tool=${encodeURIComponent(app.id)}`} className="group block">
              <Card className="relative h-full overflow-hidden transition-all hover:-translate-y-1 hover:border-primary/50">
                <div className="absolute -end-8 -top-8 h-24 w-24 rounded-full bg-fuchsia-400/20 opacity-60 blur-2xl transition-opacity group-hover:opacity-100" />
                <div className="relative flex items-start gap-4">
                   <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-fuchsia-300/25 bg-fuchsia-400/10 text-fuchsia-200">
                     <Video size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                       <div className="flex items-center gap-2"><BrandLogo name={app.name} id={app.id} size={22} /><h3 className="font-semibold">{app.name}</h3></div>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">Preview workflow</span>
                    </div>
                    <p className="mt-1 text-[11px] uppercase tracking-wider text-primary/80">Persian Dark Horse Video Studio</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{app.description}</p>
                    {isSignedIn && <p className="mt-3 text-[11px] font-semibold text-amber-300">{app.creditCost} Credits per successful output</p>}
                  </div>
                </div>
                 <span className="relative mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-primary transition-colors group-hover:border-primary/50 group-hover:bg-primary/10">
                  Open in Video Studio <ArrowUpRight size={14} />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Apps pages">
        {Array.from({ length: totalAppPages }, (_, index) => index + 1).map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => {
              setAppPage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
             className={`min-h-11 min-w-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${appPage === page ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-surface text-muted-foreground hover:border-primary/50 hover:text-primary'}`}
          >
            {page}
          </button>
        ))}
      </nav>
    </div>
  );
}