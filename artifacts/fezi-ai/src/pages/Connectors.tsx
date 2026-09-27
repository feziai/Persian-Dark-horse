import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  Check, ChevronDown, ExternalLink, KeyRound, Link as LinkIcon,
  LoaderCircle, LockKeyhole, Plus, RefreshCw, Search, Server, ShieldCheck,
  Trash2, Wrench, X,
} from 'lucide-react';
import { useListAgents } from '@workspace/api-client-react';
import { useTranslation } from '../lib/i18n';
import { Button, Card, Input, Label, PageHeader } from '../components/ui-parts';
import { BrandLogo } from '../components/BrandLogo';

type CatalogItem = {
  id: string;
  name: string;
  description: string;
  kind: string;
  authType: string;
  status: string;
  capabilities: string[];
  docsUrl?: string;
};

type ConnectorTool = { name: string; description: string };
type Connection = {
  id: string;
  connectorId: string;
  name: string;
  endpoint?: string;
  status: string;
  authType: string;
  capabilities: string[];
  tools: ConnectorTool[];
  grantedAgentIds: string[];
  createdAt: string;
  updatedAt: string;
  lastError?: string;
};

type ConnectorPayload = {
  catalog: CatalogItem[];
  connections: Connection[];
  protocols: {
    agentApi: { endpoint: string; authentication: string };
    mcp: { endpoint: string; authentication: string; transport: string };
  };
};

type McpRegistryEntry = {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  sourceUrl: string;
};

type RegistryCategory = { slug: string; name: string; count: number };
type BuiltWithRegistryEntry = McpRegistryEntry & {
  category: string;
  endpoints: number;
  tools: number;
  added: string;
};
type BuiltWithRegistryPayload = {
  source: string;
  sourceUrl: string;
  categories: RegistryCategory[];
  category: string;
  page: number;
  entries: BuiltWithRegistryEntry[];
  totalOnPage: number;
  totalMatches: number;
  hasNext: boolean;
};

const mcpRegistryEntries: McpRegistryEntry[] = [
  {
    id: 'openrouter',
    name: 'Persian Dark Horse MCP',
    description: 'Connect Persian Dark Horse model discovery and routing tools through Streamable HTTP.',
    endpoint: 'https://mcp.openrouter.ai/mcp',
    sourceUrl: 'https://mcp.openrouter.ai/mcp',
  },
];

