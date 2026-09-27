import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Check, LoaderCircle, RefreshCw, Ticket, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button, Card } from './ui-parts';

type Kind = 'discount' | 'credits' | 'membership';
type Code = { id: string; code: string; kind: Kind; value: number; planId: string | null; maxUses: number; usedCount: number; active: boolean; createdAt: string };
const plans = [
  { id: 'swift-rider', label: 'Swift Rider' },
  { id: 'horse-runner', label: 'Horse Runner' },
  { id: 'lone-rider', label: 'Lone Rider' },
];
const fieldClass = 'mt-2 w-full min-w-0 rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary disabled:opacity-50';

export function AdminCodes({ isRtl }: { isRtl: boolean }) {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>('discount');
  const [customCode, setCustomCode] = useState('');
  const [value, setValue] = useState('');
  const [planId, setPlanId] = useState('');
  const [maxUses, setMaxUses] = useState('1');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/admin/codes', { credentials: 'include' });
      const data = await response.json() as { codes?: Code[]; error?: string };
      if (!response.ok || !Array.isArray(data.codes)) throw new Error(data.error || (isRtl ? 'بارگذاری کدها ناموفق بود.' : 'Could not load codes.'));
      setCodes(data.codes);
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not load codes.');
    } finally {
      setLoading(false);
    }
  }, [isRtl]);

  useEffect(() => { void load(); }, [load]);

  const validation = (() => {
    const numericValue = Number(value);
    const uses = Number(maxUses);
    if (customCode.trim() && !/^[A-Za-z0-9_-]{1,20}$/.test(customCode.trim())) return isRtl ? 'کد باید ۱ تا ۲۰ نویسه و فقط شامل حروف لاتین، عدد، خط تیره یا زیرخط باشد.' : 'Code must be 1–20 letters, numbers, hyphens or underscores.';
    if (!Number.isSafeInteger(numericValue) || numericValue <= 0) return isRtl ? 'مقدار باید عدد صحیح مثبت باشد.' : 'Value must be a positive whole number.';
    if (kind === 'discount' && numericValue > 99) return isRtl ? 'تخفیف باید بین ۱ تا ۹۹ درصد باشد.' : 'Discount must be between 1 and 99 percent.';
    if (kind === 'membership' && !planId) return isRtl ? 'یک طرح ماهانه انتخاب کنید.' : 'Select a monthly plan.';
    if (!Number.isSafeInteger(uses) || uses <= 0) return isRtl ? 'حداکثر تعداد کاربران باید عدد صحیح مثبت باشد.' : 'Maximum users must be a positive whole number.';
    return '';
  })();

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || validation) { if (validation) setActionError(validation); return; }
    setBusy('create');
    setActionError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/codes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          ...(customCode.trim() ? { code: customCode.trim().toUpperCase() } : {}),
          value: Number(value),
          ...(kind === 'membership' ? { planId } : {}),
          maxUses: Number(maxUses),
        }),
      });
      const data = await response.json() as { code?: Code; error?: string };
      if (!response.ok || !data.code) throw new Error(data.error || (isRtl ? 'کد ساخته نشد.' : 'Could not create code.'));
      setCodes((current) => [data.code!, ...current.filter((item) => item.id !== data.code!.id)]);
      setSuccess(isRtl ? `کد ${data.code.code} ساخته شد.` : `Code ${data.code.code} created.`);
      setCustomCode('');
      setValue('');
      setMaxUses('1');
      setPlanId('');
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not create code.');
    } finally {
      setBusy(null);
    }
  };

  const setActive = async (code: Code) => {
    if (busy) return;
    setBusy(code.id);
    setActionError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/codes/${encodeURIComponent(code.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !code.active }),
      });
      const data = await response.json() as { code?: Code; error?: string };
      if (!response.ok || !data.code) throw new Error(data.error || (isRtl ? 'تغییر وضعیت ناموفق بود.' : 'Could not update code.'));
      setCodes((current) => current.map((item) => item.id === code.id ? data.code! : item));
      setSuccess(isRtl ? `کد ${data.code.code} ${data.code.active ? 'فعال' : 'غیرفعال'} شد.` : `${data.code.code} ${data.code.active ? 'activated' : 'deactivated'}.`);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not update code.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Ticket size={20} /></span>
          <div>
            <h2 className="font-semibold">{isRtl ? 'کدهای تخفیف و هدیه' : 'Promo & redeem codes'}</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{isRtl ? 'کدهای تخفیف، اعتبار و عضویت را بسازید و مدیریت کنید.' : 'Issue discounts, credits, or timed memberships. Turn codes off at any time.'}</p>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" data-testid="button-refresh-codes" onClick={() => { void load(); }} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {isRtl ? 'تازه‌سازی' : 'Refresh'}
        </Button>
      </div>

      <form onSubmit={(event) => { void create(event); }} className="mt-5 space-y-4 rounded-xl border border-border bg-background/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{isRtl ? 'ایجاد کد جدید' : 'Create a new code'}</h3>
          <span className="text-xs text-muted-foreground">{isRtl ? 'فیلد کد اختیاری است' : 'Leave code blank to generate one'}</span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="min-w-0 text-xs font-medium">{isRtl ? 'نوع' : 'Type'}
            <select data-testid="select-code-kind" value={kind} onChange={(event) => { setKind(event.target.value as Kind); setValue(''); setPlanId(''); setActionError(''); }} disabled={!!busy} className={fieldClass}>
              <option value="discount">{isRtl ? 'تخفیف درصدی' : 'Percent discount'}</option>
              <option value="credits">{isRtl ? 'اعتبار' : 'Credits'}</option>
              <option value="membership">{isRtl ? 'عضویت' : 'Membership'}</option>
            </select>
          </label>
          <label className="min-w-0 text-xs font-medium">{isRtl ? 'کد دلخواه (اختیاری)' : 'Custom code (optional)'}
            <input data-testid="input-custom-code" value={customCode} onChange={(event) => setCustomCode(event.target.value)} maxLength={20} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="FEZI-SPECIAL" dir="ltr" disabled={!!busy} className={fieldClass} />
          </label>
          <label className="min-w-0 text-xs font-medium">{kind === 'discount' ? (isRtl ? 'تخفیف (%)' : 'Discount (%)') : kind === 'credits' ? (isRtl ? 'مقدار اعتبار' : 'Credits amount') : (isRtl ? 'مدت عضویت (روز)' : 'Membership (days)')}
            <input data-testid="input-code-value" type="number" min={1} max={kind === 'discount' ? 100 : undefined} step={1} required value={value} onChange={(event) => setValue(event.target.value)} disabled={!!busy} className={fieldClass} />
          </label>
          <label className="min-w-0 text-xs font-medium">{isRtl ? 'حداکثر تعداد کاربران' : 'Maximum users'}
            <input data-testid="input-code-max-uses" type="number" min={1} step={1} required value={maxUses} onChange={(event) => setMaxUses(event.target.value)} disabled={!!busy} className={fieldClass} />
          </label>
        </div>
        {kind === 'membership' && <label className="block max-w-sm text-xs font-medium">{isRtl ? 'طرح ماهانه' : 'Monthly plan'}
          <select data-testid="select-code-plan" required value={planId} onChange={(event) => setPlanId(event.target.value)} disabled={!!busy} className={fieldClass}>
            <option value="">{isRtl ? 'یک طرح انتخاب کنید' : 'Select a plan'}</option>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.label}</option>)}
          </select>
        </label>}
        {validation && (value !== '' || customCode.trim() !== '' || maxUses !== '1' || (kind === 'membership' && !!planId)) && <p data-testid="text-code-validation" className="text-xs text-red-400">{validation}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">{kind === 'membership' ? (isRtl ? 'فقط طرح‌های ماهانه؛ طرح مادام‌العمر شامل نمی‌شود.' : 'Monthly plans only; lifetime is excluded.') : kind === 'discount' ? (isRtl ? '۱ تا ۹۹ درصد. هر کاربر هنگام اعمال کد یک سهمیه استفاده می‌کند، حتی اگر خرید نکند.' : '1–99%. Each user uses one slot when applying the code, even without completing a purchase.') : (isRtl ? 'اعتبار باید عدد صحیح مثبت باشد.' : 'Credits must be a positive whole number.')}</p>
          <Button type="submit" data-testid="button-create-code" disabled={!!busy || !!validation} className="w-full sm:w-auto">
            {busy === 'create' ? <LoaderCircle size={15} className="animate-spin" /> : <Ticket size={15} />}
            {busy === 'create' ? (isRtl ? 'در حال ایجاد…' : 'Creating…') : (isRtl ? 'ایجاد کد' : 'Create code')}
          </Button>
        </div>
      </form>

      {actionError && <p role="alert" data-testid="status-code-error" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">{actionError}</p>}
      {success && <p role="status" data-testid="status-code-success" className="mt-4 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm text-green-400"><Check size={16} />{success}</p>}

      <div className="mt-7 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{isRtl ? 'کدهای صادرشده' : 'Issued codes'}</h3>
        {!loading && !loadError && <span data-testid="text-code-count" className="text-xs tabular-nums text-muted-foreground">{codes.length} {isRtl ? 'کد' : 'codes'}</span>}
      </div>
      {loading && <div aria-label={isRtl ? 'در حال بارگذاری کدها' : 'Loading codes'} className="mt-4 space-y-2">{[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-primary/5" />)}</div>}
      {loadError && <div role="alert" data-testid="status-codes-load-error" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
        <span>{loadError}</span><Button type="button" size="sm" variant="secondary" onClick={() => { void load(); }}>{isRtl ? 'تلاش دوباره' : 'Retry'}</Button>
      </div>}
      {!loading && !loadError && codes.length === 0 && <div className="mt-4 rounded-xl border border-dashed border-border px-5 py-10 text-center">
        <Ticket size={25} className="mx-auto mb-3 text-primary/50" />
        <p className="text-sm font-medium">{isRtl ? 'هنوز کدی صادر نشده است' : 'No codes issued yet'}</p>
        <p className="mt-1 text-xs text-muted-foreground">{isRtl ? 'برای شروع، فرم بالا را تکمیل کنید.' : 'Create your first code with the form above.'}</p>
      </div>}
      {!loading && !loadError && codes.length > 0 && <div className="mt-4 space-y-2">
        {codes.map((code) => (
          <div key={code.id} data-testid={`card-code-${code.id}`} className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong dir="ltr" data-testid={`text-code-${code.id}`} className="break-all font-mono text-sm tracking-wide">{code.code}</strong>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${code.active ? 'bg-green-500/10 text-green-400' : 'bg-muted text-muted-foreground'}`}>{code.active ? (isRtl ? 'فعال' : 'Active') : (isRtl ? 'غیرفعال' : 'Inactive')}</span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {code.kind === 'discount' ? `${code.value}% ${isRtl ? 'تخفیف' : 'discount'}` : code.kind === 'credits' ? `${code.value.toLocaleString()} ${isRtl ? 'اعتبار' : 'credits'}` : `${code.value} ${isRtl ? 'روز' : 'days'} · ${plans.find((plan) => plan.id === code.planId)?.label || code.planId || '—'}`}
                <span className="mx-2 opacity-50">·</span>
                <span data-testid={`text-code-usage-${code.id}`} className="tabular-nums">{code.usedCount.toLocaleString()} / {code.maxUses.toLocaleString()} {isRtl ? 'استفاده' : 'used'}</span>
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{new Date(code.createdAt).toLocaleDateString(isRtl ? 'fa-IR' : 'en-US')}</p>
            </div>
            <Button type="button" size="sm" variant="secondary" data-testid={`button-toggle-code-${code.id}`} onClick={() => { void setActive(code); }} disabled={!!busy} className="w-full shrink-0 sm:w-auto" aria-label={code.active ? `Deactivate ${code.code}` : `Activate ${code.code}`}>
              {busy === code.id ? <LoaderCircle size={15} className="animate-spin" /> : code.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {code.active ? (isRtl ? 'غیرفعال کردن' : 'Deactivate') : (isRtl ? 'فعال کردن' : 'Activate')}
            </Button>
          </div>
        ))}
      </div>}
    </Card>
  );
}