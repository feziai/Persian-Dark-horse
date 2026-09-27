import { useCallback, useEffect, useState } from 'react';
import { Activity, Eye } from 'lucide-react';
import { useCommunityApi, useCommunityCopy, usePolling } from '../../../lib/community';
import { ErrorState } from '../primitives';
import { cn } from '../../../lib/utils';

type Period = 'day' | 'week' | 'month';
type Analytics = { online: number; visits: number; series: { label: string; visits: number }[] };

function BarChart({ series, lang }: { series: Analytics['series']; lang: string }) {
  const max = Math.max(1, ...series.map((s) => s.visits));
  const nf = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US');
  const step = Math.ceil(series.length / 8);
  return (
    <div className="mt-4" dir="ltr">
      <div className="flex h-48 items-end gap-[3px] border-b border-border" role="img" aria-label={series.map((s) => `${s.label}: ${s.visits}`).join(', ')}>
        {series.map((s, i) => (
          <div key={`${s.label}-${i}`} className="group relative flex h-full flex-1 items-end">
            <div className="w-full origin-bottom rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary" style={{ height: `${(s.visits / max) * 100}%`, minHeight: s.visits ? 2 : 0 }} />
            <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-[11px] text-background opacity-0 group-hover:opacity-100">{s.label}: {nf.format(s.visits)}</span>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-muted-foreground">
        {series.map((s, i) => <span key={`${s.label}-l-${i}`} className="flex-1 truncate text-center">{i % step === 0 ? s.label : ''}</span>)}
      </div>
    </div>
  );
}

export function AnalyticsPanel() {
  const { c, lang } = useCommunityCopy();
  const api = useCommunityApi();
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { setData(await api<Analytics>(`/admin/community/analytics?period=${period}`)); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); }
  }, [api, period, c.errorLoad]);
  useEffect(() => { setData(null); void load(); }, [load]);
  usePolling(() => void load(), 30000);
  const nf = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US');

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{c.analytics}</h3>
        <div role="radiogroup" aria-label={c.analytics} className="flex rounded-full border border-border p-1">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)}
              className={cn('min-h-9 rounded-full px-4 text-sm font-medium', period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')} data-testid={`button-period-${p}`}>{c[p]}</button>
          ))}
        </div>
      </div>
      {error && !data ? <ErrorState message={`${c.errorLoad} ${error}`} onRetry={() => void load()} /> : !data ? (
        <div className="pulse-soft mt-4 h-56 rounded-2xl bg-surface-hover" aria-busy="true" />
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border p-3"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5 text-emerald-500" />{c.online}</span><strong className="text-2xl tabular-nums" data-testid="text-online">{nf.format(data.online)}</strong></div>
            <div className="rounded-2xl border border-border p-3"><span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5 text-primary" />{c.visits}</span><strong className="text-2xl tabular-nums" data-testid="text-visits">{nf.format(data.visits)}</strong></div>
          </div>
          {data.series.length && data.series.some((s) => s.visits > 0) ? <BarChart series={data.series} lang={lang} /> : <p className="py-10 text-center text-sm text-muted-foreground">{c.noData}</p>}
        </>
      )}
    </section>
  );
}
