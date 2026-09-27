import { useState } from 'react';
import { ImagePlus, Loader2, RefreshCw, Trash2, X } from 'lucide-react';
import { formatRelative, safeHref, uploadMedia, useCommunityApi, useCommunityCopy, type Media, type NewsStatus, type Post } from '../../../lib/community';
import { PillButton } from '../primitives';
import { useToast } from '../../../hooks/use-toast';
import { cn } from '../../../lib/utils';
import { brandArtwork } from '../../../lib/brand-artwork';

const field = 'min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary';

export function NewsDesk({ news, status, onChanged }: { news: Post[]; status: NewsStatus; onChanged: () => void }) {
  const { c, lang } = useCommunityCopy();
  const api = useCommunityApi();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [media, setMedia] = useState<Media[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);

  const selectArtwork = async (artwork: (typeof brandArtwork)[number]) => {
    if (uploading || busy) return;
    if (replaceIndex === null && media.length >= 5) { setError(c.errTooMany); return; }
    setUploading(true); setError('');
    try {
      const response = await fetch(artwork.url);
      if (!response.ok) throw new Error(lang === 'fa' ? 'بارگذاری تصویر کتابخانه ناموفق بود.' : 'Could not load the library image.');
      const image = new File([await response.blob()], `${artwork.id}.png`, { type: 'image/png' });
      const uploaded = await uploadMedia(api, image, true);
      setMedia((current) => replaceIndex === null
        ? [...current, uploaded]
        : current.map((item, index) => index === replaceIndex ? uploaded : item));
      setReplaceIndex(null);
    } catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); }
    finally { setUploading(false); }
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    if (list.some((f) => !f.type.startsWith('image/') || f.type === 'image/svg+xml')) { setError(c.errType); return; }
    if (media.length + list.length > 5) { setError(c.errTooMany); return; }
    setUploading(true); setError('');
    try { for (const f of list) { const m = await uploadMedia(api, f, true); setMedia((cur) => [...cur, m]); } }
    catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); } finally { setUploading(false); }
  };

  const publish = async () => {
    if (!title.trim() || !text.trim()) { setError(c.errEmpty); return; }
    if (sourceUrl.trim() && !safeHref(sourceUrl.trim())) { setError(c.linkInvalid); return; }
    setBusy(true); setError('');
    try {
      await api('/admin/community/news', { method: 'POST', body: JSON.stringify({ title: title.trim(), text: text.trim(), mediaIds: media.map((m) => m.id), ...(sourceUrl.trim() ? { sourceUrl: sourceUrl.trim() } : {}) }) });
      setTitle(''); setText(''); setSourceUrl(''); setMedia([]); toast({ title: c.published }); onChanged();
    } catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); } finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await api(`/admin/community/posts/${encodeURIComponent(id)}`, { method: 'DELETE' }); onChanged(); }
    catch (e) { toast({ title: e instanceof Error ? e.message : c.errorLoad, variant: 'destructive' }); }
  };

  const sync = async () => {
    setSyncing(true);
    try { const r = await api<{ published: number }>('/admin/community/news/sync', { method: 'POST' }); toast({ title: `${r.published} ${c.published}` }); onChanged(); }
    catch (e) { toast({ title: e instanceof Error ? e.message : c.errorLoad, variant: 'destructive' }); onChanged(); } finally { setSyncing(false); }
  };

  return (
    <section className="rounded-3xl border border-border bg-surface p-4 sm:p-5">
      <h3 className="font-semibold">{c.newsDesk}</h3>
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3 text-sm" data-testid="status-news-sync">
        <span className={cn('h-2.5 w-2.5 rounded-full', status.configured ? (status.error ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-red-500')} aria-hidden="true" />
        <span className="font-medium">{status.configured ? c.configured : c.notConfigured}</span>
        <span className="text-muted-foreground">{c.lastRun}: {status.lastRun ? formatRelative(status.lastRun, lang) : c.never}</span>
        <PillButton variant="outline" className="ms-auto" onClick={() => void sync()} disabled={syncing || !status.configured} testId="button-news-sync"><RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />{c.syncNow}</PillButton>
        {status.error && <p role="alert" className="w-full break-words text-red-500">{status.error}</p>}
      </div>

      <div className="mt-4 grid gap-2">
        <input className={field} placeholder={c.title} aria-label={c.title} value={title} dir="auto" onChange={(e) => setTitle(e.target.value)} data-testid="input-news-title" />
        <textarea className={cn(field, 'py-2')} rows={4} placeholder={c.text} aria-label={c.text} value={text} dir="auto" onChange={(e) => setText(e.target.value)} data-testid="input-news-text" />
        <input className={field} placeholder={`${c.sourceUrl} (https://)`} aria-label={c.sourceUrl} value={sourceUrl} dir="ltr" onChange={(e) => setSourceUrl(e.target.value)} data-testid="input-news-source" />
        <div className="flex flex-wrap gap-2">
          {media.map((m, index) => (
            <div key={m.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-border">
              {safeHref(m.url) && <img src={safeHref(m.url)!} alt="" className="h-full w-full object-cover" />}
              <button type="button" onClick={() => { setMedia((cur) => cur.filter((x) => x.id !== m.id)); setReplaceIndex(null); }} aria-label={c.removeMedia} data-testid={`button-remove-news-media-${m.id}`} disabled={uploading} className="absolute end-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-background/80"><X className="h-3.5 w-3.5" /></button>
              <button type="button" onClick={() => setReplaceIndex(index)} aria-label={lang === 'fa' ? `جایگزینی تصویر ${index + 1} از کتابخانه` : `Replace image ${index + 1} from library`} aria-pressed={replaceIndex === index} data-testid={`button-replace-news-media-${m.id}`} disabled={uploading} className="absolute inset-x-0 bottom-0 bg-background/90 py-1 text-[11px] font-semibold text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{lang === 'fa' ? 'جایگزینی' : 'Replace'}</button>
            </div>
          ))}
          <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border border-dashed border-border text-muted-foreground focus-within:outline-2 focus-within:outline-ring hover:border-primary hover:text-primary" aria-label={`${c.upload} ${c.image}`}>
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} data-testid="input-news-image" />
          </label>
        </div>
        <div className="rounded-2xl border border-border p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{lang === 'fa' ? 'کتابخانه تصاویر پیش‌فرض' : 'Default image library'}</p>
            {replaceIndex !== null && <button type="button" onClick={() => setReplaceIndex(null)} data-testid="button-cancel-news-replace" className="min-h-11 rounded-lg px-3 text-sm text-primary hover:bg-primary/10">{lang === 'fa' ? 'لغو جایگزینی' : 'Cancel replace'}</button>}
          </div>
          <p className="mb-3 text-xs text-muted-foreground" role="status" data-testid="status-news-library">
            {replaceIndex === null
              ? (lang === 'fa' ? 'برای افزودن به پست، یک تصویر انتخاب کنید (حداکثر ۵ تصویر).' : 'Select an image to add to the post (up to 5 images).')
              : (lang === 'fa' ? `یک تصویر برای جایگزینی تصویر ${replaceIndex + 1} انتخاب کنید.` : `Select an image to replace image ${replaceIndex + 1}.`)}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {brandArtwork.map((artwork, index) => (
              <button key={artwork.id} type="button" onClick={() => void selectArtwork(artwork)}
                disabled={uploading || busy || (replaceIndex === null && media.length >= 5)}
                aria-label={lang === 'fa' ? `انتخاب تصویر ${index + 1} از ۱۶` : `Select image ${index + 1} of 16`}
                data-testid={`button-news-artwork-${artwork.id}`}
                className="aspect-[3/2] overflow-hidden rounded-lg border border-border bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 hover:border-primary">
                <img src={artwork.url} alt="" loading="lazy" className="h-full w-full object-contain" />
              </button>
            ))}
          </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end"><PillButton variant="gold" onClick={() => void publish()} disabled={busy || uploading} testId="button-publish-news">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{c.publish}</PillButton></div>
      </div>

      {news.length > 0 ? (
        <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
          {news.map((n) => (
            <li key={n.id} className="flex items-center gap-3 p-3" data-testid={`row-news-${n.id}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" dir="auto">{n.title || n.text.slice(0, 80)}</p>
                <p className="text-xs text-muted-foreground">{formatRelative(n.createdAt, lang)}</p>
              </div>
              <button type="button" onClick={() => void remove(n.id)} aria-label={c.delete} className="flex h-11 w-11 items-center justify-center rounded-full text-red-500 hover:bg-red-500/10" data-testid={`button-delete-news-${n.id}`}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-center text-sm text-muted-foreground">{c.emptyNews}</p>}
    </section>
  );
}
