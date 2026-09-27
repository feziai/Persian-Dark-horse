import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, MailWarning, X } from 'lucide-react';
import { useUser } from '@clerk/react';
import { requestGuestAccount } from '../../lib/auth-gate';
import {
  MAX_POST_TEXT, uploadMedia, useCommunityApi, useCommunityCopy, useCommunityViewer, validateMediaFiles, type Post,
} from '../../lib/community';
import { CommunityAvatar, PillButton } from './primitives';
import { cn } from '../../lib/utils';
import { accountAvatarSource } from '../../lib/avatar-options';

type Pending = { file: File; preview: string };

export function Composer({ parentId, onPosted, autoFocus }: { parentId?: string; onPosted: (post: Post) => void; autoFocus?: boolean }) {
  const { c } = useCommunityCopy();
  const api = useCommunityApi();
  const viewer = useCommunityViewer();
  const { user } = useUser();
  const [text, setText] = useState('');
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  if (!viewer.isSignedIn) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
        <p className="text-sm text-muted-foreground">{c.signInToPost}</p>
        <PillButton variant="gold" onClick={() => requestGuestAccount('community')} testId="button-community-signin">{c.signIn}</PillButton>
      </div>
    );
  }
  if (!viewer.emailVerified) {
    return (
      <div className="flex items-start gap-3 border-b border-border px-4 py-4 text-sm text-muted-foreground" data-testid="status-verify-email">
        <MailWarning className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p>{c.verifyEmail}</p>
      </div>
    );
  }

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const err = validateMediaFiles([], pending.map((p) => p.file), incoming, c);
    if (err) { setError(err); return; }
    setError('');
    setPending((cur) => [...cur, ...incoming.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const remove = (i: number) => setPending((cur) => {
    URL.revokeObjectURL(cur[i].preview);
    return cur.filter((_, j) => j !== i);
  });

  const submit = async () => {
    const body = text.trim();
    if (!body && !pending.length) { setError(c.errEmpty); return; }
    if (body.length > MAX_POST_TEXT) { setError(c.errTooLong); return; }
    setBusy(true); setError('');
    try {
      const mediaIds: string[] = [];
      for (const p of pending) mediaIds.push((await uploadMedia(api, p.file)).id);
      const res = await api<{ post: Post }>('/community/posts', { method: 'POST', body: JSON.stringify({ text: body, mediaIds, ...(parentId ? { parentId } : {}) }) });
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setText(''); setPending([]);
      onPosted(res.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : c.errorLoad);
    } finally {
      setBusy(false);
    }
  };

  const over = text.length > MAX_POST_TEXT;
  return (
    <div className="flex gap-3 border-b border-border px-4 py-4">
      <CommunityAvatar profile={{ name: user?.fullName || user?.username || '', avatarUrl: accountAvatarSource('account-photo', user) ?? null }} />
      <div className="min-w-0 flex-1">
        <label className="sr-only" htmlFor={`composer-${parentId ?? 'root'}`}>{parentId ? c.replyPlaceholder : c.composerPlaceholder}</label>
        <textarea
          id={`composer-${parentId ?? 'root'}`}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(); }}
          placeholder={parentId ? c.replyPlaceholder : c.composerPlaceholder}
          rows={parentId ? 2 : 3}
          className="w-full resize-none bg-transparent py-2 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground/70"
          data-testid="input-composer"
        />
        {pending.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {pending.map((p, i) => (
              <div key={p.preview} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-surface-hover">
                {p.file.type.startsWith('video/') ? <video src={p.preview} muted className="h-full w-full object-cover" /> : <img src={p.preview} alt="" className="h-full w-full object-cover" />}
                <button type="button" onClick={() => remove(i)} aria-label={c.removeMedia} className="absolute end-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-background/80" data-testid={`button-remove-media-${i}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
        {error && <p role="alert" className="mb-2 text-sm text-red-500" data-testid="text-composer-error">{error}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
          <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} aria-label={c.addMedia} title={c.addMedia}
            className="flex h-11 w-11 items-center justify-center rounded-full text-primary hover:bg-primary/10 disabled:opacity-50" data-testid="button-add-media">
            <ImagePlus className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-3">
            {text.length > MAX_POST_TEXT * 0.85 && <span className={cn('text-xs tabular-nums', over ? 'text-red-500' : 'text-muted-foreground')}>{MAX_POST_TEXT - text.length}</span>}
            <PillButton variant="gold" onClick={() => void submit()} disabled={busy || over || (!text.trim() && !pending.length)} testId="button-submit-post">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? c.posting : parentId ? c.reply : c.post}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
}
