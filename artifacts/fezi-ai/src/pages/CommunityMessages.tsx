import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { Loader2, MailWarning, MessagesSquare, SendHorizontal } from 'lucide-react';
import { requestGuestAccount } from '../lib/auth-gate';
import {
  formatRelative, MAX_MESSAGE_TEXT, useCommunityApi, useCommunityCopy, useCommunityViewer, usePolling, type Conversation, type DirectMessage, type Profile,
} from '../lib/community';
import { CommunityHeader } from '../components/community/CommunityHeader';
import { CommunityAvatar, EmptyState, ErrorState, PillButton, ProBadge } from '../components/community/primitives';
import { cn } from '../lib/utils';

function Inbox({ activeId, conversations, loading, error, onRetry }: { activeId?: string; conversations: Conversation[]; loading: boolean; error: string; onRetry: () => void }) {
  const { c, lang } = useCommunityCopy();
  if (loading && !conversations.length) return <div className="space-y-2 p-3" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="pulse-soft h-16 rounded-2xl bg-surface-hover" />)}</div>;
  if (error && !conversations.length) return <ErrorState message={`${c.errorLoad} ${error}`} onRetry={onRetry} />;
  if (!conversations.length) return <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={c.noConversations} />;
  return (
    <ul className="p-2">
      {conversations.map((cv) => (
        <li key={cv.peer.id}>
          <Link href={`/community/messages/${encodeURIComponent(cv.peer.id)}`} aria-current={activeId === cv.peer.id ? 'page' : undefined}
            className={cn('flex min-h-16 items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-surface-hover', activeId === cv.peer.id && 'bg-primary/10')} data-testid={`link-conversation-${cv.peer.id}`}>
            <CommunityAvatar profile={cv.peer} size={44} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className={cn('truncate text-sm', cv.unreadCount ? 'font-bold' : 'font-medium')}>{cv.peer.name}</span>
                <ProBadge verified={cv.peer.verified} />
                <span className="ms-auto shrink-0 text-xs text-muted-foreground">{formatRelative(cv.updatedAt, lang)}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className={cn('truncate text-sm', cv.unreadCount ? 'text-foreground' : 'text-muted-foreground')} dir="auto">{cv.lastMessage}</span>
                {cv.unreadCount > 0 && <span className="ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{cv.unreadCount > 99 ? '99+' : cv.unreadCount}</span>}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Chat({ peerId, peerHint, onActivity }: { peerId: string; peerHint?: Profile; onActivity: () => void }) {
  const { c, lang } = useCommunityCopy();
  const api = useCommunityApi();
  const viewer = useCommunityViewer();
  const [peer, setPeer] = useState<Profile | null>(peerHint ?? null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [earlierError, setEarlierError] = useState('');
  const earlierInFlight = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const activityRef = useRef(onActivity);
  activityRef.current = onActivity;

  const merge = (incoming: DirectMessage[], cur: DirectMessage[]) => {
    const map = new Map(cur.map((m) => [m.id, m]));
    incoming.forEach((m) => map.set(m.id, m));
    return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [msgs, prof] = await Promise.all([
        api<{ messages: DirectMessage[]; nextCursor: string | null }>(`/community/messages/${encodeURIComponent(peerId)}`),
        api<{ profile: Profile }>(`/community/profiles/${encodeURIComponent(peerId)}`).catch(() => null),
      ]);
      setMessages(merge(msgs.messages, [])); setCursor(msgs.nextCursor);
      if (prof) setPeer(prof.profile);
      stick.current = true; activityRef.current();
    } catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); } finally { setLoading(false); }
  }, [api, peerId, c.errorLoad]);
  useEffect(() => { setMessages([]); void load(); }, [load]);

  usePolling(async () => {
    try {
      const res = await api<{ messages: DirectMessage[]; nextCursor: string | null }>(`/community/messages/${encodeURIComponent(peerId)}`);
      setMessages((cur) => {
        const next = merge(res.messages, cur);
        if (next.length !== cur.length) { const el = scroller.current; stick.current = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120; activityRef.current(); }
        return next;
      });
    } catch { /* keep current thread */ }
  }, 6000, !loading && !error);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const earlier = async () => {
    if (!cursor || earlierInFlight.current) return;
    earlierInFlight.current = true; setLoadingEarlier(true); setEarlierError('');
    const el = scroller.current; const prevH = el?.scrollHeight ?? 0; const prevTop = el?.scrollTop ?? 0;
    try {
      const res = await api<{ messages: DirectMessage[]; nextCursor: string | null }>(`/community/messages/${encodeURIComponent(peerId)}?cursor=${encodeURIComponent(cursor)}`);
      stick.current = false;
      setMessages((cur) => merge(res.messages, cur)); setCursor(res.nextCursor);
      requestAnimationFrame(() => { if (el) el.scrollTop = prevTop + el.scrollHeight - prevH; });
    } catch (e) { setEarlierError(e instanceof Error ? e.message : c.errorLoad); }
    finally { earlierInFlight.current = false; setLoadingEarlier(false); }
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    if (body.length > MAX_MESSAGE_TEXT) { setSendError(c.errTooLong); return; }
    setSending(true); setSendError('');
    try {
      const res = await api<{ message: DirectMessage }>(`/community/messages/${encodeURIComponent(peerId)}`, { method: 'POST', body: JSON.stringify({ text: body }) });
      stick.current = true; setMessages((cur) => merge([res.message], cur)); setText(''); activityRef.current();
    } catch (e) { setSendError(e instanceof Error ? e.message : c.errorLoad); } finally { setSending(false); }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {peer && (
        <Link href={`/community/profile/${encodeURIComponent(peer.id)}`} className="flex min-h-14 items-center gap-3 border-b border-border px-4 py-2 hover:bg-surface-hover/50" data-testid="link-chat-peer">
          <CommunityAvatar profile={peer} size={36} />
          <span className="font-semibold">{peer.name}</span><ProBadge verified={peer.verified} />
        </Link>
      )}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto px-3 py-4" aria-live="polite" onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120; if (el.scrollTop < 80 && cursor && !loading && !earlierInFlight.current) void earlier(); }}>
        {cursor && <div className="mb-3 flex justify-center"><PillButton variant="outline" onClick={() => void earlier()} disabled={loadingEarlier} testId="button-earlier">{loadingEarlier ? <Loader2 className="h-4 w-4 animate-spin" /> : '↑'} {loadingEarlier ? c.loading : c.earlier}</PillButton></div>}
        {earlierError && <p role="alert" className="mb-3 text-center text-sm text-red-500">{earlierError}</p>}
        {loading ? (
          <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className={cn('pulse-soft h-10 w-2/3 rounded-2xl bg-surface-hover', i % 2 && 'ms-auto')} />)}</div>
        ) : error ? (
          <ErrorState message={`${c.errorLoad} ${error}`} onRetry={() => void load()} />
        ) : !messages.length ? (
          <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={c.noMessages} />
        ) : (
          <ol className="space-y-1.5">
            {messages.map((m, i) => {
              const mine = m.senderId === viewer.userId;
              const showTime = i === messages.length - 1 || messages[i + 1].senderId !== m.senderId;
              return (
                <li key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')} data-testid={`message-${m.id}`}>
                  <p dir="auto" className={cn('max-w-[80%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-[15px] leading-snug', mine ? 'rounded-ee-md bg-primary text-primary-foreground' : 'rounded-es-md border border-border bg-surface')}>{m.text}</p>
                  {showTime && <time dateTime={m.createdAt} className="mt-1 px-2 text-[11px] text-muted-foreground">{formatRelative(m.createdAt, lang)}</time>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <div className="border-t border-border bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {!viewer.emailVerified ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><MailWarning className="h-4 w-4 text-primary" />{c.verifyEmail}</p>
        ) : peer?.isBlocked ? (
          <p className="text-sm text-muted-foreground">{c.blockedProfile}</p>
        ) : (
          <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); void send(); }}>
            <label className="sr-only" htmlFor="dm-input">{c.typeMessage}</label>
            <textarea id="dm-input" value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder={c.typeMessage} dir="auto"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
              className="max-h-36 min-h-11 flex-1 resize-none rounded-3xl border border-border bg-surface px-4 py-2.5 text-[15px] outline-none focus:border-primary" data-testid="input-message" />
            <button type="submit" disabled={!text.trim() || sending} aria-label={c.send} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" data-testid="button-send-message">
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5 rtl:-scale-x-100" />}
            </button>
          </form>
        )}
        {sendError && <p role="alert" className="mt-2 text-sm text-red-500">{sendError}</p>}
      </div>
    </div>
  );
}

export default function CommunityMessages() {
  const [, params] = useRoute('/community/messages/:userId');
  const peerId = params?.userId ? decodeURIComponent(params.userId) : undefined;
  const { c, isRtl } = useCommunityCopy();
  const api = useCommunityApi();
  const viewer = useCommunityViewer();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!viewer.isSignedIn) return;
    try {
      const res = await api<{ conversations: Conversation[] }>('/community/conversations');
      setConversations(res.conversations); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); } finally { setLoading(false); }
  }, [api, viewer.isSignedIn, c.errorLoad]);
  useEffect(() => { setConversations([]); setLoading(true); void load(); }, [load, viewer.userId]);
  usePolling(() => void load(), 20000, viewer.isSignedIn);

  const hint = conversations.find((cv) => cv.peer.id === peerId)?.peer;

  if (viewer.isLoaded && !viewer.isSignedIn) {
    return (
      <div dir={isRtl ? 'rtl' : 'ltr'} className="mx-auto min-h-[100dvh] max-w-2xl">
        <CommunityHeader title={c.messages} back="/community" />
        <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={c.signInMessages}><PillButton variant="gold" onClick={() => requestGuestAccount('community')}>{c.signIn}</PillButton></EmptyState>
      </div>
    );
  }

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="mx-auto flex h-[100dvh] w-full max-w-5xl flex-col bg-background md:border-x md:border-border/60">
      <CommunityHeader title={c.messages} back={peerId ? '/community/messages' : '/community'} />
      <div className="flex min-h-0 flex-1 pb-[var(--fezi-mobile-tabs,0px)] md:pb-0">
        <aside className={cn('min-h-0 w-full overflow-y-auto md:block md:w-80 md:shrink-0 md:border-e md:border-border', peerId ? 'hidden' : 'block')} aria-label={c.inbox}>
          <Inbox activeId={peerId} conversations={conversations} loading={loading} error={error} onRetry={() => void load()} />
        </aside>
        <section className={cn('min-h-0 flex-1', peerId ? 'block' : 'hidden md:block')}>
          {peerId ? <Chat key={peerId} peerId={peerId} peerHint={hint} onActivity={() => void load()} /> : (
            <div className="flex h-full items-center justify-center"><EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={c.selectConversation} /></div>
          )}
        </section>
      </div>
    </div>
  );
}
