import { useState } from 'react';
import { useCommunityApi, useCommunityCopy } from '../../lib/community';
import { PillButton, Sheet } from './primitives';
import { useToast } from '../../hooks/use-toast';

export function ReportSheet({ open, onClose, postId, userId }: { open: boolean; onClose: () => void; postId?: string; userId?: string }) {
  const { c } = useCommunityCopy();
  const api = useCommunityApi();
  const { toast } = useToast();
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const reasons: Array<[string, string]> = [['spam', c.reasonSpam], ['abuse', c.reasonAbuse], ['explicit', c.reasonNsfw], ['other', c.reasonOther]];

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const full = details.trim() ? `${reason}: ${details.trim()}` : reason;
      await api('/community/reports', { method: 'POST', body: JSON.stringify(postId ? { postId, reason: full } : { userId, reason: full }) });
      toast({ title: c.reportSent });
      setDetails(''); onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : c.errorLoad);
    } finally { setBusy(false); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={c.reportTitle}>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-muted-foreground">{c.reportReason}</legend>
        {reasons.map(([value, label]) => (
          <label key={value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-border px-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
            <input type="radio" name="report-reason" value={value} checked={reason === value} onChange={() => setReason(value)} className="accent-[hsl(var(--primary))]" data-testid={`radio-reason-${value}`} />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </fieldset>
      <label className="mt-4 block text-sm text-muted-foreground">
        {c.reasonDetails}
        <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 500))} rows={3} className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-foreground outline-none focus:border-primary" data-testid="input-report-details" />
      </label>
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <PillButton variant="outline" onClick={onClose}>{c.cancel}</PillButton>
        <PillButton variant="gold" onClick={() => void submit()} disabled={busy} testId="button-send-report">{c.reportSend}</PillButton>
      </div>
    </Sheet>
  );
}
