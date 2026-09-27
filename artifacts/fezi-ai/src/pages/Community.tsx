import { useCallback, useEffect, useState } from 'react';
import { useLocation, useRoute, useSearch } from 'wouter';
import { MessagesSquare, Newspaper, Search, Sparkles, UsersRound, X } from 'lucide-react';
import { useCommunityApi, useCommunityCopy, useCommunityViewer, type FeedTab, type Post } from '../lib/community';
import { CommunityHeader } from '../components/community/CommunityHeader';
import { Composer } from '../components/community/Composer';
import { FeedList } from '../components/community/FeedList';
import { PostCard } from '../components/community/PostCard';
import { ErrorState, PostSkeleton } from '../components/community/primitives';
import { useFeed } from '../components/community/useFeed';
import { cn } from '../lib/utils';

function Tabs({ tab, setTab, signedIn }: { tab: FeedTab; setTab: (t: FeedTab) => void; signedIn: boolean }) {
  const { c } = useCommunityCopy();
  const tabs: Array<[FeedTab, string]> = [['all', c.all], ...(signedIn ? [['following', c.following] as [FeedTab, string]] : []), ['news', c.news]];
  return (
    <div role="tablist" aria-label={c.community} className="flex">
      {tabs.map(([id, label]) => (
        <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
          className={cn('relative min-h-12 flex-1 text-sm font-semibold transition-colors hover:bg-surface-hover/60', tab === id ? 'text-foreground' : 'text-muted-foreground')}
          data-testid={`tab-feed-${id}`}>
          {label}
          <span className={cn('absolute bottom-0 left-1/2 h-[3px] w-12 -translate-x-1/2 rounded-full bg-primary transition-opacity', tab === id ? 'opacity-100' : 'opacity-0')} />
        </button>
      ))}
    </div>
  );
}

function FeedView() {
  const { c } = useCommunityCopy();
  const viewer = useCommunityViewer();
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const params = new URLSearchParams(searchParams);
  const requestedTab = params.get('tab');
  const tab: FeedTab = requestedTab === 'news' || (requestedTab === 'following' && viewer.isSignedIn) ? requestedTab : 'all';
  const search = (params.get('q') || '').trim().slice(0, 120);
  const [searchDraft, setSearchDraft] = useState(search);
  useEffect(() => { setSearchDraft(search); }, [search]);
  const routeTo = useCallback((nextTab: FeedTab, nextSearch: string, replace = false) => {
    const p = new URLSearchParams();
    if (nextTab !== 'all') p.set('tab', nextTab);
    if (nextSearch.trim()) p.set('q', nextSearch.trim().slice(0, 120));
    navigate(`/community${p.size ? `?${p}` : ''}`, { replace });
  }, [navigate]);
  useEffect(() => {
    if (requestedTab === 'following' && !viewer.isSignedIn) routeTo('all', search, true);
  }, [requestedTab, viewer.isSignedIn, routeTo, search]);
  useEffect(() => {
    if (searchDraft.trim() === search) return;
    const timer = window.setTimeout(() => routeTo(tab, searchDraft, true), 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft, search, routeTo, tab]);
  const feed = useFeed({ tab, search });
  const emptyText = search ? c.emptySearch : tab === 'following' ? c.emptyFollowing : tab === 'news' ? c.emptyNews : c.emptyAll;
  const icon = tab === 'news' ? <Newspaper className="h-6 w-6" /> : tab === 'following' ? <UsersRound className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />;
  return (
    <>
      <CommunityHeader title={c.community}>
        <div className="px-3 pb-2 sm:px-4">
          <label className="flex min-h-12 items-center gap-2 rounded-2xl border border-border bg-surface px-3 text-muted-foreground transition-colors focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15">
            <Search className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <input type="search" value={searchDraft} maxLength={120} onChange={(event) => setSearchDraft(event.target.value)}
              aria-label={c.searchPosts} placeholder={c.searchPosts} data-testid="input-community-search"
              className="min-w-0 flex-1 bg-transparent py-3 text-base text-foreground outline-none placeholder:text-muted-foreground/75 sm:text-sm" />
            {searchDraft && <button type="button" onClick={() => { setSearchDraft(''); routeTo(tab, '', true); }} aria-label={c.clearSearch} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-surface-hover"><X size={18} /></button>}
          </label>
        </div>
        <Tabs tab={tab} setTab={(next) => routeTo(next, searchDraft)} signedIn={viewer.isSignedIn} />
      </CommunityHeader>
      {tab !== 'news' && <Composer onPosted={(p) => { if (tab === 'all' && !search) feed.prepend(p); }} />}
      <FeedList feed={feed} empty={emptyText} emptyIcon={icon} />
    </>
  );
}

function ThreadView({ id }: { id: string }) {
  const { c } = useCommunityCopy();
  const api = useCommunityApi();
  const { userId } = useCommunityViewer();
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(0);
  const [gone, setGone] = useState(false);
  const replies = useFeed({ parentId: id, pollMs: 15000, autoMerge: true });

  const load = useCallback(async () => {
    setError(''); setStatus(0);
    try { setPost((await api<{ post: Post }>(`/community/posts/${encodeURIComponent(id)}`)).post); }
    catch (e) { setError(e instanceof Error ? e.message : c.errorLoad); setStatus((e as { status?: number }).status ?? 0); }
  }, [api, id, c.errorLoad]);
  useEffect(() => { setPost(null); setGone(false); void load(); }, [load, userId]);

  const removeReply = (rid: string) => {
    replies.remove(rid);
    setPost((cur) => (cur ? { ...cur, replyCount: Math.max(0, cur.replyCount - 1) } : cur));
  };

  return (
    <>
      <CommunityHeader title={c.thread} back="/community" />
      {gone ? (
        <ErrorState message={c.deleted} />
      ) : error ? (
        <ErrorState message={status === 404 ? c.notFound : `${c.errorLoad} ${error}`} onRetry={status === 404 ? undefined : () => void load()} />
      ) : !post ? (
        <PostSkeleton />
      ) : (
        <>
          <PostCard post={post} detail onChange={setPost} onDelete={() => setGone(true)} onBlocked={() => setGone(true)} />
          <Composer parentId={post.id} onPosted={(p) => { replies.append(p); setPost((cur) => (cur ? { ...cur, replyCount: cur.replyCount + 1 } : cur)); }} />
          <FeedList feed={{ ...replies, remove: removeReply }} empty={c.emptyReplies} emptyIcon={<MessagesSquare className="h-6 w-6" />} />
        </>
      )}
    </>
  );
}

export default function Community() {
  const [isThread, params] = useRoute('/community/post/:id');
  const [, navigate] = useLocation();
  const { isRtl } = useCommunityCopy();
  useEffect(() => {
    const legacyPost = new URLSearchParams(window.location.search).get('post');
    if (!isThread && legacyPost) navigate(`/community/post/${encodeURIComponent(legacyPost)}`, { replace: true });
  }, [isThread, navigate]);
  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="mx-auto min-h-[100dvh] w-full max-w-2xl border-border/60 bg-background md:border-x">
      {isThread && params?.id ? <ThreadView key={params.id} id={decodeURIComponent(params.id)} /> : <FeedView />}
    </div>
  );
}
