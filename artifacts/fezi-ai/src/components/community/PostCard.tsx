import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@clerk/react';
import { Ban, ExternalLink, Flag, Heart, Link2, Loader2, MessageCircle, MoreHorizontal, Newspaper, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { requestGuestAccount } from '../../lib/auth-gate';
import {
  formatCount, formatRelative, linkLabel, MAX_POST_TEXT, safeHref, useCommunityApi, useCommunityCopy, useCommunityViewer, type Post,
} from '../../lib/community';
import { CommunityAvatar, PillButton, ProBadge, Sheet } from './primitives';
import { MediaGrid } from './MediaGrid';
import { ReportSheet } from './ReportSheet';
import { useToast } from '../../hooks/use-toast';
import { cn } from '../../lib/utils';
import { unlockStudioPrompt, PromptStudioActionError } from '../../lib/prompt-studio-actions';
import { handoffToPictureStudio } from '../../lib/picture-studio-handoff';

const URL_RE = /(https?:\/\/[^\s<>"']+)/g;

/** Plain-text renderer: only http(s) URLs become links; everything else is escaped text. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(URL_RE);
  return (
    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed" dir="auto">
      {parts.map((part, i) => {
        if (i % 2 === 1) {
          const href = safeHref(part);
          if (href) return <a key={i} href={href} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-primary underline-offset-2 hover:underline">{linkLabel(href)}</a>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

function MenuItem({ icon, label, onClick, danger, testId }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean; testId: string }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} data-testid={testId}
      className={cn('flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none', danger && 'text-red-500')}>
      {icon}{label}
    </button>
  );
}

function ConfirmSheet({ open, onClose, title, body, action, onConfirm, busy, testId }: { open: boolean; onClose: () => void; title: string; body: string; action: string; onConfirm: () => void; busy: boolean; testId: string }) {
  const { c } = useCommunityCopy();
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted-foreground">{body}</p>
      <div className="mt-5 flex justify-end gap-2">
        <PillButton variant="outline" onClick={onClose}>{c.cancel}</PillButton>
        <PillButton variant="danger" onClick={onConfirm} disabled={busy} testId={testId}>{action}</PillButton>
      </div>
    </Sheet>
  );
}

export function PostCard({ post, onChange, onDelete, onBlocked, detail }: {
  post: Post; onChange: (post: Post) => void; onDelete: (id: string) => void; onBlocked?: (userId: string) => void; detail?: boolean;
}) {
  const { c, lang } = useCommunityCopy();
  const api = useCommunityApi();
  const viewer = useCommunityViewer();
  const { getToken } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.text);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [report, setReport] = useState(false);
  const [busy, setBusy] = useState(false);
  const [usingPrompt, setUsingPrompt] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const own = viewer.userId === post.author.id;
  const isNews = post.kind === 'news';
  const source = safeHref(post.sourceUrl);
  const promptId = post.kind === 'prompt' && source ? /^\/prompt-studio\/([a-zA-Z0-9_-]{1,100})$/.exec(source)?.[1] : undefined;

  useEffect(() => {
    if (!menu) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    menuRef.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [menu]);

  const fail = (e: unknown) => toast({ title: e instanceof Error ? e.message : c.errorLoad, variant: 'destructive' });

  const toggleLike = async () => {
    if (!viewer.isSignedIn) { requestGuestAccount('community'); return; }
    const next = !post.liked;
    onChange({ ...post, liked: next, likeCount: Math.max(0, post.likeCount + (next ? 1 : -1)) });
    try {
      const res = await api<{ liked: boolean; likeCount: number }>(`/community/posts/${encodeURIComponent(post.id)}/like`, { method: 'PUT', body: JSON.stringify({ liked: next }) });
      onChange({ ...post, liked: res.liked, likeCount: res.likeCount });
    } catch (e) { onChange(post); fail(e); }
  };

  const saveEdit = async () => {
    const text = draft.trim();
    if (!text && !post.media.length) return;
    setBusy(true);
    try {
      const res = await api<{ post: Post }>(`/community/posts/${encodeURIComponent(post.id)}`, { method: 'PATCH', body: JSON.stringify({ text }) });
      onChange(res.post); setEditing(false);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api(`/community/posts/${encodeURIComponent(post.id)}`, { method: 'DELETE' });
      setConfirmDelete(false); onDelete(post.id); toast({ title: c.deleted });
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const block = async () => {
    setBusy(true);
    try {
      await api(`/community/profiles/${encodeURIComponent(post.author.id)}/block`, { method: 'PUT', body: JSON.stringify({ blocked: true }) });
      setConfirmBlock(false); toast({ title: c.blocked }); onBlocked?.(post.author.id);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const copyLink = async () => {
    setMenu(false);
    try { await navigator.clipboard.writeText(`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/community/post/${encodeURIComponent(post.id)}`); toast({ title: c.copied }); } catch { /* clipboard unavailable */ }
  };

  const usePrompt = async () => {
    if (!promptId || usingPrompt) return;
    if (!viewer.isSignedIn) { requestGuestAccount(lang === 'fa' ? 'برای استفاده از پرامپت وارد حساب شوید.' : 'Sign in to use this prompt.'); return; }
    setUsingPrompt(true);
    try {
      const unlocked = await unlockStudioPrompt(promptId, 'use', getToken);
      if (!unlocked.promptText) throw new Error('The prompt is empty.');
      await handoffToPictureStudio(promptId, post.title || 'Gallery prompt', unlocked.promptText, post.media.find(m => m.kind === 'image')?.url);
      navigate('/studio/image');
    } catch (e) {
      toast({
        title: e instanceof PromptStudioActionError && e.status === 402
          ? (lang === 'fa' ? 'اعتبار کافی نیست یا سهمیهٔ رایگان گالری به پایان رسیده است.' : 'Not enough credits or your free gallery allowance has been reached.')
          : (lang === 'fa' ? 'باز کردن پرامپت ناموفق بود. دوباره تلاش کنید.' : 'Could not unlock the prompt. Please try again.'),
        variant: 'destructive',
      });
    } finally { setUsingPrompt(false); }
  };

  const openThread = () => { if (!detail) navigate(`/community/post/${encodeURIComponent(post.id)}`); };
  const profileHref = `/community/profile/${encodeURIComponent(post.author.id)}`;
  const showMenu = !isNews || own || viewer.isSignedIn;

  return (
    <article
      className={cn('relative flex gap-3 border-b border-border/70 px-4 py-4 transition-colors', !detail && 'cursor-pointer hover:bg-surface-hover/40', isNews && 'bg-primary/[0.03]')}
       onClick={(e) => { if ((e.target as HTMLElement).closest('a,button,video,img,textarea,input,[role=dialog]')) return; openThread(); }}
      data-testid={`card-post-${post.id}`}
    >
      <Link href={profileHref} className="shrink-0 self-start rounded-full focus-visible:outline-2 focus-visible:outline-ring" aria-label={post.author.name} data-testid={`link-author-avatar-${post.id}`}>
        <CommunityAvatar profile={post.author} size={detail ? 48 : 42} />
      </Link>
      <div className="min-w-0 flex-1">
        <header className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
            <Link href={profileHref} className="truncate font-semibold hover:underline" data-testid={`link-author-${post.id}`}>{post.author.name}</Link>
            <ProBadge verified={post.author.verified} />
            {isNews && <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary"><Newspaper className="h-3 w-3" />{c.official}</span>}
            <span className="text-muted-foreground" aria-hidden="true">·</span>
            <time dateTime={post.createdAt} className="text-muted-foreground" title={new Date(post.createdAt).toLocaleString()}>{formatRelative(post.createdAt, lang)}</time>
          </div>
          {showMenu && (
            <div className="relative -me-2 -mt-2" ref={menuRef}>
              <button type="button" aria-label={c.more} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary" data-testid={`button-post-menu-${post.id}`}>
                <MoreHorizontal className="h-5 w-5" />
              </button>
              {menu && (
                <div role="menu" className="fade-up absolute end-0 top-11 z-30 w-52 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl">
                  <MenuItem icon={<Link2 className="h-4 w-4" />} label={c.share} onClick={() => void copyLink()} testId={`menu-copy-${post.id}`} />
                  {own ? (
                    <>
                      <MenuItem icon={<Pencil className="h-4 w-4" />} label={c.edit} onClick={() => { setDraft(post.text); setEditing(true); setMenu(false); }} testId={`menu-edit-${post.id}`} />
                      <MenuItem icon={<Trash2 className="h-4 w-4" />} label={c.delete} danger onClick={() => { setConfirmDelete(true); setMenu(false); }} testId={`menu-delete-${post.id}`} />
                    </>
                  ) : viewer.isSignedIn ? (
                    <>
                      <MenuItem icon={<Flag className="h-4 w-4" />} label={c.report} onClick={() => { setReport(true); setMenu(false); }} testId={`menu-report-${post.id}`} />
                      {!isNews && <MenuItem icon={<Ban className="h-4 w-4" />} label={c.block} danger onClick={() => { setConfirmBlock(true); setMenu(false); }} testId={`menu-block-${post.id}`} />}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </header>

        {post.title && <h3 className={cn('mt-1 font-semibold leading-snug', detail ? 'text-xl' : 'text-base')} dir="auto">{post.title}</h3>}

        {editing ? (
          <div className="mt-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} autoFocus aria-label={c.edit} dir="auto"
              className="w-full rounded-xl border border-border bg-background p-3 text-[15px] outline-none focus:border-primary" data-testid={`input-edit-${post.id}`} />
            {draft.length > MAX_POST_TEXT && <p className="text-sm text-red-500">{c.errTooLong}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <PillButton variant="outline" onClick={() => setEditing(false)}>{c.cancel}</PillButton>
              <PillButton variant="gold" onClick={() => void saveEdit()} disabled={busy || draft.length > MAX_POST_TEXT} testId={`button-save-edit-${post.id}`}>{c.save}</PillButton>
            </div>
          </div>
        ) : post.text ? (
          <div className="mt-1"><RichText text={post.text} /></div>
        ) : null}

        {promptId && source ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={source} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium hover:border-primary/50 hover:text-primary" data-testid={`link-gallery-prompt-${post.id}`}>
              <ExternalLink className="h-4 w-4" />{lang === 'fa' ? 'مشاهدهٔ پرامپت' : 'View prompt'}
            </Link>
            <button type="button" onClick={() => void usePrompt()} disabled={usingPrompt}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              data-testid={`button-use-gallery-prompt-${post.id}`}>
              {usingPrompt ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {lang === 'fa' ? 'استفاده در استودیوی تصویر' : 'Use in Picture Studio'}
            </button>
          </div>
        ) : null}

        <MediaGrid media={post.media} compact={!detail && post.kind !== 'prompt'} contain={post.kind === 'prompt'} />

        {!promptId && source && (
          <a href={source} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-border px-3 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary" data-testid={`link-source-${post.id}`}>
            <ExternalLink className="h-4 w-4 shrink-0" /> {c.readSource}: <span className="truncate">{linkLabel(source).split('/')[0]}</span>
          </a>
        )}

        <footer className="-ms-2.5 mt-2 flex items-center gap-1 text-muted-foreground">
          <button type="button" onClick={openThread} aria-label={`${c.replies} ${post.replyCount}`}
            className="flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-sm hover:bg-primary/10 hover:text-primary" data-testid={`button-replies-${post.id}`}>
            <MessageCircle className="h-[18px] w-[18px]" />
            {post.replyCount > 0 && <span className="tabular-nums">{formatCount(post.replyCount, lang)}</span>}
          </button>
          <button type="button" onClick={() => void toggleLike()} aria-pressed={post.liked} aria-label={post.liked ? c.unlike : c.like}
            className={cn('flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-sm hover:bg-rose-500/10 hover:text-rose-500', post.liked && 'text-rose-500')} data-testid={`button-like-${post.id}`}>
            <Heart className={cn('h-[18px] w-[18px] transition-transform', post.liked && 'scale-110 fill-current')} />
            {post.likeCount > 0 && <span className="tabular-nums">{formatCount(post.likeCount, lang)}</span>}
          </button>
        </footer>
      </div>

      <ConfirmSheet open={confirmDelete} onClose={() => setConfirmDelete(false)} title={c.delete} body={c.deleteConfirm} action={c.delete} onConfirm={() => void remove()} busy={busy} testId={`button-confirm-delete-${post.id}`} />
      <ConfirmSheet open={confirmBlock} onClose={() => setConfirmBlock(false)} title={`${c.block} ${post.author.name}`} body={c.blockConfirm} action={c.block} onConfirm={() => void block()} busy={busy} testId={`button-confirm-block-${post.id}`} />
      <ReportSheet open={report} onClose={() => setReport(false)} postId={post.id} />
    </article>
  );
}
