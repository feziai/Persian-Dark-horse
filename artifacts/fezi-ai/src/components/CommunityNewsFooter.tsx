import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Newspaper } from 'lucide-react';
import { Link } from 'wouter';

type News = { id: string; title?: string | null; text: string; createdAt: string; media?: { url: string; kind: 'image' | 'video' }[] };
export type CommunityNewsFooterProps = { isRtl: boolean };

export function CommunityNewsFooter({ isRtl }: CommunityNewsFooterProps) {
  const [posts, setPosts] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/community/posts?tab=news', { credentials: 'include', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`News unavailable (${response.status})`);
        const data: { posts: News[] } = await response.json();
        if (!Array.isArray(data.posts)) throw new Error('Invalid news response');
        setPosts([...data.posts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 3));
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  return (
    <section dir={isRtl ? 'rtl' : 'ltr'} aria-label={isRtl ? 'اخبار انجمن' : 'Community news'} className="my-8 rounded-3xl border border-primary/20 bg-surface/50 p-4 text-foreground sm:p-6" data-testid="community-news-footer">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Newspaper size={20} className="text-primary" />{isRtl ? 'تازه‌ترین اخبار' : 'Latest news'}</h2>
        <Link href="/community" data-testid="link-all-community-news" className="text-xs font-semibold text-primary hover:underline">{isRtl ? 'انجمن' : 'Community'}</Link>
      </div>
      {loading && <p role="status" className="text-sm text-muted-foreground">{isRtl ? 'در حال بارگذاری اخبار…' : 'Loading news…'}</p>}
      {error && <p role="status" className="text-sm text-muted-foreground">{isRtl ? 'اخبار در حال حاضر در دسترس نیست.' : 'News is currently unavailable.'}</p>}
      {!loading && !error && !posts.length && <p className="text-sm text-muted-foreground">{isRtl ? 'هنوز خبری منتشر نشده است.' : 'No news has been published yet.'}</p>}
      {!!posts.length && <div className="grid gap-3 md:grid-cols-3">
        {posts.map((post) => {
          const image = post.media?.find((media) => media.kind === 'image')?.url;
          return <Link href={`/community/post/${encodeURIComponent(post.id)}`} key={post.id} data-testid={`link-news-${post.id}`} className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-background/70 transition-colors hover:border-primary/50">
            {image && <img src={image} alt="" loading="lazy" className="aspect-video w-full object-cover" />}
            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-2 font-semibold">{post.title || post.text}</h3>
              {post.title && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{post.text}</p>}
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">{isRtl ? 'ادامه مطلب' : 'Read more'}{isRtl ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}</span>
            </div>
          </Link>;
        })}
      </div>}
    </section>
  );
}