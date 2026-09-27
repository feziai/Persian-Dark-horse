import { useCallback, useEffect, useRef, useState } from 'react';
import { useCommunityApi, useCommunityViewer, usePolling, type FeedTab, type Post } from '../../lib/community';

/** Cursor-paginated feed with gentle polling for new top items (surfaced, not auto-inserted). */
export function useFeed(params: { tab?: FeedTab; search?: string; authorId?: string; parentId?: string; enabled?: boolean; pollMs?: number; autoMerge?: boolean }) {
  const api = useCommunityApi();
  const { userId } = useCommunityViewer();
  const { tab = 'all', search = '', authorId, parentId, enabled = true, pollMs = 30000, autoMerge = false } = params;
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [fresh, setFresh] = useState<Post[]>([]);
  const reqId = useRef(0);
  const moreInFlight = useRef(false);
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const query = useCallback((c?: string | null) => {
    const q = new URLSearchParams();
    if (!parentId) q.set('tab', tab);
    if (authorId) q.set('authorId', authorId);
    if (parentId) q.set('parentId', parentId);
    if (search && !parentId) q.set('q', search);
    if (c) q.set('cursor', c);
    return `/community/posts?${q.toString()}`;
  }, [tab, search, authorId, parentId]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true); setError(''); setFresh([]);
    try {
      const res = await api<{ posts: Post[]; nextCursor: string | null }>(query());
      if (id !== reqId.current) return;
      setPosts(res.posts); setCursor(res.nextCursor);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : 'Error');
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [api, query]);

  useEffect(() => {
    ++reqId.current;
    setPosts([]);
    setCursor(null);
    setFresh([]);
    setLoadingMore(false);
    moreInFlight.current = false;
    if (enabled) void load();
  }, [load, enabled, userId]);

  const loadMore = useCallback(async () => {
    if (!cursor || moreInFlight.current) return;
    moreInFlight.current = true;
    const id = reqId.current;
    setError('');
    setLoadingMore(true);
    try {
      const res = await api<{ posts: Post[]; nextCursor: string | null }>(query(cursor));
      if (id !== reqId.current) return;
      setPosts((cur) => [...cur, ...res.posts.filter((p) => !cur.some((x) => x.id === p.id))]);
      setCursor(res.nextCursor);
    } catch (e) {
      if (id === reqId.current) setError(e instanceof Error ? e.message : 'Error');
    } finally {
      if (id === reqId.current) {
        moreInFlight.current = false;
        setLoadingMore(false);
      }
    }
  }, [api, cursor, query]);

  usePolling(async () => {
    if (loading) return;
    const id = reqId.current;
    try {
      const res = await api<{ posts: Post[]; nextCursor: string | null }>(query());
      if (id !== reqId.current) return;
      const known = new Set(postsRef.current.map((p) => p.id));
      const incoming = res.posts.filter((p) => !known.has(p.id));
      const byId = new Map(res.posts.map((p) => [p.id, p]));
      setPosts((cur) => {
        const updated = cur.map((p) => byId.get(p.id) ?? p);
        return autoMerge ? [...updated, ...incoming.filter((p) => !cur.some((x) => x.id === p.id))] : updated;
      });
      if (!autoMerge) setFresh(incoming);
    } catch { /* silent background refresh */ }
  }, pollMs, enabled && !error);

  const showFresh = useCallback(() => {
    setPosts((cur) => [...fresh.filter((p) => !cur.some((x) => x.id === p.id)), ...cur]);
    setFresh([]);
  }, [fresh]);

  const update = useCallback((post: Post) => setPosts((cur) => cur.map((p) => (p.id === post.id ? post : p))), []);
  const remove = useCallback((id: string) => setPosts((cur) => cur.filter((p) => p.id !== id)), []);
  const prepend = useCallback((post: Post) => setPosts((cur) => [post, ...cur.filter((p) => p.id !== post.id)]), []);
  const append = useCallback((post: Post) => setPosts((cur) => [...cur.filter((p) => p.id !== post.id), post]), []);
  const removeAuthor = useCallback((a: string) => setPosts((cur) => cur.filter((p) => p.author.id !== a)), []);

  return { posts, loading, loadingMore, error, hasMore: !!cursor, load, loadMore, fresh, showFresh, update, remove, prepend, append, removeAuthor };
}
