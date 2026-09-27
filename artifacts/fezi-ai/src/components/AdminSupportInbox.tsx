import { useEffect, useState } from 'react';
import { Inbox, LoaderCircle, RefreshCw } from 'lucide-react';
import { Button, Card } from './ui-parts';

type MailSummary = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
};

type MailDetail = MailSummary & {
  to: string[];
  text: string;
  attachments: Array<{ filename: string; size: number }>;
};

export function AdminSupportInbox({ isRtl }: { isRtl: boolean }) {
  const [messages, setMessages] = useState<MailSummary[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selected, setSelected] = useState<MailDetail | null>(null);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');

  const load = async (pageToken?: string) => {
    setLoading(true);
    setError('');
    try {
      const query = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
      const response = await fetch(`/api/admin/support/inbox${query}`, { credentials: 'include' });
      const data = await response.json() as {
        messages?: MailSummary[]; nextPageToken?: string | null; setupRequired?: boolean;
      };
      if (!response.ok || !Array.isArray(data.messages)) {
        throw new Error(data.setupRequired ? 'setup' : 'unavailable');
      }
      setMessages((current) => pageToken ? [...current, ...data.messages!] : data.messages!);
      setNextPageToken(data.nextPageToken || null);
    } catch (cause) {
      setError(cause instanceof Error && cause.message === 'setup'
        ? (isRtl ? 'صندوق Support@ هنوز در AgentMail فعال نشده است. پس از تنظیم دامنه و DNS، ایمیل‌های دریافتی اینجا دیده می‌شوند.' : 'The Support@ mailbox is not active yet. Incoming mail will appear here after the domain and DNS are configured.')
        : (isRtl ? 'بارگذاری ایمیل‌های پشتیبانی ناموفق بود. دوباره تلاش کنید.' : 'Could not load support emails. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [isRtl]);

  const openMessage = async (id: string) => {
    setSelected(null);
    setDetailError('');
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/admin/support/inbox/${encodeURIComponent(id)}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Message unavailable');
      const data = await response.json() as { message?: MailDetail };
      if (!data.message) throw new Error('Message unavailable');
      setSelected(data.message);
    } catch {
      setDetailError(isRtl ? 'این پیام بارگذاری نشد.' : 'This message could not be loaded.');
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <Card className="border-primary/20">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Inbox size={18} className="text-primary" />{isRtl ? 'صندوق ایمیل پشتیبانی' : 'Support email inbox'}</h2>
          <p className="mt-1 break-all text-xs text-muted-foreground">Support@persiandarkhorse.com</p>
        </div>
        <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => { setSelected(null); void load(); }}>
          {loading ? <LoaderCircle size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          {isRtl ? 'تازه‌سازی' : 'Refresh'}
        </Button>
      </div>
      {error && <p role="alert" className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-200">{error}</p>}
      {!error && !loading && !messages.length && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">{isRtl ? 'هنوز ایمیل دریافتی وجود ندارد.' : 'No incoming emails yet.'}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="max-h-[32rem] space-y-2 overflow-y-auto">
          {messages.map((mail) => (
            <button
              key={mail.id}
              type="button"
              onClick={() => { void openMessage(mail.id); }}
              className="w-full rounded-xl border border-border bg-background p-3 text-start transition hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="flex flex-wrap justify-between gap-2 text-sm">
                <span className={`break-all ${mail.unread ? 'font-semibold' : ''}`}>{mail.from}</span>
                <span className="text-xs text-muted-foreground">{mail.receivedAt ? new Date(mail.receivedAt).toLocaleString(isRtl ? 'fa-IR' : 'en-US') : ''}</span>
              </span>
              <span className="mt-1 block truncate text-sm font-medium">{mail.subject || (isRtl ? 'بدون موضوع' : 'No subject')}</span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">{mail.preview}</span>
            </button>
          ))}
          {nextPageToken && <Button type="button" size="sm" variant="secondary" disabled={loading} onClick={() => { void load(nextPageToken); }}>{isRtl ? 'نمایش بیشتر' : 'Load more'}</Button>}
        </div>
        <div className="min-w-0 rounded-xl border border-border bg-background p-4">
          {loadingDetail && <LoaderCircle size={18} className="animate-spin text-primary" />}
          {detailError && <p role="alert" className="text-sm text-red-400">{detailError}</p>}
          {!selected && !loadingDetail && !detailError && <p className="text-sm text-muted-foreground">{isRtl ? 'برای خواندن، یک ایمیل انتخاب کنید.' : 'Select an email to read it.'}</p>}
          {selected && (
            <article>
              <h3 className="break-words font-semibold">{selected.subject || (isRtl ? 'بدون موضوع' : 'No subject')}</h3>
              <p className="mt-2 break-all text-xs text-muted-foreground">{isRtl ? 'از:' : 'From:'} {selected.from}</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{isRtl ? 'به:' : 'To:'} {selected.to.join(', ')}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selected.receivedAt ? new Date(selected.receivedAt).toLocaleString(isRtl ? 'fa-IR' : 'en-US') : ''}</p>
              <pre className="mt-4 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words border-t border-border pt-4 font-sans text-sm leading-relaxed">{selected.text || (isRtl ? 'متن ساده‌ای برای این پیام موجود نیست.' : 'No plain-text body is available for this message.')}</pre>
              {selected.attachments.length > 0 && <p className="mt-4 text-xs text-muted-foreground">{isRtl ? 'پیوست‌ها:' : 'Attachments:'} {selected.attachments.map((file) => file.filename).join(', ')} ({isRtl ? 'دریافت فایل هنوز فعال نیست' : 'downloads not available yet'})</p>}
            </article>
          )}
        </div>
      </div>
    </Card>
  );
}