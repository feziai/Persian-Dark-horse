import { useEffect, useRef, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, BadgeCheck, RotateCcw, X } from 'lucide-react';
import { isInternalHref, safeHref, useCommunityCopy, type Profile } from '../../lib/community';
import { cn } from '../../lib/utils';
import { avatarSource } from '../../lib/avatar-options';
import communityLogo from '@/assets/community-logo.webp';
import officialCommunityAvatar from '@/assets/official-community-avatar.png';

export function CommunityAvatar({ profile, size = 40 }: { profile: Pick<Profile, 'name' | 'avatarUrl'> & { id?: string }; size?: number }) {
  const src = profile.id === 'fezi-official'
    ? officialCommunityAvatar
    : avatarSource(profile.avatarUrl) || safeHref(profile.avatarUrl) || communityLogo;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-primary/25 bg-primary/10 font-semibold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
    </span>
  );
}

export function ProBadge({ verified }: { verified: boolean }) {
  const { c } = useCommunityCopy();
  if (!verified) return null;
  return (
    <span title={c.pro} className="inline-flex items-center text-sky-500" data-testid="badge-pro">
      <BadgeCheck className="h-4 w-4" aria-label={c.pro} />
    </span>
  );
}

export function SafeLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  const safe = safeHref(href);
  if (!safe) return <span className={className}>{children}</span>;
  if (isInternalHref(safe)) return <Link href={safe} className={className}>{children}</Link>;
  return <a href={safe} target="_blank" rel="noopener noreferrer nofollow ugc" className={className}>{children}</a>;
}

/** Responsive modal: bottom sheet on mobile, centered card on desktop. */
export function Sheet({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select, button:not([data-close])');
    first?.focus();
    return () => { document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center" role="presentation">
      <button type="button" aria-label="Close" data-close className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} tabIndex={-1} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'fade-up relative max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl md:rounded-3xl md:pb-5',
          wide ? 'md:max-w-2xl' : 'md:max-w-md',
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border md:hidden" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" data-close onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-hover" aria-label="Close" data-testid="button-close-sheet">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function PostSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border/70 px-4 py-5" aria-hidden="true">
      <div className="pulse-soft h-10 w-10 rounded-full bg-surface-hover" />
      <div className="flex-1 space-y-2.5">
        <div className="pulse-soft h-3 w-32 rounded bg-surface-hover" />
        <div className="pulse-soft h-3 w-full rounded bg-surface-hover" />
        <div className="pulse-soft h-3 w-2/3 rounded bg-surface-hover" />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { c } = useCommunityCopy();
  return (
    <div role="alert" className="mx-4 my-6 flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-red-500/5 p-6 text-center" data-testid="status-error">
      <AlertTriangle className="h-6 w-6 text-red-500" />
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="tactile-button inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-medium hover:bg-surface-hover" data-testid="button-retry">
          <RotateCcw className="h-4 w-4" /> {c.retry}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center" data-testid="status-empty">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">{icon}</div>
      <p className="max-w-xs text-sm text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

export function PillButton({ children, onClick, variant = 'ghost', disabled, className, type = 'button', testId, ...rest }: {
  children: ReactNode; onClick?: () => void; variant?: 'gold' | 'ghost' | 'outline' | 'danger'; disabled?: boolean; className?: string; type?: 'button' | 'submit'; testId?: string; 'aria-label'?: string; 'aria-pressed'?: boolean;
}) {
  const styles = {
    gold: 'bg-primary text-primary-foreground hover:brightness-110',
    ghost: 'hover:bg-surface-hover text-foreground',
    outline: 'border border-border hover:bg-surface-hover text-foreground',
    danger: 'bg-red-600 text-white hover:bg-red-500',
  }[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} {...rest}
      className={cn('tactile-button inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', styles, className)}>
      {children}
    </button>
  );
}
