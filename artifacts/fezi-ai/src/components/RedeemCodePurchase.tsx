import { useCallback, useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { useAuth } from '@clerk/react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, History, LoaderCircle, RefreshCw, ShieldCheck, Ticket, X } from 'lucide-react';
import { Button } from './ui-parts';
import { WalletPayment } from './WalletPayment';

export type RedeemCodeOrder = {
  id: string; amountUsd: number; credits: number; currency: string; currencyLabel: string; network: string;
  address: string; cryptoAmount: string; status: 'awaiting_payment' | 'pending' | 'issued' | 'redeemed';
  code: string | null; createdAt: string; redeemedAt: string | null; txId: string | null; verificationMessage?: string;
};
type RedeemCurrency = { id: string; label: string; ticker: string; network: string; address: string };
type Catalog = { nextCursor?: string | null; orders: RedeemCodeOrder[]; currencies: RedeemCurrency[]; minAmountUsd: number; creditsPerDollar: number };
export type RedeemResult = { creditsAdded: number; credits: number; creditsLimit: number };

export const PURCHASED_CODE_PATTERN = /^FEZI-[0-9A-F]{48}$/i;

function normalizeDigits(raw: string) {
  return raw.replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0)).replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[\u066B\u060C,]/g, '.');
}

class ApiError extends Error {}

export async function redeemFetch<T>(path: string, getToken: () => Promise<string | null>, body?: object): Promise<T> {
  const token = await getToken();
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) throw new ApiError(payload.message || payload.error || `Request failed (${response.status})`);
  return payload;
}

export function useRedeemPurchasedCode() {
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  return useCallback(async (code: string) => {
    const result = await redeemFetch<RedeemResult>('/api/payments/redeem-codes/redeem', getToken, { code: code.trim() });
    await queryClient.invalidateQueries();
    return result;
  }, [getToken, queryClient]);
}

/** Parses USD into integer cents; null if invalid or unsafe. */
function parseCents(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [whole, frac = ''] = value.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(cents * 8)) return null;
  return cents;
}

const PRESETS = ['10', '15', '20', '50'];

