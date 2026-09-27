import { useState } from 'react';
import { Link } from 'wouter';
import { Flag } from 'lucide-react';
import { formatRelative, useCommunityApi, useCommunityCopy, type Report } from '../../../lib/community';
import { PillButton } from '../primitives';
import { useToast } from '../../../hooks/use-toast';

export function ReportsPanel({ reports, onChanged }: { reports: Report[]; onChanged: () => void }) {
  const { c, lang } = useCommunityCopy();
  const api = useCommunityApi();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const open = reports.filter((r) => r.status === 'open' || r.status === 'pending' || !r.status);
  const closed = reports.filter((r) => !open.includes(r));

  const act = async (r: Report, status: 'resolved' | 'dismissed', removePost = false) => {
    setBusy(r.id);
    try {
      await api(`/admin/community/reports/${encodeURIComponent(r.id)}`, { method: 'PATCH', body: JSON.stringify({ status, ...(removePost ? { removePost: true } : {}) }) });
      onChanged();
    } catch (e) { toast({ title: e instanceof Error ? e.message : c.errorLoad, variant: 'destructive' }); } finally { setBusy(null); }
  };

  const row = (r: Report, actionable: boolean) => (
    <li key={r.id} className="rounded-2xl border border-border p-3" data-testid={`row-report-${r.id}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{r.postId ? 'post' : 'user'}</span>
        <span>{formatRelative(r.createdAt, lang)}</span>
        {!actionable && <span className="rounded-full border border-border px-2 py-0.5">{r.status}</span>}
        <Link href={r.postId ? `/community/post/${encodeURIComponent(r.postId)}` : `/community/profile/${encodeURIComponent(r.userId ?? '')}`} className="ms-auto font-semibold text-primary hover:underline">{c.open}</Link>
      </div>
      <p className="mt-2 break-words text-sm" dir="auto">{r.reason}</p>
      {actionable && (
        <div className="mt-3 flex flex-wrap gap-2">
          <PillButton variant="outline" onClick={() => void act(r, 'dismissed')} disabled={busy === r.id} testId={`button-dismiss-${r.id}`}>{c.dismiss}</PillButton>
          <PillButton variant="outline" onClick={() => void act(r, 'resolved')} disabled={busy === r.id} testId={`button-resolve-${r.id}`}>{c.resolve}</PillButton>
          {r.postId && <PillButton variant="danger" onClick={() => void act(r, 'resolved', true)} disabled={busy === r.id} testId={`button-remove-${r.id}`}>{c.removePost}</PillButton>}
        </div>
      )}
    </li>
  );

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-semibold"><Flag className="h-4 w-4 text-primary" />{c.reports} <span className="text-sm font-normal text-muted-foreground">({open.length})</span></h3>
      {open.length ? <ul className="mt-3 space-y-2">{open.map((r) => row(r, true))}</ul> : <p className="py-6 text-center text-sm text-muted-foreground">{c.noReports}</p>}
      {closed.length > 0 && (
        <details className="mt-3"><summary className="min-h-11 cursor-pointer py-2 text-sm text-muted-foreground">{c.status}: {closed.length}</summary><ul className="space-y-2">{closed.slice(0, 30).map((r) => row(r, false))}</ul></details>
      )}
    </section>
  );
}
