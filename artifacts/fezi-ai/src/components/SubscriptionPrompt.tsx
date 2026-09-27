import { LockKeyhole, X, CreditCard } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Link } from 'wouter';
import { useTranslation } from '../lib/i18n';

export function SubscriptionBadge({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary ${className}`} title={t('subscription_required_badge')}>
      <LockKeyhole size={12} className="shrink-0" />
      <span className="truncate">{t('subscription_required_badge')}</span>
    </span>
  );
}

export function SubscriptionHoverHint({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 rounded-xl border border-primary/30 bg-background/95 p-3 text-start shadow-xl backdrop-blur-md">
      <p className="text-xs font-semibold text-primary">{t('subscription_prompt_title')}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{t('subscription_prompt_desc')}</p>
    </div>
  );
}

export function SubscriptionPrompt({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="subscription-prompt-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-primary/30 bg-background p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t('subscription_prompt_close')}
          className="absolute end-4 top-4 rounded-lg p-2 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <X size={18} />
        </button>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LockKeyhole size={24} />
        </div>
        <h2 id="subscription-prompt-title" className="mt-5 text-xl font-bold">
          {t('subscription_prompt_title')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t('subscription_prompt_desc')}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/billing"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20"
          >
            <CreditCard size={16} />
            {t('subscription_view_plans')}
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground hover:bg-surface-hover"
          >
            {t('subscription_prompt_close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}