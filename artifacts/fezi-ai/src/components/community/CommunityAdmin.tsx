import { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useCommunityApi, useCommunityCopy, usePolling, type Banner, type NewsStatus, type Post, type Report } from '../../lib/community';
import { ErrorState } from './primitives';
import { AnalyticsPanel } from './admin/AnalyticsPanel';
import { BannerEditor } from './admin/BannerEditor';
import { NewsDesk } from './admin/NewsDesk';
import { ReportsPanel } from './admin/ReportsPanel';

type AdminData = { reports: Report[]; banners: Banner[]; news: Post[]; newsStatus: NewsStatus };

/** Admin community console. Relies on the existing HttpOnly admin session cookie. */
export function CommunityAdmin() {
  const { c, isRtl } = useCommunityCopy();
  const api = useCommunityApi();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(0);

  const load = useCallback(async () => {
    try { setData(await api<AdminData>('/admin/community')); setError(''); setStatus(0); }
    catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); setStatus((e as { status?: number }).status ?? 0); }
  }, [api, c.errorLoad]);
  useEffect(() => { void load(); }, [load]);
  usePolling(() => void load(), 45000, !error);

  if (error && !data) {
    return status === 401 || status === 403
      ? <div className="flex items-center gap-3 rounded-3xl border border-border p-6 text-sm text-muted-foreground"><ShieldAlert className="h-5 w-5 text-primary" />{c.adminRequired}</div>
      : <ErrorState message={`${c.errorLoad} ${error}`} onRetry={() => void load()} />;
  }
  if (!data) return <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="pulse-soft h-64 rounded-3xl bg-surface-hover" />)}</div>;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="space-y-4" data-testid="panel-community-admin">
      <h2 className="text-xl font-semibold tracking-tight">{c.admin}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <AnalyticsPanel />
        <ReportsPanel reports={data.reports} onChanged={() => void load()} />
      </div>
      <NewsDesk news={data.news} status={data.newsStatus} onChanged={() => void load()} />
      <BannerEditor initial={data.banners} onSaved={(banners) => setData((d) => (d ? { ...d, banners } : d))} />
    </div>
  );
}

export default CommunityAdmin;
