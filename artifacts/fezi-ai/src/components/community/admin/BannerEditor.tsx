import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { safeHref, uploadMedia, useCommunityApi, useCommunityCopy, type Banner } from '../../../lib/community';
import { PillButton } from '../primitives';
import { useToast } from '../../../hooks/use-toast';

const blank = (i: number): Banner => ({ id: `new-${Date.now()}-${i}`, title: '', text: '', imageUrl: '', buttonLabel: '', buttonHref: '', enabled: false, sortOrder: i });
const field = 'min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';

export function BannerEditor({ initial, onSaved }: { initial: Banner[]; onSaved: (b: Banner[]) => void }) {
  const { c } = useCommunityCopy();
  const api = useCommunityApi();
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  useEffect(() => { setBanners([...initial].sort((a, b) => a.sortOrder - b.sortOrder)); }, [initial]);

  const patch = (id: string, p: Partial<Banner>) => setBanners((cur) => cur.map((b) => (b.id === id ? { ...b, ...p } : b)));
  const move = (i: number, d: -1 | 1) => setBanners((cur) => { const n = [...cur]; const j = i + d; if (j < 0 || j >= n.length) return cur; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const upload = async (file: File | undefined) => {
    const id = target.current;
    if (!file || !id) return;
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') { setError(c.errType); return; }
    setUploading(id); setError('');
    try { const m = await uploadMedia(api, file, true); patch(id, { imageUrl: m.url }); }
    catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); } finally { setUploading(null); }
  };

  const save = async () => {
    for (const b of banners) {
      if (b.buttonHref && !safeHref(b.buttonHref)) { setError(`${c.buttonHref}: ${b.buttonHref}`); return; }
      if (b.enabled && !b.title.trim()) { setError(`${c.title}?`); return; }
    }
    setBusy(true); setError('');
    try {
      const payload = banners.map((b, i) => ({ ...b, sortOrder: i }));
      const res = await api<{ banners: Banner[] }>('/admin/community/banners', { method: 'PUT', body: JSON.stringify({ banners: payload }) });
      onSaved(res.banners); toast({ title: c.saved });
    } catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); } finally { setBusy(false); }
  };

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{c.banners}</h3>
        <PillButton variant="outline" onClick={() => setBanners((cur) => [...cur, blank(cur.length)])} testId="button-add-banner"><Plus className="h-4 w-4" />{c.addBanner}</PillButton>
      </div>
      <input ref={fileRef} type="file" hidden accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
      {!banners.length ? <p className="py-6 text-center text-sm text-muted-foreground">{c.noBanners}</p> : (
        <ol className="mt-3 space-y-3">
          {banners.map((b, i) => {
            const img = safeHref(b.imageUrl);
            return (
              <li key={b.id} className="rounded-2xl border border-border p-3" data-testid={`row-banner-${i}`}>
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <button type="button" onClick={() => { target.current = b.id; fileRef.current?.click(); }} aria-label={`${c.upload} ${c.image}`}
                    className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-background text-muted-foreground hover:border-primary hover:text-primary" data-testid={`button-banner-image-${i}`}>
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <ImagePlus className="h-6 w-6" />}
                    {uploading === b.id && <span className="absolute inset-0 flex items-center justify-center bg-background/70"><Loader2 className="h-5 w-5 animate-spin" /></span>}
                  </button>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className={field} placeholder={c.title} aria-label={c.title} value={b.title} dir="auto" onChange={(e) => patch(b.id, { title: e.target.value })} data-testid={`input-banner-title-${i}`} />
                    <input className={field} placeholder={c.text} aria-label={c.text} value={b.text} dir="auto" onChange={(e) => patch(b.id, { text: e.target.value })} />
                    <input className={field} placeholder={c.buttonLabel} aria-label={c.buttonLabel} value={b.buttonLabel} dir="auto" onChange={(e) => patch(b.id, { buttonLabel: e.target.value })} />
                    <input className={field} placeholder="/billing or https://" aria-label={c.buttonHref} value={b.buttonHref} dir="ltr" onChange={(e) => patch(b.id, { buttonHref: e.target.value })} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <label className="me-auto flex min-h-11 cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={b.enabled} onChange={(e) => patch(b.id, { enabled: e.target.checked })} className="h-4 w-4 accent-[hsl(var(--primary))]" data-testid={`checkbox-banner-enabled-${i}`} />{c.enabled}
                  </label>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={c.moveUp} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-hover disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === banners.length - 1} aria-label={c.moveDown} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-hover disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setBanners((cur) => cur.filter((x) => x.id !== b.id))} aria-label={c.delete} className="flex h-11 w-11 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {error && <p role="alert" className="mt-3 text-sm text-red-500">{error}</p>}
      <div className="mt-4 flex justify-end"><PillButton variant="gold" onClick={() => void save()} disabled={busy} testId="button-save-banners">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{c.saveBanners}</PillButton></div>
    </section>
  );
}
