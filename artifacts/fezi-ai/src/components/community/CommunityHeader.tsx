import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, Mail, UserRound } from 'lucide-react';
import { useCommunityCopy, useCommunityViewer } from '../../lib/community';
import { CommunityBell } from './CommunityBell';
import { PushNotificationsButton } from './PushNotificationsButton';

export function CommunityHeader({ title, back, children }: { title: string; back?: string; children?: ReactNode }) {
  const { c, isRtl } = useCommunityCopy();
  const viewer = useCommunityViewer();
  const Back = isRtl ? ArrowRight : ArrowLeft;
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="flex min-h-14 items-center gap-1 px-2 sm:px-4">
        {back && (
          <Link href={back} aria-label={c.backToFeed} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface-hover" data-testid="link-back">
            <Back className="h-5 w-5" />
          </Link>
        )}
        <h1 className="flex-1 truncate px-2 text-lg font-semibold tracking-tight">{title}</h1>
        {viewer.isSignedIn && (
          <>
            <PushNotificationsButton />
            <Link href="/community/messages" aria-label={c.messages} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-primary" data-testid="link-community-messages">
              <Mail className="h-5 w-5" />
            </Link>
            <Link href="/community/profile/me" aria-label={c.editProfile} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-surface-hover hover:text-primary" data-testid="link-community-me">
              <UserRound className="h-5 w-5" />
            </Link>
          </>
        )}
        <CommunityBell />
      </div>
      {children}
    </header>
  );
}
