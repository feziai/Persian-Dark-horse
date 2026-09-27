import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Search, Sparkles, Filter, Plus, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { PageHeader, Button, Input } from '../ui-parts';
import PromptCard from './PromptCard';
import { useListPromptStudioPrompts, ListPromptStudioPromptsSort, type PromptStudioPromptSummary } from '@workspace/api-client-react';

const CATEGORIES = [
  { id: '', labelEn: 'All', labelFa: 'همه' },
  { id: 'realistic', labelEn: 'Realistic', labelFa: 'واقع‌گرایانه' },
  { id: 'cartoon', labelEn: 'Cartoon', labelFa: 'کارتونی' },
  { id: 'cinematic', labelEn: 'Cinematic', labelFa: 'سینمایی' },
  { id: 'modeling', labelEn: 'Modeling', labelFa: 'مدلینگ' },
  { id: 'disney', labelEn: 'Disney', labelFa: 'دیزنی' },
  { id: 'games', labelEn: 'Games', labelFa: 'بازی' },
  { id: 'thumbnails', labelEn: 'Thumbnails', labelFa: 'تصاویر بندانگشتی' },
  { id: 'made-by-fezi', labelEn: 'Made by Persian Dark Horse', labelFa: 'ساختهٔ Persian Dark Horse' }
];

export default function PromptList() {
  const { isRtl } = useTranslation();
  const [, setLocation] = useLocation();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState<ListPromptStudioPromptsSort>('newest');
  
  const limit = 12;
  const [offset, setOffset] = useState(0);
  const [visiblePrompts, setVisiblePrompts] = useState<PromptStudioPromptSummary[]>([]);
  const [loadedTotal, setLoadedTotal] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setOffset(0);
    setVisiblePrompts([]);
    setLoadedTotal(0);
  }, [category, sort, debouncedSearch]);
  
  // Refetch when search changes
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setOffset(0); // Reset on new search
  };

  const { data, isLoading, isError } = useListPromptStudioPrompts({
    category: category || undefined,
    search: debouncedSearch || undefined,
    sort,
    offset,
    limit
  });

  useEffect(() => {
    if (!data) return;
    setLoadedTotal(data.total);
    setVisiblePrompts(current => offset === 0
      ? data.prompts
      : [...current, ...data.prompts.filter(prompt => !current.some(item => item.id === prompt.id))]);
  }, [data, offset]);

  const prompts = visiblePrompts;
  const hasMore = prompts.length < loadedTotal;

  return (
    <div className="space-y-8">
      <PageHeader
        title={isRtl ? 'استودیو پرامپت' : 'Prompt Studio'}
        description={isRtl
          ? 'پرامپت‌های انجمن را مرور کنید، الهام بگیرید و آثار خود را به اشتراک بگذارید.'
          : 'Browse community prompts, get inspired, and share your own creations.'}
        action={
          <div className="flex flex-wrap gap-2">
            <Button data-testid="button-generate-prompt" onClick={() => setLocation('/prompt-studio/generate')} className="shrink-0 gap-2 whitespace-nowrap"><Sparkles size={16} />{isRtl ? 'ساخت پرامپت' : 'Generate prompt'}</Button>
            <Button data-testid="button-new-prompt" variant="secondary" onClick={() => setLocation('/prompt-studio/new')} className="shrink-0 gap-2 whitespace-nowrap"><Plus size={16} />{isRtl ? 'پرامپت جدید' : 'New Prompt'}</Button>
          </div>
        }
      />

      <section className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-[radial-gradient(circle_at_90%_10%,hsl(var(--primary)/.22),transparent_38%),linear-gradient(120deg,hsl(var(--surface)),hsl(var(--background)))] p-6 md:p-8">
        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles size={18} />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
              {isRtl ? 'گالری جامعه کاربران' : 'COMMUNITY GALLERY'}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold md:text-3xl">
            {isRtl ? 'پرامپت‌ها و تصاویر را کاوش کنید.' : 'Explore prompts and generated images.'}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {isRtl
              ? 'کپی و استفاده از همهٔ پرامپت‌های آماده رایگان است. ساخت تصویر یا ویدیو هزینهٔ جداگانه دارد.'
              : 'Copy and use all prepared prompts for free. Image and video generation are charged separately.'}
          </p>
        </div>
      </section>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex w-full flex-wrap gap-2 xl:min-w-0 xl:flex-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setCategory(cat.id); setOffset(0); }}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                category === cat.id
                  ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(229,185,90,0.2)]'
                  : 'bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              {isRtl ? cat.labelFa : cat.labelEn}
            </button>
          ))}
        </div>

        <div className="flex w-full min-w-0 items-center gap-3 xl:w-auto">
          <div className="relative min-w-0 flex-1 md:w-64 md:flex-none">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder={isRtl ? 'جستجو...' : 'Search...'}
              value={search}
              onChange={handleSearchChange}
              className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value as ListPromptStudioPromptsSort); setOffset(0); }}
            className="max-w-[9rem] shrink-0 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            <option value="trending">{isRtl ? 'پرطرفدار' : 'Trending'}</option>
            <option value="newest">{isRtl ? 'جدیدترین' : 'Newest'}</option>
            <option value="top-rated">{isRtl ? 'برترین امتیاز' : 'Top Rated'}</option>
            <option value="relevant">{isRtl ? 'مرتبط‌ترین' : 'Relevant'}</option>
            <option value="popular">{isRtl ? 'محبوب‌ترین' : 'Popular'}</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      {isLoading && offset === 0 ? (
        <div className="flex py-20 items-center justify-center text-primary">
          <Loader2 size={32} className="animate-spin" />
        </div>
      ) : isError && prompts.length === 0 ? (
        <div className="rounded-2xl border border-red-900/30 bg-red-900/10 p-8 text-center text-red-400">
          <AlertCircle size={32} className="mx-auto mb-4 opacity-50" />
          <p>{isRtl ? 'خطا در بارگذاری پرامپت‌ها.' : 'Failed to load prompts.'}</p>
        </div>
      ) : prompts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface/30 p-12 text-center">
          <Filter size={32} className="mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="mb-2 text-lg font-semibold">{isRtl ? 'پرامپتی یافت نشد' : 'No prompts found'}</h3>
          <p className="text-sm text-muted-foreground">
            {isRtl ? 'با این فیلترها نتیجه‌ای وجود ندارد.' : 'Try adjusting your search or filters.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {prompts.map(prompt => (
              <PromptCard key={prompt.id} prompt={prompt} isRtl={isRtl} />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="secondary"
                onClick={() => setOffset(o => o + limit)}
                disabled={isLoading}
              >
                {isLoading && <Loader2 size={16} className="animate-spin mr-2" />}
                {isRtl ? 'بارگذاری بیشتر' : 'Load more'}
              </Button>
            </div>
          )}
          {isError && <p role="alert" className="text-center text-sm text-red-400">{isRtl ? 'بارگذاری پرامپت‌های بیشتر ناموفق بود. دوباره تلاش کنید.' : 'Could not load more prompts. Please try again.'}</p>}
        </div>
      )}
    </div>
  );
}
