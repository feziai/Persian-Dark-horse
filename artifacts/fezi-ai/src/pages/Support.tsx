import { useState } from 'react';
import { Check, Copy, CreditCard, ExternalLink, Instagram, LoaderCircle, Mail, Send, Ticket, Users } from 'lucide-react';
import { useTranslation } from '../lib/i18n';
import { Button, Card, Input, Label, PageHeader, Textarea } from '../components/ui-parts';

type TicketType = 'question' | 'collaboration' | 'payment' | 'technical';

export default function SupportPage() {
  const { t } = useTranslation();
  const [ticketType, setTicketType] = useState<TicketType>('question');
  const [subject, setSubject] = useState('');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [ticketError, setTicketError] = useState(false);
  const [ticketSending, setTicketSending] = useState(false);
  const [txId, setTxId] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const submitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (subject.trim().length < 3 || contact.trim().length < 3 || message.trim().length < 10) {
      setTicketError(true);
      return;
    }
    setTicketSending(true);
    setTicketError(false);
    setTicketId('');
    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: ticketType, subject, contact, message }),
      });
      if (!response.ok) throw new Error('Ticket submission failed');
      const payload = await response.json() as { accepted?: boolean; ticket?: { id?: string; status?: string } };
      if (payload.accepted !== true || !payload.ticket?.id || payload.ticket.status !== 'open') {
        throw new Error('Ticket acceptance was not confirmed');
      }
      setTicketId(payload.ticket.id);
      setSubject('');
      setContact('');
      setMessage('');
    } catch {
      setTicketError(true);
    } finally {
      setTicketSending(false);
    }
  };

  const copyDetails = async () => {
    await navigator.clipboard?.writeText(`TX ID: ${txId}\n${paymentMessage}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fade-up mx-auto max-w-5xl space-y-8">
      <PageHeader title={t('support_title')} description={t('support_desc')} />

      <div id="support-feedback" className="scroll-mt-24">
      <div id="support-tickets" className="scroll-mt-24">
      <Card className="border-primary/20 bg-primary/5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background text-primary">
            <Ticket size={22} />
          </div>
          <div>
            <h2 className="font-semibold">{t('support_ticket_title')}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('support_ticket_desc')}</p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={submitTicket}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>{t('support_ticket_type')}</Label>
              <select
                value={ticketType}
                onChange={(event) => setTicketType(event.target.value as TicketType)}
                className="mt-0 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                <option value="question">{t('support_ticket_question')}</option>
                <option value="collaboration">{t('support_ticket_collaboration')}</option>
                <option value="payment">{t('support_ticket_payment')}</option>
                <option value="technical">{t('support_ticket_technical')}</option>
              </select>
            </div>
            <div>
              <Label>{t('support_ticket_contact')}</Label>
              <Input value={contact} maxLength={320} onChange={(event) => setContact(event.target.value)} placeholder={t('support_ticket_contact_placeholder')} dir="ltr" className="text-start" />
            </div>
          </div>
          <div>
            <Label>{t('support_ticket_subject')}</Label>
            <Input value={subject} maxLength={160} onChange={(event) => setSubject(event.target.value)} placeholder={t('support_ticket_subject_placeholder')} />
          </div>
          <div>
            <Label>{t('support_ticket_message')}</Label>
            <Textarea value={message} maxLength={5000} onChange={(event) => setMessage(event.target.value)} placeholder={t('support_ticket_message_placeholder')} rows={5} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={ticketSending}>
              {ticketSending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
              {ticketSending ? t('support_ticket_sending') : t('support_ticket_submit')}
            </Button>
            {ticketError && <span className="text-xs text-red-400">{t('support_ticket_error')}</span>}
          </div>
          {ticketId && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">
              <p className="flex items-center gap-2 font-semibold"><Check size={16} /> {t('support_ticket_sent')} — {t('support_ticket_accepted')}</p>
              <p className="mt-1">{t('support_ticket_sent_desc')} <span className="font-mono" dir="ltr">{ticketId}</span></p>
            </div>
          )}
        </form>
      </Card>
      </div>
      </div>

      <div id="support-collaboration" className="scroll-mt-24">
      <Card className="border-primary/20">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Users size={22} />
          </div>
          <div>
            <h2 className="font-semibold">{t('support_collaboration_title')}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('support_collaboration_desc')}</p>
          </div>
        </div>
      </Card>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-background text-primary">
            <CreditCard size={22} />
          </div>
          <div>
            <h2 className="font-semibold">{t('support_payment_title')}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('support_payment_desc')}</p>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <Label>{t('support_tx_placeholder')}</Label>
            <Input value={txId} onChange={(event) => setTxId(event.target.value)} placeholder={t('bill_txid_placeholder')} dir="ltr" className="text-start" />
          </div>
          <div>
            <Label>{t('description')}</Label>
            <Textarea value={paymentMessage} onChange={(event) => setPaymentMessage(event.target.value)} placeholder={t('support_payment_desc')} rows={3} />
          </div>
        </div>
        <Button type="button" className="mt-4" onClick={copyDetails}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? t('saved') : t('support_copy_tx')}
        </Button>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <a href="https://t.me/PDH_SUP" target="_blank" rel="noopener noreferrer" className="tactile-card group p-5 hover:-translate-y-1 hover:border-primary/50">
          <Send className="text-primary" size={22} />
          <h3 className="mt-4 font-semibold">{t('support_telegram')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">@PDH_SUP</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs text-primary">{t('support_open_telegram')} <ExternalLink size={13} /></span>
        </a>
        <a href="mailto:PersianDarkHorsesup@gmail.com" className="tactile-card group p-5 hover:-translate-y-1 hover:border-primary/50">
          <Mail className="text-primary" size={22} />
          <h3 className="mt-4 font-semibold">{t('support_email')}</h3>
          <p className="mt-1 break-all text-xs text-muted-foreground">PersianDarkHorsesup@gmail.com</p>
          <span className="mt-4 inline-flex items-center gap-1 break-all text-xs text-primary">PersianDarkHorsesup@gmail.com <ExternalLink size={13} className="shrink-0" /></span>
        </a>
        <a href="https://www.instagram.com/pdh.ir?stkn=YmtnbW0zMzdjZ2Fr" target="_blank" rel="noopener noreferrer" className="tactile-card group p-5 hover:-translate-y-1 hover:border-primary/50">
          <Instagram className="text-primary" size={22} />
          <h3 className="mt-4 font-semibold">{t('support_instagram')}</h3>
          <p className="mt-1 text-xs text-muted-foreground">@pdh.ir</p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs text-primary">Instagram <ExternalLink size={13} /></span>
        </a>
      </div>
    </div>
  );
}