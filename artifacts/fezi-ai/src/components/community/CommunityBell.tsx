import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { AtSign, Bell, BellRing, CheckCheck, Heart, Mail, MessageCircle, Newspaper, UserPlus, X } from 'lucide-react';
import {
  formatRelative, isInternalHref, safeHref, useCommunityApi, useCommunityCopy, useCommunityViewer, usePolling, type CommunityNotification,
} from '../../lib/community';
import { cn } from '../../lib/utils';

const ICONS = { like: Heart, reply: MessageCircle, follow: UserPlus, message: Mail, news: Newspaper } as const;
const prefKey = (uid: string) => `fezi-community-browser-alerts:${uid}`;

type NotifResult = { notifications: CommunityNotification[]; unreadCount: number };
// Shared across Bell instances (Shell mounts desktop + mobile) so polls are deduped.
let shared: { key: string; at: number; p: Promise<NotifResult> } | null = null;

type Perm = 'unsupported' | NotificationPermission;
function currentPermission(): Perm {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

/** Header bell: unread badge (99+), notifications panel, opt-in browser alerts while the app is open. */
export function CommunityBell({ className }: { className?: string }) {
  const { c, lang } = useCommunityCopy();
  const api = useCommunityApi();
  const viewer = useCommunityViewer();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<CommunityNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [perm, setPerm] = useState<Perm>(currentPermission);
  const [alerts, setAlerts] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const wrap = useRef<HTMLDivElement>(null);
  const uid = viewer.userId;

  useEffect(() => {
    seen.current = null; setItems([]); setUnread(0); setError('');
    setAlerts(!!uid && currentPermission() === 'granted' && localStorage.getItem(prefKey(uid)) === '1');
  }, [uid]);

  const fetchNow = useCallback(async (showLoading = false) => {
    if (!uid) return;
    if (showLoading) setLoading(true);
    try {
      if (!shared || shared.key !== uid || Date.now() - shared.at > 5000) {
        shared = { key: uid, at: Date.now(), p: api<NotifResult>('/community/notifications') };
        shared.p.catch(() => { shared = null; });
      }
      const res = await shared.p;
      setItems(res.notifications); setUnread(res.unreadCount); setError('');
      let pushActive = false;
      try {
        const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
        pushActive = !!(reg && 'pushManager' in reg && await reg.pushManager.getSubscription());
      } catch { /* push unavailable */ }
      if (!pushActive && seen.current && alertsRef.current && currentPermission() === 'granted' && document.visibilityState !== 'visible') {
        res.notifications.filter((n) => !n.read && !seen.current!.has(n.id)).slice(0, 3).forEach((n) => {
          try {
            const note = new Notification('Persian Dark Horse', { body: n.text, tag: n.id });
            note.onclick = () => { window.focus(); const h = safeHref(n.href); if (h && isInternalHref(h)) navigate(h); };
          } catch { /* some browsers require service workers */ }
        });
      }
      seen.current = new Set(res.notifications.map((n) => n.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : c.errorLoad);
    } finally { setLoading(false); }
  }, [api, uid, c.errorLoad, navigate]);

  useEffect(() => { void fetchNow(); }, [fetchNow]);
  usePolling(() => void fetchNow(), 30000, !!uid);
  // Also poll while hidden when browser alerts are on, so alerts can fire.
  useEffect(() => {
    if (!alerts || !uid) return;
    const t = window.setInterval(() => { if (document.visibilityState !== 'visible') void fetchNow(); }, 60000);
    return () => window.clearInterval(t);
  }, [alerts, uid, fetchNow]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  if (!uid) return null;

  const markRead = async (ids?: string[]) => {
    const prev = { items, unread };
    setItems((cur) => cur.map((n) => (!ids || ids.includes(n.id) ? { ...n, read: true } : n)));
    setUnread((u) => (ids ? Math.max(0, u - items.filter((n) => ids.includes(n.id) && !n.read).length) : 0));
    shared = null;
    try { await api('/community/notifications/read', { method: 'POST', body: JSON.stringify(ids ? { ids } : {}) }); }
    catch (e) { setItems(prev.items); setUnread(prev.unread); setError(e instanceof Error ? e.message : c.errorLoad); }
  };

  const openItem = (n: CommunityNotification) => {
    if (!n.read) void markRead([n.id]);
    setOpen(false);
    const h = safeHref(n.href);
    if (!h) return;
    if (isInternalHref(h)) navigate(h); else window.open(h, '_blank', 'noopener,noreferrer');
  };

  const toggleAlerts = async () => {
    if (perm === 'unsupported') return;
    if (alerts) { setAlerts(false); localStorage.setItem(prefKey(uid), '0'); return; }
    let p = Notification.permission;
    if (p === 'default') { try { p = await Notification.requestPermission(); } catch { p = 'denied'; } }
    setPerm(p);
    const on = p === 'granted';
    setAlerts(on); localStorage.setItem(prefKey(uid), on ? '1' : '0');
  };

  const badge = unread > 99 ? '99+' : String(unread);
  const alertHint = perm === 'unsupported' ? c.browserUnsupported : perm === 'denied' ? c.browserDenied : alerts ? c.browserOn : '';

  return (
    <div className={cn('relative', className)} ref={wrap}>
      <button type="button" onClick={() => { setOpen((v) => !v); if (!open) void fetchNow(!items.length); }}
        aria-label={unread ? `${c.notifications}, ${badge} ${c.unread}` : c.notifications} aria-expanded={open} aria-haspopup="dialog"
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-primary" data-testid="button-community-bell">
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute end-1 top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground ring-2 ring-background" data-testid="badge-unread">
            {badge}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label={c.notifications}
          className="fade-up fixed inset-x-2 top-16 z-[75] max-h-[75dvh] overflow-hidden rounded-3xl border border-border bg-surface shadow-2xl md:absolute md:inset-x-auto md:end-0 md:top-12 md:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
            <h2 className="font-semibold">{c.notifications}</h2>
            <div className="flex items-center">
              <button type="button" onClick={() => void markRead()} disabled={!unread} className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40" data-testid="button-mark-all-read">
                <CheckCheck className="h-4 w-4" /> {c.markAllRead}
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-hover md:hidden"><X className="h-5 w-5" /></button>
            </div>
          </div>
          <div className="max-h-[52dvh] overflow-y-auto">
            {loading && !items.length ? (
              <div className="space-y-3 p-4" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="pulse-soft h-12 rounded-xl bg-surface-hover" />)}</div>
            ) : error && !items.length ? (
              <div role="alert" className="p-6 text-center text-sm text-red-500">{error}<button type="button" onClick={() => void fetchNow(true)} className="ms-2 underline">{c.retry}</button></div>
            ) : !items.length ? (
              <div className="flex flex-col items-center gap-2 p-8 text-sm text-muted-foreground"><AtSign className="h-6 w-6 text-primary" />{c.noNotifications}</div>
            ) : (
              <ul>
                {items.map((n) => {
                  const Icon = ICONS[n.type] ?? Bell;
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => openItem(n)} className={cn('flex min-h-14 w-full items-start gap-3 px-4 py-3 text-start hover:bg-surface-hover', !n.read && 'bg-primary/[0.06]')} data-testid={`notification-${n.id}`}>
                        <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', n.type === 'like' ? 'bg-rose-500/10 text-rose-500' : 'bg-primary/10 text-primary')}><Icon className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm leading-snug" dir="auto">{n.text}</span>
                          <span className="text-xs text-muted-foreground">{formatRelative(n.createdAt, lang)}</span>
                        </span>
                        {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={c.unread} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><BellRing className="h-4 w-4" />{c.enableBrowser}{alertHint && <em className="not-italic opacity-70">· {alertHint}</em>}</span>
            <button type="button" role="switch" aria-checked={alerts} aria-label={c.enableBrowser} disabled={perm === 'unsupported' || (perm === 'denied' && !alerts)} onClick={() => void toggleAlerts()}
              className="flex h-11 w-14 items-center justify-center disabled:opacity-40" data-testid="switch-browser-alerts">
              <span className={cn('relative h-6 w-11 rounded-full transition-colors', alerts ? 'bg-primary' : 'bg-border')}>
                <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform', alerts ? 'translate-x-[22px]' : 'translate-x-0.5')} />
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunityBell;
