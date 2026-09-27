import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Loader2 } from 'lucide-react';
import { useCommunityCopy } from '../../lib/community';
import type { useFeed } from './useFeed';
import { PostCard } from './PostCard';
import { EmptyState, ErrorState, PillButton, PostSkeleton } from './primitives';

export function FeedList({ feed, empty, emptyIcon }: { feed: ReturnType<typeof useFeed>; empty: string; emptyIcon: ReactNode }) {
  const { c } = useCommunityCopy();
  const sentinel = useRef<HTMLDivElement>(null);
  const moreRef = useRef(feed.loadMore);
  moreRef.current = feed.loadMore;

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !feed.hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) void moreRef.current(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [feed.hasMore, feed.posts.length]);

  if (feed.loading && !feed.posts.length) return <div aria-busy="true" aria-label={c.loading}><PostSkeleton /><PostSkeleton /><PostSkeleton /></div>;
  if (feed.error && !feed.posts.length) return <ErrorState message={`${c.errorLoad} ${feed.error}`} onRetry={() => void feed.load()} />;
  if (!feed.posts.length) return <EmptyState icon={emptyIcon} title={empty} />;

  return (
    <div>
      {feed.fresh.length > 0 && (
        <div className="sticky top-40 z-20 flex justify-center py-2">
          <PillButton variant="gold" onClick={() => { feed.showFresh(); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="shadow-lg" testId="button-show-new-posts">
            <ArrowUp className="h-4 w-4" /> {c.newPosts} ({feed.fresh.length})
          </PillButton>
        </div>
      )}
      {feed.posts.map((post) => (
        <PostCard key={post.id} post={post} onChange={feed.update} onDelete={feed.remove} onBlocked={feed.removeAuthor} />
      ))}
      <div ref={sentinel} />
      {feed.hasMore && (
        <div className="flex justify-center py-5">
          <PillButton variant="outline" onClick={() => void feed.loadMore()} disabled={feed.loadingMore} testId="button-load-more">
            {feed.loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDown className="h-4 w-4" />}
            {feed.loadingMore ? c.loading : `${c.loadMore} ↓`}
          </PillButton>
        </div>
      )}
      {feed.error && <p role="alert" className="px-4 py-3 text-center text-sm text-red-500">{feed.error}</p>}
    </div>
  );
}