export default function ConnectorsPage() {
  const { t, isRtl } = useTranslation();
  const { data: agents, isLoading: agentsLoading } = useListAgents();
  const [payload, setPayload] = useState<ConnectorPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [registryQuery, setRegistryQuery] = useState('');
  const [registryCategory, setRegistryCategory] = useState('api-tools');
  const [registryPage, setRegistryPage] = useState(1);
  const [registryPayload, setRegistryPayload] = useState<BuiltWithRegistryPayload | null>(null);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [registryError, setRegistryError] = useState('');
  const [busy, setBusy] = useState('');
  const [permissions, setPermissions] = useState<Record<string, string[]>>({});

  const loadConnectors = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/connectors', { credentials: 'include' });
      if (!response.ok) throw new Error('connector load failed');
      const next = await response.json() as ConnectorPayload;
      setPayload(next);
      setPermissions(Object.fromEntries(next.connections.map((connection) => [connection.id, connection.grantedAgentIds])));
    } catch {
      setError(t('conn_load_error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadConnectors();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setRegistryLoading(true);
      setRegistryError('');
      const params = new URLSearchParams({
        category: registryCategory,
        page: String(registryPage),
        ...(registryQuery.trim() ? { query: registryQuery.trim() } : {}),
      });
      fetch(`/api/connectors/registry?${params.toString()}`, { credentials: 'include', signal: controller.signal })
        .then((response) => response.ok ? response.json() as Promise<BuiltWithRegistryPayload> : Promise.reject(new Error('registry unavailable')))
        .then((next) => setRegistryPayload(next))
        .catch((caught) => {
          if (!controller.signal.aborted) setRegistryError(caught instanceof Error ? caught.message : t('conn_registry_error'));
        })
        .finally(() => {
          if (!controller.signal.aborted) setRegistryLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [registryCategory, registryPage, registryQuery]);

  const catalog = useMemo(() => payload?.catalog ?? [], [payload]);
  const connections = payload?.connections ?? [];
  const customMcp = catalog.find((item) => item.id === 'custom-mcp');
  const notion = catalog.find((item) => item.id === 'notion');
  const registryEntries = registryPayload?.entries ?? [];
  const featuredRegistryEntries = mcpRegistryEntries.filter((entry) =>
    !registryQuery.trim() || `${entry.name} ${entry.description} ${entry.endpoint}`.toLowerCase().includes(registryQuery.trim().toLowerCase()),
  );

  const startNotionAuthorization = async () => {
    setBusy('notion');
    setNotice('');
    try {
      const response = await fetch('/api/connectors/notion/authorize', { method: 'POST', credentials: 'include' });
      const result = await response.json() as { status: string; redirectUrl?: string; message?: string };
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl);
      } else {
        setNotice(result.message || t('conn_setup_required'));
      }
    } catch {
      setError(t('conn_authorize_error'));
    } finally {
      setBusy('');
    }
  };

  const addCustomMcp = async () => {
    setBusy('custom-mcp');
    setError('');
    try {
      const response = await fetch('/api/connectors', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorId: 'custom-mcp', name: customName, endpoint: customEndpoint }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error || 'connection failed');
      }
      setCustomName('');
      setCustomEndpoint('');
      setShowCustomForm(false);
      setNotice(t('conn_connected'));
      await loadConnectors();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('conn_connect_error'));
    } finally {
      setBusy('');
    }
  };

  const selectRegistryEntry = (entry: McpRegistryEntry) => {
    setCustomName(entry.name);
    setCustomEndpoint(entry.endpoint);
    setShowCustomForm(true);
    setNotice('');
    window.setTimeout(() => document.getElementById('mcp-connection-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  };

  const updatePermissions = async (connectionId: string) => {
    setBusy(`permissions:${connectionId}`);
    setError('');
    try {
      const response = await fetch(`/api/connectors/${encodeURIComponent(connectionId)}/permissions`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentIds: permissions[connectionId] ?? [] }),
      });
      if (!response.ok) throw new Error('permissions failed');
      const updated = await response.json() as Connection;
      setPayload((current) => current ? {
        ...current,
        connections: current.connections.map((connection) => connection.id === updated.id ? updated : connection),
      } : current);
      setNotice(t('conn_permissions_saved'));
    } catch {
      setError(t('conn_permissions_error'));
    } finally {
      setBusy('');
    }
  };

  const revoke = async (connectionId: string) => {
    if (!window.confirm(t('conn_revoke_confirm'))) return;
    setBusy(`revoke:${connectionId}`);
    try {
      const response = await fetch(`/api/connectors/${encodeURIComponent(connectionId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('revoke failed');
      setNotice(t('conn_revoked'));
      await loadConnectors();
    } catch {
      setError(t('conn_revoke_error'));
    } finally {
      setBusy('');
    }
  };

  const togglePermission = (connectionId: string, agentId: string) => {
    setPermissions((current) => {
      const selected = current[connectionId] ?? [];
      return {
        ...current,
        [connectionId]: selected.includes(agentId)
          ? selected.filter((id) => id !== agentId)
          : [...selected, agentId],
      };
    });
  };

  return (
    <div className="fade-up mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={t('conn_title')}
        description={t('conn_desc')}
        action={
          <Button type="button" onClick={() => setShowCustomForm((current) => !current)}>
            {showCustomForm ? <X size={16} /> : <Plus size={16} />}
            {showCustomForm ? t('cancel') : t('conn_add_custom')}
          </Button>
        }
      />

      <Card className="border-primary/25 bg-primary/5">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 shrink-0 text-primary" size={20} />
          <div className="space-y-1">
            <p className="font-semibold">{t('conn_security_title')}</p>
            <p className="text-sm leading-6 text-muted-foreground">{t('conn_security_desc')}</p>
          </div>
        </div>
      </Card>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">{notice}</div>}

      <Card className="border-primary/25 bg-[radial-gradient(circle_at_100%_0%,hsl(var(--primary)/.14),transparent_50%)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t('conn_registry_label')}</p>
            <h2 className="mt-2 text-xl font-bold">{t('conn_registry_title')}</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t('conn_registry_desc')}</p>
          </div>
          <a
            href="https://builtwith.com/mcp-registry?utm_source=perplexity"
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-medium text-primary transition-colors hover:border-primary/50 hover:bg-primary/10"
          >
            {t('conn_registry_browse')} <ExternalLink size={14} />
          </a>
        </div>
        <div className="relative mt-5 max-w-xl">
          <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={registryQuery}
            onChange={(event) => setRegistryQuery(event.target.value)}
            placeholder={t('conn_registry_search')}
            className="ps-9"
            dir={isRtl ? 'rtl' : 'ltr'}
          />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0">{t('conn_registry_category')}</span>
            <select
              value={registryCategory}
              onChange={(event) => { setRegistryCategory(event.target.value); setRegistryPage(1); }}
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            >
              {(registryPayload?.categories ?? []).map((category) => (
                <option key={category.slug} value={category.slug}>{category.name} ({category.count})</option>
              ))}
            </select>
          </label>
          <span className="text-xs text-muted-foreground">
            {registryPayload?.source || 'BuiltWith MCP Registry'}
          </span>
        </div>
        {registryError && <p className="mt-3 text-sm text-red-300">{t('conn_registry_error')}</p>}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {featuredRegistryEntries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-border/80 bg-background/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 font-semibold"><BrandLogo name={entry.name} id={entry.id} endpoint={entry.endpoint} size={28} /><span className="truncate">{entry.name}</span></h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{entry.description}</p>
                </div>
              </div>
              <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground" dir="ltr">{entry.endpoint}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" onClick={() => selectRegistryEntry(entry)}>
                  <Plus size={15} /> {t('conn_registry_add')}
                </Button>
                <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-primary">
                  {t('conn_registry_source')} <ExternalLink size={12} />
                </a>
              </div>
            </div>
          ))}
          {registryLoading
            ? [1, 2, 3, 4].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl bg-background/60" />)
            : registryEntries.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-border/80 bg-background/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 font-semibold"><BrandLogo name={entry.name} id={entry.id} endpoint={entry.endpoint} size={28} /><span className="truncate">{entry.name}</span></h3>
                    <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{entry.description}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{registryPayload?.categories.find((item) => item.slug === entry.category)?.name || entry.category}</span>
                  <span>{entry.tools} {t('conn_tools_available')}</span>
                  <span>{entry.added}</span>
                </div>
                <p className="mt-3 truncate font-mono text-[11px] text-muted-foreground" dir="ltr">{entry.endpoint}</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" onClick={() => selectRegistryEntry(entry)}>
                    <Plus size={15} /> {t('conn_registry_add')}
                  </Button>
                  <a href={entry.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 text-xs text-muted-foreground hover:text-primary">
                    {t('conn_registry_source')} <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            ))}
          {!registryLoading && featuredRegistryEntries.length === 0 && registryEntries.length === 0 && <p className="text-sm text-muted-foreground">{t('conn_registry_empty')}</p>}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" size="sm" disabled={registryPage <= 1 || registryLoading} onClick={() => setRegistryPage((page) => Math.max(1, page - 1))}>
            {t('conn_registry_previous')}
          </Button>
          <span className="text-xs text-muted-foreground">{t('conn_registry_page')} {registryPage}</span>
          <Button type="button" variant="ghost" size="sm" disabled={registryLoading || !registryPayload?.hasNext} onClick={() => setRegistryPage((page) => page + 1)}>
            {t('conn_registry_next')}
          </Button>
        </div>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">{t('conn_registry_hint')}</p>
      </Card>

      {showCustomForm && (
        <div id="mcp-connection-form">
          <Card className="border-primary/50 border-2">
          <div className="mb-5 flex items-start gap-3">
            <Server className="mt-0.5 text-primary" size={20} />
            <div>
              <h2 className="font-semibold">{t('conn_custom_title')}</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('conn_custom_desc')}</p>
            </div>
          </div>
           <div className="grid gap-4 md:grid-cols-2">
            <div>
               <Label>{t('conn_name')}</Label>
               <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-2">
                 <BrandLogo name={customName || 'MCP server'} endpoint={customEndpoint} size={28} />
                 <span className="min-w-0 truncate text-xs text-muted-foreground">{customName || t('conn_name_placeholder')}</span>
               </div>
               <Input value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder={t('conn_name_placeholder')} className="mt-2" />
            </div>
            <div>
              <Label>{t('conn_endpoint')}</Label>
              <Input value={customEndpoint} onChange={(event) => setCustomEndpoint(event.target.value)} placeholder="https://example.com/mcp" type="url" dir="ltr" className="text-start" />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void addCustomMcp()} disabled={busy === 'custom-mcp' || !customName.trim() || !customEndpoint.trim()}>
              {busy === 'custom-mcp' ? <LoaderCircle size={16} className="animate-spin" /> : <Wrench size={16} />}
              {busy === 'custom-mcp' ? t('conn_connecting') : t('conn_connect')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowCustomForm(false)}>{t('cancel')}</Button>
          </div>
          </Card>
        </div>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">{t('conn_catalog_title')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('conn_catalog_desc')}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => void loadConnectors()} disabled={isLoading}>
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> {t('conn_refresh')}
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {isLoading ? [1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-3xl bg-surface" />) : (
            <>
              {notion && (
                <Card className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                       <BrandLogo name={notion.name} id={notion.id} provider="Notion" size={42} className="rounded-2xl border border-border bg-background p-2" />
                      <div>
                        <h3 className="font-semibold">{notion.name}</h3>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{isRtl ? t('conn_notion_desc_fa') : notion.description}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-surface-hover px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {notion.authType}
                    </span>
                  </div>
                  <div className="mt-5 flex flex-1 flex-wrap gap-2">
                    {notion.capabilities.map((capability) => <span key={capability} className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary">{capability}</span>)}
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                    <span className="text-xs text-muted-foreground">{notion.status === 'setup_required' ? t('conn_setup_required') : t('conn_oauth_ready')}</span>
                    <Button type="button" size="sm" onClick={() => void startNotionAuthorization()} disabled={busy === 'notion' || notion.status === 'setup_required'}>
                      {busy === 'notion' ? <LoaderCircle size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                      {t('conn_authorize')}
                    </Button>
                  </div>
                </Card>
              )}
              {customMcp && (
                <Card className="flex h-full flex-col">
                  <div className="flex items-start gap-3">
                     <BrandLogo name={customMcp.name} id={customMcp.id} size={42} className="rounded-2xl border border-border bg-background p-2" />
                    <div>
                      <h3 className="font-semibold">{customMcp.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{customMcp.description}</p>
                    </div>
                  </div>
                  <div className="mt-5 flex flex-1 flex-wrap gap-2">
                    {customMcp.capabilities.map((capability) => <span key={capability} className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs text-primary">{capability}</span>)}
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/70 pt-4">
                    <span className="text-xs text-muted-foreground">{t('conn_https_only')}</span>
                    <Button type="button" size="sm" onClick={() => setShowCustomForm(true)}><Plus size={15} /> {t('conn_add_server')}</Button>
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold">{t('conn_active_title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('conn_active_desc')}</p>
        </div>
        {connections.length === 0 ? (
          <Card className="py-12 text-center">
            <LinkIcon size={40} className="mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">{t('conn_empty')}</p>
          </Card>
        ) : (
          <div className="grid gap-4">
            {connections.map((connection) => (
              <Card key={connection.id}>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                     <BrandLogo name={connection.name} id={connection.connectorId} endpoint={connection.endpoint} size={42} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-2" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{connection.name}</h3>
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">{t('active')}</span>
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-muted-foreground" dir="ltr">{connection.endpoint || t('conn_oauth_connection')}</p>
                      <p className="mt-2 text-sm text-muted-foreground">{connection.tools.length} {t('conn_tools_available')}</p>
                    </div>
                  </div>
                  <Button type="button" variant="danger" size="sm" onClick={() => void revoke(connection.id)} disabled={busy === `revoke:${connection.id}`}>
                    {busy === `revoke:${connection.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    {t('conn_revoke')}
                  </Button>
                </div>
                <div className="mt-5 grid gap-5 border-t border-border/70 pt-5 lg:grid-cols-[1fr_1fr]">
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Wrench size={14} /> {t('conn_tools_title')}</h4>
                    <div className="space-y-2">
                      {connection.tools.length === 0 ? <p className="text-sm text-muted-foreground">{t('conn_no_tools')}</p> : connection.tools.map((tool) => (
                        <div key={tool.name} className="rounded-xl border border-border/70 bg-background/40 px-3 py-2">
                           <p className="flex items-center gap-2 text-sm font-medium" dir="ltr"><BrandLogo name={tool.name} endpoint={connection.endpoint} size={18} />{tool.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{tool.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><ShieldCheck size={14} /> {t('conn_permissions_title')}</h4>
                    <div className="space-y-2">
                      {(agents || []).map((agent) => (
                         <label key={agent.id} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-sm">
                           <input type="checkbox" checked={(permissions[connection.id] ?? []).includes(agent.id)} onChange={() => togglePermission(connection.id, agent.id)} className="h-5 w-5 shrink-0 rounded border-border bg-surface text-primary focus:ring-primary/50" />
                            <span className="flex min-w-0 flex-1 items-center gap-2"><BrandLogo name={agent.name} id={agent.id} size={20} /><span className="min-w-0 break-words">{agent.name}</span></span>
                           {(permissions[connection.id] ?? []).includes(agent.id) && <Check size={15} className="shrink-0 text-primary" />}
                        </label>
                      ))}
                    </div>
                     <Button type="button" size="sm" className="mt-3 min-h-11 w-full sm:w-auto" onClick={() => void updatePermissions(connection.id)} disabled={busy === `permissions:${connection.id}` || agentsLoading}>
                      {busy === `permissions:${connection.id}` ? <LoaderCircle size={15} className="animate-spin" /> : <Check size={15} />}
                      {t('conn_save_permissions')}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {payload && (
        <Card className="border-border/80 bg-surface/40">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-semibold">{t('conn_external_title')}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{t('conn_external_desc')}</p>
            </div>
            <Link href="/api-keys" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:brightness-110">
              <KeyRound size={16} /> {t('conn_manage_keys')} <ExternalLink size={14} />
            </Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[payload.protocols.agentApi, payload.protocols.mcp].map((protocol) => (
              <div key={protocol.endpoint} className="rounded-xl border border-border/70 bg-background/50 p-3">
                 <p className="break-all font-mono text-xs text-primary" dir="ltr">{protocol.endpoint}</p>
                <p className="mt-1 text-xs text-muted-foreground">{protocol.authentication}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}