import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@clerk/react';
import { useListAgents } from '@workspace/api-client-react';
import { AlertTriangle, Check, Copy, CreditCard, ExternalLink, KeyRound, Link as LinkIcon, LoaderCircle, QrCode, ShieldCheck, X } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { AgentAvatar } from '../components/AgentAvatar';
import { Button, Card, PageHeader } from '../components/ui-parts';
import { Link } from 'wouter';
import { useLocalStore } from '../lib/store';
import { googleApiError, useGoogleApiAccess } from '../lib/use-google-api-access';
import horseRoundLogo from '@/assets/persian-dark-horse-round-small.webp';

type ApiPack = { id: string; name: string; credits: number; price: number; description: string };
type ApiProduct = { agentId: string; name: string; appIds: string[]; capabilities: string[]; credits: number; active: boolean };
type ApiCatalog = {
  site?: { name: string; description: string; credits: number; packs: ApiPack[] };
  agents?: Array<Omit<ApiProduct, 'active'> & { packs: ApiPack[] }>;
  endpoint?: string;
};
type AccessCatalog = { api?: ApiCatalog };
type CustomAgentSummary = { id: string; name: string; title?: string; capabilities?: string[]; personality?: { roleFa?: string } };
type Currency = { id: string; label: string; ticker: string; network: string; address: string; logoKey: string; enabled: boolean };
type IssuedKey = { key: string; createdAt: string; lastFour: string };
type SiteKeyRecord = { id: string; name: string; lastFour: string; creditLimit: number | null; creditsUsed: number; createdAt: string; lastUsedAt: string | null };
type CheckoutSelection = { target: string; pack: ApiPack; currency: Currency; productName: string };
const customAmountToCents = (value: string) => {
  if (!/^\d{1,4}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents >= 100 && cents <= 500000 ? cents : null;
};

const logoColors: Record<string, string> = { bitcoin: '#F7931A', ethereum: '#627EEA', tether: '#26A17B', solana: '#9945FF', binance: '#F3BA2F', ton: '#0098EA', monero: '#FF6600' };

function ApiNetworkIcon({ currency }: { currency: Currency }) {
  return <span className="flex h-11 w-11 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: logoColors[currency.logoKey] || '#D4AF37' }}>{currency.ticker}</span>;
}

export default function APIKeysPage() {
  const { isRtl } = useTranslation();
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const googleAccess = useGoogleApiAccess('/api-keys');
  const { data: agents, isLoading } = useListAgents();
  const { addPaymentRecord } = useLocalStore();
  const [catalog, setCatalog] = useState<ApiCatalog | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [customAgents, setCustomAgents] = useState<CustomAgentSummary[]>([]);
  const [apiBalances, setApiBalances] = useState<Record<string, number>>({});
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [keys, setKeys] = useState<Record<string, IssuedKey>>({});
  const [busyAgent, setBusyAgent] = useState<string | null>(null);
  const [copiedAgent, setCopiedAgent] = useState<string | null>(null);
  const [apiError, setApiError] = useState<Record<string, string>>({});
  const [target, setTarget] = useState('');
  const [packId, setPackId] = useState<string | null>(null);
  const [txId, setTxId] = useState('');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [quote, setQuote] = useState<{ address?: string; warning?: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentSaved, setPaymentSaved] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedMcpEndpoint, setCopiedMcpEndpoint] = useState(false);
  const [mcpEndpointCopyError, setMcpEndpointCopyError] = useState(false);
  const [siteKeys, setSiteKeys] = useState<SiteKeyRecord[]>([]);
  const [siteBalance, setSiteBalance] = useState<number | null>(null);
  const [siteKeysLoading, setSiteKeysLoading] = useState(false);
  const [siteKeysError, setSiteKeysError] = useState('');
  const [siteActionError, setSiteActionError] = useState('');
  const [siteBusy, setSiteBusy] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLimit, setNewSiteLimit] = useState('');
  const [newSiteUnlimited, setNewSiteUnlimited] = useState(true);
  const [issuedSiteKey, setIssuedSiteKey] = useState<string | null>(null);
  const [siteCopied, setSiteCopied] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editSiteName, setEditSiteName] = useState('');
  const [editSiteLimit, setEditSiteLimit] = useState('');
  const [editSiteUnlimited, setEditSiteUnlimited] = useState(false);
  const [revokeSiteId, setRevokeSiteId] = useState<string | null>(null);
  const [customUsd, setCustomUsd] = useState('');
  const [checkout, setCheckout] = useState<CheckoutSelection | null>(null);
  const quoteRequest = useRef(0);
  const accountRef = useRef(userId);
  const keyOwner = useRef<string | null>(null);
  accountRef.current = userId;
  useEffect(() => {
    keyOwner.current = null;
    setKeys({});
    setCopiedAgent(null);
    setApiError({});
    setCatalog(null);
    setCustomAgents([]);
    setApiBalances({});
    setPaymentOpen(false);
    setTarget('');
    setPackId(null);
    setQuote(null);
    setSiteKeys([]);
    setSiteBalance(null);
    setSiteKeysError('');
    setSiteActionError('');
    setSiteBusy(false);
    setIssuedSiteKey(null);
    setEditingSiteId(null);
    setRevokeSiteId(null);
    setCheckout(null);
    setCustomUsd('');
    quoteRequest.current++;
  }, [userId]);

  const siteRequest = async (path: string, options?: RequestInit) => {
    const token = await getToken();
    const response = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: { ...(options?.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options?.headers },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { error?: string; message?: string; code?: string } | null;
      throw new Error(googleApiError(response.status, data?.code || data?.error) || data?.error || data?.message || `Request failed (${response.status}).`);
    }
    return response;
  };

  const loadSiteKeys = async () => {
    const owner = userId;
    setSiteKeysLoading(true);
    setSiteKeysError('');
    try {
      const response = await siteRequest('/api/site-api-keys');
      const data = await response.json() as { keys: SiteKeyRecord[]; balance: number };
      if (!Array.isArray(data.keys) || typeof data.balance !== 'number') throw new Error('Site API keys are temporarily unavailable.');
      if (accountRef.current === owner) {
        setSiteKeys(data.keys);
        setSiteBalance(data.balance);
      }
    } catch (error) {
      if (accountRef.current === owner) setSiteKeysError(error instanceof Error ? error.message : 'Site API keys are temporarily unavailable.');
    } finally {
      if (accountRef.current === owner) setSiteKeysLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn && userId) void loadSiteKeys();
  }, [isLoaded, isSignedIn, userId]);

  const parseLimit = (value: string, maximum: number): number | null => {
    if (!/^\d+$/.test(value.trim()) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
      throw new Error(`Enter a whole-number limit from 0 to ${maximum.toLocaleString()} Credits.`);
    }
    return Number(value);
  };

  const createSiteKey = async () => {
    const owner = userId;
    setSiteActionError('');
    try {
      const name = newSiteName.trim();
      if (!name) throw new Error(isRtl ? 'نام کلید را وارد کنید.' : 'Give this key a name.');
      const creditLimit = newSiteUnlimited ? null : parseLimit(newSiteLimit, Math.max(0, siteBalance ?? 0));
      setSiteBusy(true);
      if (!await googleAccess.refresh()) throw new Error('Connect and verify a Google account before creating API keys.');
      if (accountRef.current !== owner) return;
      const response = await siteRequest('/api/site-api-keys', { method: 'POST', body: JSON.stringify({ name, creditLimit }) });
      const data = await response.json() as { key: string; record: SiteKeyRecord };
      if (!data.key || !data.record) throw new Error('The new key could not be displayed. Please reload your keys.');
      if (accountRef.current !== owner) return;
      setSiteKeys((current) => [data.record, ...current]);
      setIssuedSiteKey(data.key);
      setSiteCopied(false);
      setNewSiteName('');
      setNewSiteLimit('');
      setNewSiteUnlimited(true);
    } catch (error) {
      if (accountRef.current === owner) setSiteActionError(error instanceof Error ? error.message : 'Could not create key.');
    } finally {
      if (accountRef.current === owner) setSiteBusy(false);
    }
  };

  const saveSiteKey = async (record: SiteKeyRecord) => {
    const owner = userId;
    setSiteActionError('');
    try {
      const name = editSiteName.trim();
      if (!name) throw new Error(isRtl ? 'نام کلید را وارد کنید.' : 'Give this key a name.');
      const creditLimit = editSiteUnlimited ? null : parseLimit(editSiteLimit, Math.max(0, (siteBalance ?? 0) + record.creditsUsed));
      setSiteBusy(true);
      const response = await siteRequest(`/api/site-api-keys/${encodeURIComponent(record.id)}`, { method: 'PATCH', body: JSON.stringify({ name, creditLimit }) });
      const data = await response.json() as { record: SiteKeyRecord };
      if (!data.record) throw new Error('Could not update this key.');
      if (accountRef.current !== owner) return;
      setSiteKeys((current) => current.map((item) => item.id === record.id ? data.record : item));
      setEditingSiteId(null);
    } catch (error) {
      if (accountRef.current === owner) setSiteActionError(error instanceof Error ? error.message : 'Could not update this key.');
    } finally {
      if (accountRef.current === owner) setSiteBusy(false);
    }
  };

  const revokeSiteKey = async (id: string) => {
    const owner = userId;
    setSiteActionError('');
    setSiteBusy(true);
    try {
      await siteRequest(`/api/site-api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (accountRef.current !== owner) return;
      setSiteKeys((current) => current.filter((item) => item.id !== id));
      setRevokeSiteId(null);
      if (editingSiteId === id) setEditingSiteId(null);
    } catch (error) {
      if (accountRef.current === owner) setSiteActionError(error instanceof Error ? error.message : 'Could not revoke this key.');
    } finally {
      if (accountRef.current === owner) setSiteBusy(false);
    }
  };

  const loadCatalog = () => {
    const owner = userId ?? null;
    setCatalogError(false);
    fetch('/api/access/catalog', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<AccessCatalog> : Promise.reject(new Error('catalog unavailable')))
      .then((data) => {
        if (!Array.isArray(data.api?.agents)) throw new Error('invalid API catalog');
        if (accountRef.current === owner) setCatalog(data.api);
      })
      .catch(() => {
        if (accountRef.current === owner) {
          setCatalog(null);
          setCatalogError(true);
        }
      });
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    let active = true;
    loadCatalog();
    fetch('/api/currencies', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<Currency[]> : Promise.reject(new Error('currency unavailable')))
      .then((data) => { if (active) setCurrencies(data.filter((item) => item.enabled)); })
      .catch(() => undefined);
    fetch('/api/custom-agents', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<{ agents?: CustomAgentSummary[] }> : Promise.reject(new Error('custom agents unavailable')))
      .then((data) => { if (active) setCustomAgents(data.agents ?? []); })
      .catch(() => undefined);
    fetch('/api/payments/status', { credentials: 'include' })
      .then((response) => response.ok ? response.json() as Promise<{ apiCreditsByAgent?: Record<string, number> }> : Promise.reject(new Error('API balances unavailable')))
      .then((data) => { if (active) setApiBalances(data.apiCreditsByAgent ?? {}); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [isLoaded, isSignedIn, userId]);

  const agentProducts = useMemo(() => (catalog?.agents ?? []).map((product) => ({
    ...product,
    active: product.credits > 0,
  })), [catalog]);
  const customProducts = useMemo(() => customAgents
    .filter((agent) => agent.id.startsWith('custom_'))
    .map((agent) => ({
      agentId: agent.id,
      name: agent.name,
      appIds: agent.capabilities?.map((capability) => capability.toLowerCase().replace(/\s+/g, '-')) || [],
      capabilities: agent.capabilities || ['AI Chat'],
      credits: apiBalances[agent.id] ?? 0,
      active: (apiBalances[agent.id] ?? 0) > 0,
      packs: catalog?.agents?.[0]?.packs ?? [],
    })), [customAgents, apiBalances, catalog?.agents]);
  const siteProduct = useMemo(() => catalog?.site ? ({
    agentId: 'site',
    name: 'Persian dark horse api',
    appIds: [],
    capabilities: ['Includes all Ai chat bots and models'],
    credits: catalog.site.credits,
    active: catalog.site.credits > 0,
    packs: catalog.site.packs,
  }) : null, [catalog?.site]);
  const allProducts = useMemo(() => [...(siteProduct ? [siteProduct] : []), ...agentProducts, ...customProducts], [siteProduct, agentProducts, customProducts]);
  const selectedProduct = allProducts.find((item) => item.agentId === target);
  const customCents = customAmountToCents(customUsd);
  const customPack: ApiPack | null = customCents === null ? null : {
    id: `api-site-custom-usd-${customCents}-v1`,
    name: isRtl ? 'مبلغ دلخواه' : 'Custom amount',
    credits: Math.floor(customCents * 500 / 1300),
    price: customCents / 100,
    description: '',
  };
  const selectedPack = selectedProduct?.packs.find((item) => item.id === packId) || (target === 'site' && customPack?.id === packId ? customPack : undefined);
  const paymentAddress = quote?.address || checkout?.currency.address || '';
  const qrUrl = paymentAddress ? `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(paymentAddress)}` : '';

  const choosePack = (nextTarget: string, nextPack: ApiPack) => {
    if (paymentOpen) return;
    setTarget(nextTarget);
    setPackId(nextPack.id);
    setQuote(null);
    setPaymentSaved(false);
    setPaymentError('');
    setTxId('');
  };

  const chooseCurrency = async (nextCurrency: Currency) => {
    if (!selectedPack || !target || !selectedProduct || paymentOpen) return;
    const selection: CheckoutSelection = { target, pack: selectedPack, currency: nextCurrency, productName: selectedProduct.name };
    const requestId = ++quoteRequest.current;
    setCheckout(selection);
    setPaymentOpen(true);
    setQuote(null);
    setQuoteLoading(true);
    setPaymentError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in before purchasing API Credits.');
      const response = await fetch('/api/payments/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ apiScope: selection.target === 'site' ? 'site' : 'agent', ...(selection.target === 'site' ? {} : { agentId: selection.target }), apiCreditPackId: selection.pack.id, currency: selection.currency.id }),
      });
      const data = await response.json() as { address?: string; warning?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'API payment quote unavailable.');
      if (requestId === quoteRequest.current) setQuote(data);
    } catch (error) {
      if (requestId === quoteRequest.current) setPaymentError(error instanceof Error ? error.message : 'API payment quote unavailable.');
    } finally {
      if (requestId === quoteRequest.current) setQuoteLoading(false);
    }
  };

  const submitPayment = async () => {
    if (!checkout || !txId.trim() || quoteLoading || paymentError || !quote) return;
    const selection = checkout;
    setPaymentSubmitting(true);
    setPaymentError('');
    try {
      const token = await getToken();
      if (!token) throw new Error('Sign in before submitting a payment.');
      const response = await fetch('/api/payments/txid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ apiScope: selection.target === 'site' ? 'site' : 'agent', ...(selection.target === 'site' ? {} : { agentId: selection.target }), apiCreditPackId: selection.pack.id, currency: selection.currency.id, txId: txId.trim() }),
      });
      const data = await response.json() as { payment?: { id?: string; status?: 'pending' | 'approved' | 'rejected' }; error?: string };
      if (!response.ok) throw new Error(data.error || 'Payment submission failed.');
      addPaymentRecord({ id: data.payment?.id || crypto.randomUUID(), planId: `api:${selection.target}:${selection.pack.id}`, currencyId: selection.currency.id, txId: txId.trim(), createdAt: new Date().toISOString(), status: data.payment?.status || 'pending' });
      setPaymentSaved(true);
      setTxId('');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Payment submission failed.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  useEffect(() => {
    if (!target && allProducts.length > 0) setTarget(allProducts[0].agentId);
  }, [allProducts, target]);

  const createKey = async (agentId: string) => {
    setBusyAgent(agentId);
    setApiError((current) => ({ ...current, [agentId]: '' }));
    const owner = userId ?? null;
    try {
      if (!await googleAccess.refresh()) throw new Error('Connect and verify a Google account in your profile before creating API keys. If you just linked Google, try again.');
      if (accountRef.current !== owner) return;
      const response = await fetch('/api/agent-keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ agentId }) });
      const data = await response.json() as IssuedKey & { error?: string; code?: string };
      if (accountRef.current !== owner) return;
      if (!response.ok || !data.key) throw new Error(googleApiError(response.status, data.code || data.error) || data.error || 'API key creation failed.');
      keyOwner.current = owner;
      setKeys((current) => ({ ...current, [agentId]: data }));
      loadCatalog();
    } catch (error) {
      if (accountRef.current === owner) setApiError((current) => ({ ...current, [agentId]: error instanceof Error ? error.message : 'API key creation failed.' }));
    } finally {
      if (accountRef.current === owner) setBusyAgent(null);
    }
  };

  const copyKey = async (agentId: string) => {
    const value = keyOwner.current === userId ? keys[agentId]?.key : null;
    if (!value) return;
    await navigator.clipboard?.writeText(value);
    setCopiedAgent(agentId);
    window.setTimeout(() => setCopiedAgent((current) => current === agentId ? null : current), 1800);
  };

  const copyMcpEndpoint = async () => {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText('https://persiandarkhorse.com/api/mcp');
      setMcpEndpointCopyError(false);
      setCopiedMcpEndpoint(true);
      window.setTimeout(() => setCopiedMcpEndpoint(false), 1800);
    } catch {
      setCopiedMcpEndpoint(false);
      setMcpEndpointCopyError(true);
    }
  };

  if (!isLoaded) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="animate-spin text-primary" /></div>;
  }

  if (!isSignedIn) {
    return (
      <div className="fade-up mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center">
        <Card className="w-full border-primary/25 bg-primary/5 p-6 text-center md:p-8">
          <img src={horseRoundLogo} alt="Persian Dark Horse" className="mx-auto h-16 w-16 rounded-full border border-primary/30 object-cover" />
          <h1 className="mt-4 text-2xl font-bold">Persian dark horse api</h1>
          <p className="mt-2 font-medium text-primary">Includes all Ai chat bots and models</p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            {isRtl
              ? 'اعتبار API جدا از اشتراک است. با ساخت حساب می‌توانید بسته‌های اعتبار را بررسی کنید، به ایجنت‌ها دسترسی بدهید و کلید اختصاصی بسازید.'
              : 'API Credits are separate from subscriptions. Create an account to browse credit packs, connect Agents, and issue your own keys.'}
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            {isRtl ? 'برای اتصال از برنامه‌های دیگر، نشانی MCP عمومی FEZI را در کلاینت خود وارد کنید. اجرای ابزارها به کلید Site API و اعتبار API نیاز دارد.' : 'Connect from other apps using the FEZI MCP endpoint. Tools require your Site API key and API Credits.'}
            <code className="mt-2 block break-all text-primary" dir="ltr">https://persiandarkhorse.com/api/mcp</code>
          </p>
          <Link href="/sign-up?redirect_url=/api-keys" className="mt-6 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            {isRtl ? 'ساخت حساب رایگان' : 'Create a free account'}
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="fade-up mx-auto max-w-6xl space-y-8">
      <PageHeader title="Persian Dark Horse API" description="Buy API Credit Packs separately from your monthly subscription, then create keys for the Agents you want to integrate." />
      {catalogError && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-red-500/30 text-sm text-red-400">
          <span>The API catalog could not be loaded. Please try again.</span>
          <Button type="button" variant="secondary" onClick={loadCatalog}>Retry</Button>
        </Card>
      )}
      <Card className="flex items-start gap-3 border-primary/25 bg-primary/5"><ShieldCheck className="mt-0.5 shrink-0 text-primary" size={20} /><p className="text-sm leading-6 text-muted-foreground">{isRtl ? 'اعتبار API جدا از اعتبار اشتراک است. بسته‌ها یک‌بار خریداری می‌شوند و تمدید ماهانه ندارند. اعتبار بر اساس استفاده مصرف می‌شود. دسترسی پس از تأیید تراکنش فعال می‌شود؛ کلید فقط یک‌بار نمایش داده می‌شود.' : 'API Credits are separate from workspace Credits. Packs are one-time purchases with no monthly renewal. Credits are spent as you use the API. Access activates after the crypto transaction is verified, and keys are shown only once.'}</p></Card>
      <Card className="flex flex-col gap-4 border-amber-500/30 bg-amber-500/5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-amber-500" size={20} /><div><h2 className="font-semibold">Google verification required for every API key</h2><p className="mt-1 text-sm text-muted-foreground" data-testid="status-google-api-access">{googleAccess.loading ? 'Checking your connected Google account…' : googleAccess.error || (googleAccess.verified ? 'Google account verified. You can create API keys after buying Credits.' : 'Connect a verified Google account to this account before issuing any API key. A Gmail address alone does not qualify.')}</p></div></div>
        {!googleAccess.verified && <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" className="min-h-11 shrink-0" data-testid="button-link-google-account" onClick={googleAccess.openGoogleLink} disabled={!isLoaded}>Connect Google in profile</Button><Button type="button" variant="secondary" className="min-h-11" data-testid="button-refresh-google-status" onClick={() => void googleAccess.refresh()}>Recheck status</Button></div>}
      </Card>

      {siteProduct && <section aria-labelledby="site-api-heading">
        <Card className="min-w-0 overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-background to-amber-500/5 p-5 sm:p-7" data-testid="card-site-api">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <img src={horseRoundLogo} alt="Persian Dark Horse" className="h-16 w-16 shrink-0 rounded-2xl border border-primary/30 object-cover" />
            <div className="min-w-0 flex-1"><span className="text-xs font-bold uppercase tracking-widest text-primary">Global API · all AI chat bots</span><h2 id="site-api-heading" className="mt-1 text-2xl font-bold sm:text-3xl">Persian dark horse api</h2><p className="mt-2 text-sm text-muted-foreground">Includes all Ai chat bots and models</p><p className="mt-3 inline-flex rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary" dir="ltr" data-testid="text-site-api-balance">{siteProduct.credits.toLocaleString()} site API Credits</p></div>
          </div>
           <div className="mt-6 grid gap-2 sm:grid-cols-3">{siteProduct.packs.map((pack) => <button type="button" key={pack.id} disabled={paymentOpen} data-testid={`button-site-pack-${pack.id}`} onClick={() => choosePack('site', pack)} className={`min-h-20 min-w-0 rounded-xl border p-3 text-start transition-colors ${target === 'site' && packId === pack.id ? 'border-primary bg-primary/10' : 'border-border bg-background/50 hover:border-primary/50'}`}><p className="text-xs font-semibold">{pack.name}</p><p className="mt-1 text-sm font-bold text-primary" dir="ltr">{pack.credits.toLocaleString()} Credits</p><p className="mt-1 text-xs text-muted-foreground" dir="ltr">${pack.price.toFixed(2)}</p></button>)}</div>
           <div className={`mt-3 rounded-xl border p-4 ${target === 'site' && packId?.startsWith('api-site-custom-usd-') ? 'border-primary bg-primary/10' : 'border-border bg-background/50'}`}>
             <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
               <label className="min-w-0 flex-1 text-xs font-semibold">{isRtl ? 'یا مبلغ دلخواه اعتبار Site API (دلار)' : 'Or choose a custom Site API Credit amount (USD)'}
                 <span className="mt-2 flex min-h-11 items-center rounded-xl border border-border bg-background px-3 text-sm"><span dir="ltr">$</span><input type="text" inputMode="decimal" dir="ltr" value={customUsd} disabled={paymentOpen} onChange={(event) => { const value = event.target.value; if (/^\d{0,4}(?:\.\d{0,2})?$/.test(value)) { setCustomUsd(value); if (target === 'site' && packId?.startsWith('api-site-custom-usd-')) setPackId(null); } }} placeholder="1.00 – 5000.00" data-testid="input-site-custom-usd" className="w-full min-w-0 bg-transparent px-2 outline-none" /></span>
               </label>
               <Button type="button" variant="secondary" className="min-h-11 w-full sm:w-auto" disabled={!customPack || paymentOpen} onClick={() => { if (customPack) choosePack('site', customPack); }} data-testid="button-select-site-custom">{isRtl ? 'انتخاب مبلغ دلخواه' : 'Select custom amount'}</Button>
             </div>
             <p className="mt-2 text-xs text-muted-foreground" data-testid="text-site-custom-preview">{customUsd ? customPack ? `${customPack.credits.toLocaleString()} Credits · $${customPack.price.toFixed(2)} USD` : (isRtl ? 'مبلغ باید بین $1.00 و $5000.00 باشد.' : 'Enter $1.00–$5000.00, up to two decimal places.') : (isRtl ? '۵۰۰ اعتبار برای هر ۱۳ دلار؛ اعتبار نهایی به پایین گرد می‌شود.' : '500 Credits per $13; Credits are rounded down to a whole number.')}</p>
           </div>
           <p className="mt-3 text-xs text-muted-foreground">{isRtl ? 'یک بسته آماده یا مبلغ دلخواه را انتخاب کنید، سپس شبکه پرداخت را در پایین برگزینید.' : 'Choose a saved pack or the custom amount, then select a payment network below.'}</p>
          <div className="mt-5 border-t border-border/70 pt-5">
             <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{isRtl ? 'کلیدهای Site API' : 'Site API keys'}</h3><p className="mt-1 text-xs text-muted-foreground">{isRtl ? 'هر تعداد کلید نام‌دار بسازید. سقف هر کلید برای کل عمر آن است؛ اعتبار کیف پول همیشه لازم است.' : 'Create as many named keys as you need. A cap is lifetime usage, not a refill; unlimited keys still spend from your wallet.'}</p></div><span dir="ltr" className="text-xs font-semibold text-primary" data-testid="text-site-wallet-balance">{siteBalance === null ? '…' : siteBalance.toLocaleString()} wallet Credits</span></div>
             {siteKeysLoading && siteBalance === null ? <div className="mt-4 space-y-2" role="status"><div className="h-12 animate-pulse rounded-xl bg-primary/10" /><div className="h-12 animate-pulse rounded-xl bg-primary/10" /></div> : null}
             {siteKeysError && <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-red-400" role="alert"><span>{siteKeysError}</span><Button type="button" variant="secondary" className="min-h-11" onClick={() => void loadSiteKeys()} data-testid="button-retry-site-keys">{isRtl ? 'تلاش دوباره' : 'Retry'}</Button></div>}
             {!siteKeysLoading && !siteKeysError && siteKeys.length === 0 && <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{isRtl ? 'هنوز کلیدی ندارید. اولین کلید نام‌دار خود را در پایین بسازید.' : 'No Site API keys yet. Give your first key a name below.'}</p>}
             <div className="mt-4 space-y-3">{siteKeys.map((record) => <div key={record.id} className="min-w-0 rounded-xl border border-border bg-background/60 p-4" data-testid={`card-site-key-${record.id}`}>
               <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="break-words font-semibold" data-testid={`text-site-key-name-${record.id}`}>{record.name} <span className="ms-1 font-mono text-xs font-normal text-muted-foreground" dir="ltr">•••• {record.lastFour}</span></p><p className="mt-1 text-xs text-muted-foreground" dir="ltr" data-testid={`text-site-key-usage-${record.id}`}>{record.creditsUsed.toLocaleString()} / {record.creditLimit === null ? 'Unlimited' : record.creditLimit.toLocaleString()} Credits used {record.creditLimit === 0 ? '· Paused' : ''}</p><p className="mt-1 text-[11px] text-muted-foreground">{isRtl ? 'ساخته‌شده' : 'Created'} {new Date(record.createdAt).toLocaleString()} · {isRtl ? 'آخرین استفاده' : 'Last used'} {record.lastUsedAt ? new Date(record.lastUsedAt).toLocaleString() : (isRtl ? 'هرگز' : 'Never')}</p></div><div className="flex shrink-0 gap-2"><Button type="button" variant="secondary" className="min-h-11" disabled={siteBusy} onClick={() => { setEditingSiteId(record.id); setEditSiteName(record.name); setEditSiteUnlimited(record.creditLimit === null); setEditSiteLimit(record.creditLimit === null ? '' : String(record.creditLimit)); setRevokeSiteId(null); setSiteActionError(''); }} data-testid={`button-edit-site-key-${record.id}`}>{isRtl ? 'ویرایش' : 'Edit'}</Button><Button type="button" variant="secondary" className="min-h-11 text-red-400" disabled={siteBusy} onClick={() => { setRevokeSiteId(record.id); setEditingSiteId(null); setSiteActionError(''); }} data-testid={`button-revoke-site-key-${record.id}`}>{isRtl ? 'لغو' : 'Revoke'}</Button></div></div>
               {editingSiteId === record.id && <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><label className="text-xs font-semibold">{isRtl ? 'نام' : 'Name'}<input value={editSiteName} maxLength={100} onChange={(event) => setEditSiteName(event.target.value)} data-testid="input-edit-site-name" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /></label><label className="text-xs font-semibold">{isRtl ? 'سقف کل اعتبار' : 'Lifetime Credit cap'}<input type="number" min="0" max={Math.max(0, (siteBalance ?? 0) + record.creditsUsed)} step="1" disabled={editSiteUnlimited} value={editSiteLimit} onChange={(event) => setEditSiteLimit(event.target.value)} data-testid="input-edit-site-limit" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-50" /></label><label className="flex items-center gap-2 text-xs sm:col-span-2"><input type="checkbox" checked={editSiteUnlimited} onChange={(event) => setEditSiteUnlimited(event.target.checked)} data-testid="checkbox-edit-site-unlimited" />{isRtl ? 'بدون سقف (وابسته به اعتبار کیف پول)' : 'Unlimited (wallet-backed)'}</label><p className="text-xs text-muted-foreground sm:col-span-2">{isRtl ? 'صفر، کلید را متوقف می‌کند.' : `0 pauses this key. Maximum cap: ${Math.max(0, (siteBalance ?? 0) + record.creditsUsed).toLocaleString()} Credits (wallet balance + already used).`}</p><div className="flex gap-2 sm:col-span-2"><Button type="button" disabled={siteBusy} onClick={() => void saveSiteKey(record)} data-testid="button-save-site-key">{isRtl ? 'ذخیره' : 'Save changes'}</Button><Button type="button" variant="secondary" onClick={() => setEditingSiteId(null)} data-testid="button-cancel-edit-site-key">{isRtl ? 'انصراف' : 'Cancel'}</Button></div></div>}
               {revokeSiteId === record.id && <div className="mt-4 border-t border-red-500/20 pt-4"><p className="text-sm text-red-400">{isRtl ? 'این کلید برای همیشه لغو شود؟ این کار قابل بازگشت نیست.' : `Revoke “${record.name}” permanently? This cannot be undone.`}</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" disabled={siteBusy} onClick={() => void revokeSiteKey(record.id)} data-testid="button-confirm-revoke-site-key">{isRtl ? 'بله، لغو کلید' : 'Yes, revoke key'}</Button><Button type="button" variant="secondary" onClick={() => setRevokeSiteId(null)} data-testid="button-cancel-revoke-site-key">{isRtl ? 'انصراف' : 'Cancel'}</Button></div></div>}
             </div>)}</div>
             <div className="mt-5 border-t border-border pt-5"><h3 className="font-semibold">{isRtl ? 'ساخت کلید جدید' : 'Create a new key'}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold">{isRtl ? 'نام کلید' : 'Key name'}<input value={newSiteName} maxLength={100} onChange={(event) => setNewSiteName(event.target.value)} placeholder={isRtl ? 'مثلاً سرور تولید' : 'e.g. Production server'} data-testid="input-new-site-name" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" /></label><label className="text-xs font-semibold">{isRtl ? 'سقف کل اعتبار' : 'Lifetime Credit cap'}<input type="number" min="0" max={siteBalance ?? 0} step="1" disabled={newSiteUnlimited} value={newSiteLimit} onChange={(event) => setNewSiteLimit(event.target.value)} data-testid="input-new-site-limit" className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary disabled:opacity-50" /></label></div><label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={newSiteUnlimited} onChange={(event) => setNewSiteUnlimited(event.target.checked)} data-testid="checkbox-new-site-unlimited" />{isRtl ? 'بدون سقف (وابسته به اعتبار کیف پول)' : 'Unlimited (wallet-backed)'}</label><p className="mt-2 text-xs text-muted-foreground">{isRtl ? 'صفر کلید را متوقف می‌کند. سقف ساخت نمی‌تواند از موجودی کیف پول بیشتر باشد.' : `0 pauses calls. Maximum new cap: ${(siteBalance ?? 0).toLocaleString()} Credits (current wallet balance).`}</p><Button type="button" className="mt-4 min-h-11 w-full sm:w-auto" data-testid="button-issue-site-api-key" onClick={() => void createSiteKey()} disabled={siteBusy || siteKeysLoading || !!siteKeysError || siteBalance === null || !siteProduct.active || !googleAccess.verified || googleAccess.loading}>{siteBusy ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}{!siteProduct.active ? (isRtl ? 'ابتدا اعتبار بخرید' : 'Buy site API Credits first') : !googleAccess.verified ? (isRtl ? 'ابتدا گوگل را تأیید کنید' : 'Verify Google to generate key') : (isRtl ? 'ساخت کلید Site API' : 'Create Site API key')}</Button></div>
             {issuedSiteKey && <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><p className="text-sm font-semibold text-primary">{isRtl ? 'این کلید فقط همین یک‌بار نمایش داده می‌شود. اکنون آن را کپی کنید.' : 'This key is shown only once. Copy it now and store it safely.'}</p><div className="mt-2 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-xs" dir="ltr" data-testid="text-site-api-key">{issuedSiteKey}</code><Button type="button" variant="secondary" className="min-h-11" data-testid="button-copy-site-api-key" onClick={async () => { try { await navigator.clipboard.writeText(issuedSiteKey); setSiteCopied(true); window.setTimeout(() => setSiteCopied(false), 1800); } catch { setSiteActionError(isRtl ? 'کپی ممکن نیست؛ کلید را دستی کپی کنید.' : 'Clipboard unavailable. Copy the key manually.'); } }}>{siteCopied ? <Check size={16} /> : <Copy size={16} />}{siteCopied ? (isRtl ? 'کپی شد' : 'Copied') : (isRtl ? 'کپی کلید' : 'Copy key')}</Button></div><Button type="button" variant="secondary" className="mt-3 min-h-11" onClick={() => setIssuedSiteKey(null)} data-testid="button-dismiss-site-key">{isRtl ? 'کلید را ذخیره کردم' : "I've saved this key"}</Button></div>}
             {siteActionError && <p className="mt-3 text-xs text-red-400" role="alert" data-testid="error-site-api-key">{siteActionError}</p>}
          </div>
        </Card>
        <Card className="mt-4 min-w-0 space-y-3 border-border/80">
          <h3 className="font-semibold">Global API quick start</h3><p className="text-sm text-muted-foreground">Send your site key as a Bearer token. Never put it in browser-side code or share it publicly.</p>
          <div className="space-y-2 text-sm"><p><code className="break-all text-primary">POST /api/site/v1/chat</code> — JSON body: <code className="break-all">{'{ "message": "Hello", "model": "optional", "agentId": "optional" }'}</code></p><p><code className="break-all text-primary">GET /api/site/v1/models</code> — view supported models</p><p>Header: <code className="break-all">Authorization: Bearer YOUR_API_KEY</code></p></div>
        </Card>
      </section>}

      <Card className="min-w-0 space-y-4 border-primary/25 bg-primary/5" data-testid="card-mcp-connection">
        <div className="flex items-start gap-3">
          <LinkIcon className="mt-0.5 shrink-0 text-primary" size={19} />
          <div className="min-w-0">
            <h2 className="font-semibold">{isRtl ? 'اتصال MCP برای کاربران خارجی' : 'Connect to FEZI with MCP'}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{isRtl
              ? 'از این نشانی Streamable HTTP در کلاینت MCP خود استفاده کنید. کلاینت ابتدا می‌تواند initialize را بدون احراز هویت انجام دهد؛ اجرای ابزارها به کلید معتبر نیاز دارد.'
              : 'Use this Streamable HTTP endpoint in your MCP client. The initial initialize request is public; tool calls require authentication.'}</p>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border/80 bg-background/70 p-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 break-all text-sm text-primary" dir="ltr" data-testid="text-mcp-endpoint">https://persiandarkhorse.com/api/mcp</code>
          <Button type="button" variant="secondary" className="min-h-11 w-full shrink-0 sm:w-auto" data-testid="button-copy-mcp-endpoint" onClick={() => void copyMcpEndpoint()}>
            {copiedMcpEndpoint ? <Check size={16} /> : <Copy size={16} />}
            {copiedMcpEndpoint
              ? (isRtl ? 'کپی شد' : 'Copied')
              : (isRtl ? 'کپی نشانی' : 'Copy endpoint')}
          </Button>
        </div>
        {mcpEndpointCopyError && <p className="text-xs text-red-400" role="status">{isRtl ? 'دسترسی به کلیپ‌بورد ممکن نیست؛ نشانی را دستی کپی کنید.' : 'Clipboard access is unavailable. Copy the endpoint manually.'}</p>}
        <ul className="space-y-2 text-sm leading-6 text-muted-foreground">
          <li>{isRtl
            ? <>در بخش «Global API» همین صفحه، کلید <strong className="text-foreground">Site API</strong> را بسازید؛ کلید Agent یا Custom Agent برای MCP معتبر نیست.</>
            : <>Create a <strong className="text-foreground">Site API key</strong> in the Global API section above. Agent and Custom Agent keys do not work for MCP.</>}</li>
          <li>{isRtl
            ? <>کلید را فقط در بخش امن نگهداری اسرار کلاینت MCP ذخیره کنید و در درخواست‌ها هدر <code dir="ltr" className="break-all text-primary">Authorization: Bearer &lt;SITE_API_KEY&gt;</code> بفرستید؛ هرگز کلید را در نشانی URL قرار ندهید.</>
            : <>Store the key in your MCP client’s secret storage and send <code dir="ltr" className="break-all text-primary">Authorization: Bearer &lt;SITE_API_KEY&gt;</code> as a request header. Never put the key in the URL.</>}</li>
          <li>{isRtl
            ? 'اعتبار Site API فقط پس از موفقیت پاسخ چت از ابزار MCP کسر می‌شود.'
            : 'Site API Credits are charged only when an MCP chat succeeds.'}</li>
        </ul>
        <p className="border-t border-border/70 pt-3 text-xs leading-5 text-muted-foreground">{isRtl
          ? 'این راهنمای MCP کلید شما را دریافت یا ذخیره نمی‌کند. کلید API جدید فقط در کنترل ساخت کلیدِ بخش بالا و فقط یک‌بار نمایش داده می‌شود.'
          : 'This MCP guide does not collect or store your key. The existing key-issuance control above shows a new API key only once.'}</p>
      </Card>

       {selectedPack && <Card className="border-primary/25" data-testid="card-api-checkout"><h2 className="text-lg font-semibold">Top up {selectedProduct?.name}</h2><p className="mt-1 text-sm text-muted-foreground">{selectedPack.name} · {selectedPack.credits.toLocaleString()} Credits · ${selectedPack.price.toFixed(2)} USD order total. Choose your crypto network to open checkout.</p><div className="mt-4 flex flex-wrap gap-2">{currencies.map((currency) => <Button key={currency.id} type="button" variant="secondary" disabled={paymentOpen} className="min-h-11" data-testid={`button-pay-api-${currency.id}`} onClick={() => void chooseCurrency(currency)}><ApiNetworkIcon currency={currency} /> {currency.label} · {currency.network}</Button>)}</div>{currencies.length === 0 && <p className="mt-3 text-sm text-amber-500">Payment networks are unavailable right now. Please try again later.</p>}</Card>}

      <section>
         <div className="mb-4"><h2 className="text-xl font-bold">Agent APIs & Credit Packs</h2><p className="mt-1 text-sm text-muted-foreground">Choose which Agent you want to expose, then buy Credits for that Agent only. Every Agent has its own balance, key, and usage ledger.</p></div>
        <div className="grid gap-5 md:grid-cols-2">
           {allProducts.filter((product) => product.agentId !== 'site').map((product) => {
            const agent = agents?.find((item) => item.id === product.agentId);
            const issued = keyOwner.current === userId ? keys[product.agentId] : null;
             return <Card key={product.agentId} className="flex h-full min-w-0 flex-col">
               <div className="flex min-w-0 items-start gap-4">
                 <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-border bg-background"><AgentAvatar agentId={product.agentId} name={product.name} className="h-full w-full" /></div>
                 <div className="min-w-0"><h3 className="break-words text-lg font-bold">{agent?.name || product.name}</h3><p className="mt-1 text-xs text-primary">{isRtl && agent?.personality?.roleFa ? agent.personality.roleFa : agent?.title || 'Agent API'}</p><p className="mt-2 break-words text-sm leading-6 text-muted-foreground">{product.capabilities.join(' · ')}</p></div>
               </div>
               <div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] text-primary" dir="ltr">{product.credits.toLocaleString()} API Credits</span>{product.appIds.map((id) => <span key={id} className="max-w-full break-all rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground">{id}</span>)}</div>
               <div className="mt-4 grid gap-2 sm:grid-cols-3">{product.packs.map((pack) => <button type="button" key={pack.id} onClick={() => choosePack(product.agentId, pack)} className={`min-h-11 min-w-0 rounded-xl border p-3 text-start transition-colors ${target === product.agentId && packId === pack.id ? 'border-primary bg-primary/10' : 'border-border bg-background/50 hover:border-primary/50'}`}><p className="text-xs font-semibold">{pack.name}</p><p className="mt-1 text-sm font-bold text-primary" dir="ltr">{pack.credits.toLocaleString()}</p><p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">${pack.price}</p></button>)}</div>
               <div className="mt-auto border-t border-border/70 pt-4">
                 {issued ? <div className="space-y-2"><p className="text-xs font-semibold text-primary">Copy your key now — it will not be shown again</p><div className="flex min-w-0 flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-xs" dir="ltr">{issued.key}</code><button type="button" aria-label="Copy Agent API key" onClick={() => void copyKey(product.agentId)} className="flex min-h-11 w-full items-center justify-center rounded-lg text-primary hover:bg-primary/10 sm:w-11 sm:shrink-0">{copiedAgent === product.agentId ? <Check size={16} /> : <Copy size={16} />}</button></div><p className="text-[11px] text-muted-foreground" dir="ltr">…{issued.lastFour} · {new Date(issued.createdAt).toLocaleString()}</p></div> : <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => void createKey(product.agentId)} disabled={busyAgent === product.agentId || !product.active || !googleAccess.verified || googleAccess.loading}>{busyAgent === product.agentId ? <LoaderCircle size={16} className="animate-spin" /> : <KeyRound size={16} />}{!product.active ? 'Buy Credits before generating a key' : !googleAccess.verified ? 'Verify Google to generate key' : 'Generate Agent API key'}</Button>}
                 {apiError[product.agentId] && <p className="mt-2 text-xs text-red-400">{apiError[product.agentId]}</p>}
               </div>
             </Card>;
          })}
        </div>
      </section>

      <Card className="border-border/80 bg-surface/60"><div className="flex items-start gap-3"><KeyRound className="mt-0.5 text-primary" size={18} /><div><h2 className="font-semibold">Custom Agent API</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Save and publish your Custom Agent first. Then enable its API from the Builder and use the same API Credit flow; the key is created from the Agent settings.</p><Link href="/my-agents" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">Open My Agents <LinkIcon size={14} /></Link></div></div></Card>

       {paymentOpen && checkout && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label="API crypto payment">
        <div className="relative max-h-[92dvh] w-full min-w-0 max-w-2xl overflow-y-auto rounded-3xl border border-primary/30 bg-background p-4 shadow-2xl sm:p-5 md:p-7">
          <button type="button" disabled={paymentSubmitting} onClick={() => { quoteRequest.current++; setPaymentOpen(false); setCheckout(null); setQuote(null); setTxId(''); }} aria-label="Close" className="absolute end-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground"><X size={19} /></button>
          <div className="flex min-w-0 items-center gap-3 pe-12"><ApiNetworkIcon currency={checkout.currency} /><div className="min-w-0"><h2 className="break-words text-xl font-bold">API payment · {checkout.productName}</h2><p className="mt-1 text-xs text-muted-foreground">{checkout.pack.name} · {checkout.pack.credits.toLocaleString()} Credits</p></div></div>
          <div className="mt-6 grid min-w-0 gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-3">{quoteLoading ? <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-border bg-surface"><LoaderCircle className="animate-spin text-primary" size={28} /></div> : qrUrl ? <img src={qrUrl} alt="API payment QR code" className="h-[220px] w-[220px] rounded-2xl bg-white p-2" /> : <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-border bg-surface text-xs text-muted-foreground">Choose a network</div>}<span className="flex items-center gap-1.5 text-xs text-muted-foreground"><QrCode size={14} /> Crypto QR</span></div>
            <div className="min-w-0 space-y-4"><div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs text-muted-foreground">Order total (USD, not a crypto transfer amount)</p><p className="mt-1 text-2xl font-bold text-primary" dir="ltr">${checkout.pack.price.toFixed(2)} USD</p><p className="mt-1 text-xs text-muted-foreground">{checkout.pack.credits.toLocaleString()} API Credits · one-time. Check the equivalent amount in your wallet for the selected network.</p></div>
              <div><p className="mb-2 text-xs font-semibold">Payment address</p><p className="break-all rounded-xl border border-border bg-surface p-3 font-mono text-[11px] leading-5" dir="ltr">{paymentAddress}</p><Button type="button" size="sm" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(paymentAddress); setCopiedAddress(true); window.setTimeout(() => setCopiedAddress(false), 1800); }} className="mt-2 min-h-11 w-full sm:w-auto">{copiedAddress ? <Check size={14} /> : <Copy size={14} />}{copiedAddress ? 'Copied' : 'Copy address'}</Button></div>
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-xs text-amber-500"><AlertTriangle size={14} className="mt-0.5 shrink-0" /><p>{quote?.warning || 'Use the selected network. Wrong-network transfers can be lost.'}</p></div>
            </div>
          </div>
          <div className="mt-6 min-w-0 space-y-4 rounded-2xl border border-primary/20 bg-primary/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><CreditCard size={16} /> Submit transaction for review</div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row"><input value={txId} onChange={(event) => setTxId(event.target.value)} placeholder="Transaction hash / TXID" dir="ltr" className="min-h-11 min-w-0 w-full flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary" /><Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => void submitPayment()} disabled={!txId.trim() || paymentSubmitting || quoteLoading || !quote || !!paymentError || paymentSaved}>{paymentSubmitting ? <LoaderCircle className="animate-spin" size={16} /> : <CreditCard size={16} />}{paymentSubmitting ? 'Submitting…' : 'Submit TXID'}</Button></div>
            {paymentSaved && <p className="flex items-center gap-1.5 text-xs text-green-400"><Check size={14} /> Pending admin verification. Credits unlock after approval.</p>}{paymentError && <p className="text-xs text-red-400">{paymentError}</p>}<Link href="/support" onClick={() => setPaymentOpen(false)} className="inline-flex min-h-11 items-center gap-1.5 text-xs text-primary hover:underline">Need payment help <ExternalLink size={13} /></Link>
          </div>
        </div>
      </div>}
    </div>
  );
}
