import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowRight, Search, X } from 'lucide-react';

export type SearchNavigationItem = {
  href: string;
  label: string;
  keywords?: string;
};

type GlobalSearchProps = {
  items: SearchNavigationItem[];
  isRtl: boolean;
  hideTrigger?: boolean;
};

export function GlobalSearch({ items, isRtl, hideTrigger = false }: GlobalSearchProps) {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const text = isRtl
    ? { search: 'جستجو', placeholder: 'جستجو در بخش‌های FEZI…', close: 'بستن جستجو', results: 'نتایج جستجو', empty: 'نتیجه‌ای پیدا نشد', hint: 'برای جستجو نام بخش را وارد کنید' }
    : { search: 'Search', placeholder: 'Search FEZI sections…', close: 'Close search', results: 'Search results', empty: 'No matching sections', hint: 'Type a section name to search' };

  const matches = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const scored = items.map((item) => {
      if (!term) return { item, score: 1 };
      const label = item.label.toLocaleLowerCase();
      const href = item.href.toLocaleLowerCase();
      const keywords = (item.keywords || '').toLocaleLowerCase();
      const score = label.startsWith(term) ? 100
        : label.includes(term) ? 80
          : keywords.startsWith(term) ? 70
            : keywords.includes(term) ? 55
              : href.includes(term) ? 35 : 0;
      return { item, score };
    }).filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
    return scored.slice(0, 9).map(({ item }) => item);
  }, [items, query]);

  useEffect(() => {
    const openSearch = () => {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setOpen(true);
    };
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('fezi-open-global-search', openSearch);
    window.addEventListener('keydown', onShortcut);
    return () => {
      window.removeEventListener('fezi-open-global-search', openSearch);
      window.removeEventListener('keydown', onShortcut);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
      } else if (event.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled]), [href]'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.requestAnimationFrame(() => (openerRef.current ?? triggerRef.current)?.focus());
    };
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  const select = (href: string) => {
    setOpen(false);
    setQuery('');
    setLocation(href);
  };

  return (
    <>
      {!hideTrigger && <button
        ref={triggerRef}
        type="button"
        data-testid="button-global-search"
        aria-label={text.search}
        title={`${text.search} (Ctrl+K)`}
        onClick={() => setOpen(true)}
        className="fezi-mobile-control flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover hover:text-primary"
      >
        <Search size={19} aria-hidden="true" />
      </button>}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/60 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(12vh,3rem)] backdrop-blur-sm sm:px-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={text.search}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
            dir={isRtl ? 'rtl' : 'ltr'}
          >
            <div className="flex min-h-14 items-center gap-3 border-b border-border px-4">
              <Search size={19} className="shrink-0 text-primary" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                data-testid="input-global-search"
                role="combobox"
                aria-label={text.search}
                aria-expanded="true"
                aria-controls="global-search-results"
                aria-activedescendant={matches[activeIndex] ? `global-search-option-${activeIndex}` : undefined}
                autoComplete="off"
                dir="auto"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' && matches.length) {
                    event.preventDefault();
                    setActiveIndex((index) => (index + 1) % matches.length);
                  } else if (event.key === 'ArrowUp' && matches.length) {
                    event.preventDefault();
                    setActiveIndex((index) => (index - 1 + matches.length) % matches.length);
                  } else if (event.key === 'Enter' && matches[activeIndex]) {
                    event.preventDefault();
                    select(matches[activeIndex].href);
                  }
                }}
                placeholder={text.placeholder}
                className="min-w-0 flex-1 bg-transparent py-4 text-base text-foreground outline-none placeholder:text-muted-foreground"
              />
              <button type="button" data-testid="button-close-global-search" aria-label={text.close} onClick={() => setOpen(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div id="global-search-results" role="listbox" aria-label={text.results} className="max-h-[min(60dvh,26rem)] overflow-y-auto overscroll-contain p-2">
              {matches.length ? matches.map((item, index) => (
                <button
                  key={`${item.href}-${item.label}`}
                  id={`global-search-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  data-testid={`button-global-search-result-${index}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(item.href)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-start transition-colors ${activeIndex === index ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'}`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{item.href}</span>
                  <ArrowRight size={16} className="shrink-0 text-primary" aria-hidden="true" />
                </button>
              )) : (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="text-global-search-empty">{query ? text.empty : text.hint}</p>
              )}
            </div>
            <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              {isRtl ? '↑ ↓ للتنقل · Enter للفتح · Esc للإغلاق' : '↑ ↓ to navigate · Enter to open · Esc to close'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}