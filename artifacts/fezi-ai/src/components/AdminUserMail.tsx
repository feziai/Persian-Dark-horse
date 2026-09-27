import { useEffect, useState, type FormEvent } from 'react';
import { LoaderCircle, Mail, Search } from 'lucide-react';
import { Button, Card } from './ui-parts';

type MailUser = { id: string; name: string; email: string | null; verified: boolean };

export function AdminUserMail({ isRtl }: { isRtl: boolean }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<MailUser[]>([]);
  const [selected, setSelected] = useState<MailUser | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/admin/mail/users?query=${encodeURIComponent(query.trim())}`, {
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to load users');
        const data = await response.json() as { users: MailUser[] };
        setUsers(data.users);
      } catch {
        if (!controller.signal.aborted) setError(isRtl ? 'بارگذاری کاربران ناموفق بود.' : 'Could not load users.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, isRtl]);

  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected || !selected.verified || sending) return;
    if (!window.confirm(isRtl ? `ایمیل به ${selected.email} ارسال شود؟` : `Send this email to ${selected.email}?`)) return;
    setSending(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch('/api/admin/mail/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selected.id, subject, message }),
      });
      const data = await response.json() as { sent?: boolean; error?: string };
      if (!response.ok || !data.sent) throw new Error(data.error || 'Email was not accepted.');
      setNotice(isRtl ? 'ایمیل توسط سرویس ارسال پذیرفته شد.' : 'Email accepted by the delivery service.');
      setSubject('');
      setMessage('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Email could not be sent.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <div className="mb-4 flex items-center gap-2">
        <Mail size={19} className="text-primary" />
        <h2 className="font-semibold">{isRtl ? 'ارسال ایمیل به کاربران' : 'Email a user'}</h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        {isRtl ? 'از طرف Support@persiandarkhorse.com به یک کاربر دارای ایمیل تأییدشده پیام بفرستید.' : 'Send from Support@persiandarkhorse.com to one user with a verified email address.'}
      </p>
      <form onSubmit={(event) => { void send(event); }} className="space-y-4">
        <div>
          <label htmlFor="mail-user-search" className="mb-2 block text-sm font-medium">{isRtl ? 'انتخاب گیرنده' : 'Select recipient'}</label>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute start-3 top-3.5 text-muted-foreground" />
            <input id="mail-user-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={100}
              placeholder={isRtl ? 'جست‌وجوی نام یا ایمیل کاربر' : 'Search name or email'}
              className="w-full rounded-xl border border-border bg-background py-3 pe-3 ps-10 text-sm outline-none focus:border-primary" />
          </div>
          <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-border" role="group" aria-label={isRtl ? 'کاربران' : 'Users'}>
            {loading && <p className="p-3 text-sm text-muted-foreground">{isRtl ? 'در حال بارگذاری…' : 'Loading…'}</p>}
            {!loading && users.length === 0 && <p className="p-3 text-sm text-muted-foreground">{isRtl ? 'کاربری پیدا نشد.' : 'No users found.'}</p>}
            {!loading && users.map((user) => (
              <button key={user.id} type="button" disabled={!user.verified || !user.email}
                onClick={() => { setSelected(user); setNotice(''); }}
                className={`block w-full border-b border-border px-3 py-2 text-start text-sm last:border-0 disabled:cursor-not-allowed disabled:opacity-50 ${selected?.id === user.id ? 'bg-primary/15 text-primary' : 'hover:bg-primary/5'}`}
                aria-pressed={selected?.id === user.id}>
                <span className="block font-medium">{user.name || user.email || user.id}</span>
                <span className="block break-all text-xs text-muted-foreground" dir="ltr">{user.email || '—'}{!user.verified && ` · ${isRtl ? 'تأییدنشده' : 'Unverified'}`}</span>
              </button>
            ))}
          </div>
          {selected && <p className="mt-2 break-all text-xs text-primary" dir="ltr">{isRtl ? 'گیرنده: ' : 'To: '}{selected.email}</p>}
        </div>
        <label className="block text-sm font-medium">
          {isRtl ? 'موضوع' : 'Subject'}
          <input value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200}
            className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
        </label>
        <label className="block text-sm font-medium">
          {isRtl ? 'متن پیام' : 'Message'}
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} required maxLength={20000} rows={6}
            className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-3 py-3 text-sm outline-none focus:border-primary" />
        </label>
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        {notice && <p role="status" className="text-sm text-green-400">{notice}</p>}
        <Button type="submit" disabled={!selected || !subject.trim() || !message.trim() || sending}>
          {sending ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}
          {isRtl ? 'ارسال ایمیل' : 'Send email'}
        </Button>
      </form>
    </Card>
  );
}