export function RedeemCodePurchase({ open, onOpenChange, isRtl }: { open: boolean; onOpenChange: (open: boolean) => void; isRtl: boolean }) {
  const { getToken, userId } = useAuth();
  const redeem = useRedeemPurchasedCode();
  const tr = (fa: string, en: string) => (isRtl ? fa : en);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [view, setView] = useState<'buy' | 'history'>('buy');
  const [amount, setAmount] = useState('10');
  const [currency, setCurrency] = useState('');
  const [order, setOrder] = useState<RedeemCodeOrder | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [txId, setTxId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [polling, setPolling] = useState(false);
  const [copied, setCopied] = useState('');
  const [redeemState, setRedeemState] = useState<Record<string, { busy?: boolean; msg?: string; ok?: boolean }>>({});
  const pollRef = useRef<number | null>(null);
  const loadSeq = useRef(0);
  const orderSeq = useRef(0);
  const verifyInFlight = useRef(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState('');
  const [copyError, setCopyError] = useState('');

  useEffect(() => {
    loadSeq.current += 1; orderSeq.current += 1;
    setCatalog(null); setOrder(null); setTxId(''); setVerifyError(''); setCreateError(''); setLoadError('');
    setRedeemState({}); setCopied(''); setCopyError(''); setOlderError(''); setCurrency(''); setView('buy');
  }, [userId]);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setLoading(true); setLoadError('');
    try {
      const data = await redeemFetch<Catalog>('/api/payments/redeem-codes', getToken);
      if (seq !== loadSeq.current) return;
      setCatalog(data);
      setCurrency((current) => current || data.currencies[0]?.id || '');
    } catch (error) { if (seq === loadSeq.current) setLoadError(error instanceof Error ? error.message : 'Error'); }
    finally { if (seq === loadSeq.current) setLoading(false); }
  }, [getToken]);

  const loadOlder = async () => {
    const cursor = catalog?.nextCursor;
    if (!cursor) return;
    const seq = loadSeq.current;
    setLoadingOlder(true); setOlderError('');
    try {
      const data = await redeemFetch<Catalog>(`/api/payments/redeem-codes?before=${encodeURIComponent(cursor)}`, getToken);
      if (seq !== loadSeq.current) return;
      setCatalog((c) => c ? { ...c, nextCursor: data.nextCursor ?? null, orders: [...c.orders, ...data.orders.filter((o) => !c.orders.some((x) => x.id === o.id))] } : c);
    } catch (error) { if (seq === loadSeq.current) setOlderError(error instanceof Error ? error.message : 'Error'); }
    finally { setLoadingOlder(false); }
  };

  useEffect(() => { if (open) void load(); }, [open, load]);

  const selectOrder = (next: RedeemCodeOrder | null) => { orderSeq.current += 1; setOrder(next); };
  const upsertOrder = (next: RedeemCodeOrder) => {
    setOrder(next);
    setCatalog((c) => c ? { ...c, orders: [next, ...c.orders.filter((o) => o.id !== next.id)] } : c);
  };

  const verify = useCallback(async (target: RedeemCodeOrder, hash: string, silent = false) => {
    if (verifyInFlight.current) return null;
    verifyInFlight.current = true;
    const seq = orderSeq.current;
    const user = loadSeq.current;
    if (!silent) { setVerifying(true); setVerifyError(''); }
    try {
      const data = await redeemFetch<{ order: RedeemCodeOrder }>(`/api/payments/redeem-codes/orders/${encodeURIComponent(target.id)}/verify`, getToken, { txId: hash.trim() });
      if (user !== loadSeq.current) return null;
      if (seq === orderSeq.current) upsertOrder(data.order);
      else setCatalog((c) => c ? { ...c, orders: c.orders.map((o) => o.id === data.order.id ? data.order : o) } : c);
      return data.order;
    } catch (error) {
      if (!silent && seq === orderSeq.current) setVerifyError(error instanceof Error ? error.message : 'Error');
      return null;
    } finally { verifyInFlight.current = false; if (!silent) setVerifying(false); }
  }, [getToken]);

  // Poll pending orders every 15s while open.
  useEffect(() => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (!open || !order || order.status !== 'pending' || !order.txId) { setPolling(false); return; }
    setPolling(true);
    const target = order; const hash = order.txId;
    pollRef.current = window.setInterval(() => { void verify(target, hash, true); }, 15000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [open, order, verify]);

  const min = catalog?.minAmountUsd ?? 10;
  const rate = catalog?.creditsPerDollar ?? 800;
  const cents = parseCents(amount);
  const amountValid = cents !== null && cents >= min * 100;
  const previewCredits = cents !== null ? (cents * rate) / 100 : null;
  const selectedCurrency = catalog?.currencies.find((c) => c.id === currency);

  const createOrder = async () => {
    if (!amountValid || !currency) return;
    const seq = loadSeq.current;
    orderSeq.current += 1;
    setCreating(true); setCreateError('');
    try {
      const data = await redeemFetch<{ order: RedeemCodeOrder }>('/api/payments/redeem-codes/orders', getToken, { amountUsd: amount.trim(), currency });
      if (seq !== loadSeq.current) return;
      selectOrder(data.order); upsertOrder(data.order); setTxId('');
    } catch (error) { setCreateError(error instanceof Error ? error.message : 'Error'); }
    finally { setCreating(false); }
  };

  const copy = async (key: string, text: string) => {
    setCopyError('');
    try {
      if (!navigator.clipboard) throw new Error('unavailable');
      await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCopyError(key);
    }
  };

  const redeemSaved = async (o: RedeemCodeOrder) => {
    if (!o.code) return;
    setRedeemState((s) => ({ ...s, [o.id]: { busy: true } }));
    try {
      const result = await redeem(o.code);
      setRedeemState((s) => ({ ...s, [o.id]: { ok: true, msg: tr(`${result.creditsAdded.toLocaleString('en-US')} اعتبار به حساب شما اضافه شد.`, `${result.creditsAdded.toLocaleString('en-US')} credits added to your account.`) } }));
      const redeemedAt = new Date().toISOString();
      setCatalog((c) => c ? { ...c, orders: c.orders.map((x) => x.id === o.id ? { ...x, status: 'redeemed', code: null, redeemedAt } : x) } : c);
      setOrder((cur) => cur && cur.id === o.id ? { ...cur, status: 'redeemed', code: null, redeemedAt } : cur);
    } catch (error) {
      setRedeemState((s) => ({ ...s, [o.id]: { ok: false, msg: error instanceof Error ? error.message : 'Error' } }));
    }
  };

  const statusLabel = (s: RedeemCodeOrder['status']) => ({
    awaiting_payment: tr('در انتظار پرداخت', 'Awaiting payment'), pending: tr('در حال تأیید', 'Verifying'),
    issued: tr('کد صادر شد', 'Code issued'), redeemed: tr('استفاده شده', 'Redeemed'),
  })[s];

  const fmtDate = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(d); };
  const redeemedNote = (o: RedeemCodeOrder) => (
    <div role="status" className="space-y-1 text-xs">
      {redeemState[o.id]?.ok && <p className="font-semibold text-emerald-400">{redeemState[o.id]?.msg}</p>}
      <p className="text-muted-foreground">{tr(`این کد روی حساب شما استفاده شد${o.redeemedAt ? ` در ${fmtDate(o.redeemedAt)}` : ''}.`, `This code was redeemed on your account${o.redeemedAt ? ` on ${fmtDate(o.redeemedAt)}` : ''}.`)}</p>
    </div>
  );

  const codeBox = (o: RedeemCodeOrder) => o.status === 'redeemed' ? redeemedNote(o) : o.code && (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input readOnly value={o.code} dir="ltr" onFocus={(e) => e.currentTarget.select()} aria-label={tr('کد خریداری‌شده', 'Purchased code')} className="min-h-11 min-w-0 flex-1 select-all rounded-xl border border-primary/40 bg-background px-3 font-mono text-sm font-semibold tracking-wide text-foreground" />
        <Button type="button" variant="secondary" onClick={() => void copy(o.id, o.code!)}>{copied === o.id ? <Check size={15} /> : <Copy size={15} />}{copied === o.id ? tr('کپی شد', 'Copied') : tr('کپی', 'Copy')}</Button>
      </div>
      {copyError === o.id && <p role="alert" className="text-xs text-red-400">{tr('کپی خودکار ممکن نشد. کد را در کادر بالا انتخاب و دستی کپی کنید.', 'Copy failed. Select the code in the box above and copy it manually.')}</p>}
      {o.status === 'issued' && <Button type="button" size="sm" disabled={redeemState[o.id]?.busy} onClick={() => void redeemSaved(o)}>{redeemState[o.id]?.busy && <LoaderCircle size={14} className="animate-spin" />}{tr('استفاده از این کد برای حساب من', 'Redeem this code on my account')}</Button>}
      {redeemState[o.id]?.msg && <p role="status" className={`text-xs ${redeemState[o.id]?.ok ? 'text-emerald-400' : 'text-red-400'}`}>{redeemState[o.id]?.msg}</p>}
    </div>
  );


  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <DialogPrimitive.Content dir={isRtl ? 'rtl' : 'ltr'} className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[1.5rem] border border-primary/25 bg-surface text-foreground shadow-2xl outline-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[min(40rem,94vw)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[1.5rem]" data-testid="dialog-buy-redeem-code">
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Persian Dark Horse / {tr('کد اعتبار', 'CREDIT CODE')}</p>
              <DialogPrimitive.Title className="mt-1 text-lg font-semibold">{tr('خرید کد اعتبار', 'Buy a credit code')}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-xs leading-5 text-muted-foreground">{tr(`هر دلار ${rate} اعتبار. کدها منقضی نمی‌شوند و یک بار روی حساب خودتان قابل استفاده‌اند.`, `${rate} credits per USD. Codes never expire and can be redeemed once on your own account.`)}</DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-2 text-muted-foreground hover:bg-primary/10 hover:text-foreground" aria-label={tr('بستن', 'Close')}><X size={18} /></DialogPrimitive.Close>
          </div>
          <div className="flex gap-1 border-b border-border px-5 py-2" role="tablist">
            {(['buy', 'history'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${view === v ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                {v === 'buy' ? <Ticket size={14} /> : <History size={14} />}{v === 'buy' ? tr('خرید', 'Buy') : tr(`سفارش‌ها${catalog ? ` (${catalog.orders.length})` : ''}`, `Orders${catalog ? ` (${catalog.orders.length})` : ''}`)}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
            {loading && !catalog ? (
              <div className="space-y-3" aria-label={tr('در حال بارگذاری', 'Loading')}>{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-background" />)}</div>
            ) : loadError && !catalog ? (
              <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm"><p>{tr('بارگذاری گزینه‌های خرید ممکن نشد.', 'Purchase options could not be loaded.')} {loadError}</p><Button type="button" className="mt-3" variant="secondary" onClick={() => void load()}><RefreshCw size={14} />{tr('تلاش دوباره', 'Try again')}</Button></div>
            ) : view === 'history' ? (
              !catalog?.orders.length ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground"><History className="mx-auto mb-2 text-primary" size={20} />{tr('هنوز سفارشی ثبت نکرده‌اید.', 'You have no orders yet.')}<div className="mt-3"><Button type="button" size="sm" onClick={() => setView('buy')}>{tr('خرید اولین کد', 'Buy your first code')}</Button></div></div>
              ) : (
                <ul className="space-y-3">
                  {catalog.orders.map((o) => (
                    <li key={o.id} className="rounded-xl border border-border bg-background/60 p-4" data-testid={`order-${o.id}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-foreground" dir="ltr">${o.amountUsd.toFixed(2)} · {o.credits.toLocaleString('en-US')} {tr('اعتبار', 'credits')}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${o.status === 'issued' ? 'bg-emerald-500/15 text-emerald-400' : o.status === 'redeemed' ? 'bg-muted text-muted-foreground' : 'bg-amber-500/15 text-amber-500'}`}>{statusLabel(o.status)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">{o.currencyLabel} · {o.network} · {fmtDate(o.createdAt)}</p>
                      {o.code ? <div className="mt-3">{codeBox(o)}</div> : (o.status === 'awaiting_payment' || o.status === 'pending') && <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={() => { selectOrder(o); setTxId(o.txId ?? ''); setVerifyError(''); setView('buy'); }}>{tr('ادامه سفارش', 'Resume order')}</Button>}
                    </li>
                  ))}
                  {catalog.nextCursor && <li className="pt-1 text-center"><Button type="button" size="sm" variant="secondary" disabled={loadingOlder} onClick={() => void loadOlder()}>{loadingOlder && <LoaderCircle size={14} className="animate-spin" />}{tr('نمایش سفارش‌های قدیمی‌تر', 'Load older orders')}</Button>{olderError && <p role="alert" className="mt-2 text-xs text-red-400">{olderError}</p>}</li>}
                </ul>
              )
            ) : order ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{tr('سفارش', 'Order')} <span dir="ltr" className="font-mono">{order.id.slice(0, 10)}</span></span><span className="font-semibold text-primary">{statusLabel(order.status)}</span></div>
                {order.status === 'redeemed' ? <div className="rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-4">{redeemedNote(order)}</div> : order.status === 'issued' ? (
                  <div role="status" className="space-y-3 rounded-xl border border-emerald-500/35 bg-emerald-500/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400"><ShieldCheck size={16} />{tr('پرداخت تأیید شد و کد شما صادر شد.', 'Payment verified. Your code has been issued.')}</p>
                    <p className="text-xs text-muted-foreground">{tr(`این کد ${order.credits.toLocaleString('en-US')} اعتبار دارد، منقضی نمی‌شود و به‌طور خودکار استفاده نشده است. هر زمان خواستید می‌توانید آن را روی حساب خودتان استفاده کنید.`, `This code is worth ${order.credits.toLocaleString('en-US')} credits, never expires, and has not been redeemed automatically. Use it on your own account whenever you like.`)}</p>
                    {codeBox(order)}
                  </div>
                ) : (
                  <>
                    <div className="rounded-xl border border-border bg-background/60 p-4 text-sm">
                      <p className="text-xs text-muted-foreground">{tr('دقیقاً این مبلغ را ارسال کنید', 'Send exactly this amount')}</p>
                      <div className="mt-1 flex items-center justify-between gap-2"><strong dir="ltr" className="select-all break-all text-lg text-primary">{order.cryptoAmount} {selectedCurrency?.id === order.currency ? selectedCurrency.ticker : order.currencyLabel}</strong><Button type="button" size="sm" variant="secondary" onClick={() => void copy('amt', order.cryptoAmount)}>{copied === 'amt' ? <Check size={14} /> : <Copy size={14} />}</Button></div>
                      {copyError === 'amt' && <p role="alert" className="text-xs text-red-400">{tr('کپی ممکن نشد؛ مبلغ را دستی انتخاب و کپی کنید.', 'Copy failed; select and copy the amount manually.')}</p>}
                      <p className="mt-3 text-xs text-muted-foreground">{tr('آدرس', 'Address')} · {order.currencyLabel} · {tr('شبکه', 'network')} {order.network}</p>
                      <div className="mt-1 flex items-center justify-between gap-2"><code dir="ltr" className="select-all break-all font-mono text-xs text-foreground">{order.address}</code><Button type="button" size="sm" variant="secondary" onClick={() => void copy('addr', order.address)}>{copied === 'addr' ? <Check size={14} /> : <Copy size={14} />}</Button></div>
                      {copyError === 'addr' && <p role="alert" className="text-xs text-red-400">{tr('کپی ممکن نشد؛ آدرس را دستی انتخاب و کپی کنید.', 'Copy failed; select and copy the address manually.')}</p>}
                      <p className="mt-3 text-[11px] text-muted-foreground" dir="ltr">${order.amountUsd.toFixed(2)} = {order.credits.toLocaleString('en-US')} credits</p>
                      <p className="mt-2 text-[11px] text-amber-500">{tr('مبلغ را کامل و بدون گرد کردن ارسال کنید؛ ارقام اعشاری شناسه سفارش شماست. فقط از همین شبکه ارسال کنید.', 'Send the full amount without rounding; the trailing decimals identify your order. Send only on this network.')}</p>
                    </div>
                    {order.status === 'awaiting_payment' && <WalletPayment currencyId={order.currency} ticker={selectedCurrency?.ticker ?? order.currencyLabel} recipient={order.address} amount={order.cryptoAmount} isRtl={isRtl} onTransactionSubmitted={async (hash) => { setTxId(hash); return !!(await verify(order, hash)); }} />}
                    {order.status === 'pending' && <div role="status" className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs"><LoaderCircle size={14} className="mt-0.5 shrink-0 animate-spin text-amber-500" /><span>{order.verificationMessage || tr('تراکنش هنوز تأیید نشده است.', 'The transaction is not confirmed yet.')} {polling && tr('هر ۱۵ ثانیه دوباره بررسی می‌شود.', 'Checking again every 15 seconds.')}</span></div>}
                    <div>
                      <label htmlFor="redeem-txid" className="text-xs font-semibold">{tr('شناسه تراکنش (TXID)', 'Transaction ID (TXID)')}</label>
                      <div className="mt-1 flex gap-2">
                        <input id="redeem-txid" value={txId} onChange={(e) => setTxId(e.target.value)} dir="ltr" placeholder="0x... / hash" className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 font-mono text-xs outline-none focus:border-primary" />
                        <Button type="button" disabled={!txId.trim() || verifying} onClick={() => void verify(order, txId)}>{verifying && <LoaderCircle size={14} className="animate-spin" />}{order.status === 'pending' ? tr('بررسی دوباره', 'Check again') : tr('تأیید پرداخت', 'Verify payment')}</Button>
                      </div>
                      {verifyError && <p role="alert" className="mt-2 text-xs text-red-400">{verifyError}</p>}
                    </div>
                  </>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={() => { selectOrder(null); setTxId(''); setVerifyError(''); }}>{tr('خرید کد دیگر', 'Buy another code')}</Button>
              </div>
            ) : catalog && (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold">{tr('مبلغ (دلار)', 'Amount (USD)')}</p>
                  <div className="mt-2 grid grid-cols-4 gap-2">
                    {PRESETS.map((p) => <button key={p} type="button" aria-pressed={amount === p} onClick={() => setAmount(p)} className={`min-h-11 rounded-xl border text-sm font-semibold ${amount === p ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background hover:border-primary/50'}`} dir="ltr">${p}</button>)}
                  </div>
                  <label htmlFor="redeem-amount" className="mt-3 block text-[11px] text-muted-foreground">{tr(`مبلغ دلخواه (حداقل $${min})`, `Custom amount (minimum $${min})`)}</label>
                  <input id="redeem-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(normalizeDigits(e.target.value).replace(/[^0-9.]/g, ''))} dir="ltr" aria-invalid={!amountValid} className="mt-1 min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary" />
                  {!amountValid && <p className="mt-1 text-xs text-red-400">{cents === null ? tr('یک مبلغ معتبر با حداکثر دو رقم اعشار وارد کنید.', 'Enter a valid amount with at most two decimals.') : tr(`حداقل مبلغ $${min} است.`, `Minimum amount is $${min}.`)}</p>}
                  <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3" aria-live="polite">
                    <p className="text-[11px] text-muted-foreground">{tr('اعتبار دریافتی', 'Credits you receive')}</p>
                    <p className="text-2xl font-semibold text-primary" dir="ltr">{previewCredits !== null ? previewCredits.toLocaleString('en-US') : '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold">{tr('ارز و شبکه', 'Currency and network')}</p>
                  {catalog.currencies.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">{tr('در حال حاضر شبکه‌ای برای پرداخت فعال نیست.', 'No payment network is available right now.')}</p> : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup">
                      {catalog.currencies.map((c) => <button key={c.id} type="button" role="radio" aria-checked={currency === c.id} onClick={() => setCurrency(c.id)} className={`flex min-h-12 items-center justify-between rounded-xl border px-3 text-start text-xs ${currency === c.id ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/50'}`}><span><b className="text-foreground">{c.label}</b><span className="block text-[10px] text-muted-foreground">{c.network}</span></span>{currency === c.id && <Check size={15} className="text-primary" />}</button>)}
                    </div>
                  )}
                </div>
                {createError && <p role="alert" className="text-xs text-red-400">{createError}</p>}
                <Button type="button" className="w-full" disabled={!amountValid || !currency || creating} onClick={() => void createOrder()}>{creating && <LoaderCircle size={15} className="animate-spin" />}{tr('ساخت سفارش', 'Create order')}</Button>
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
