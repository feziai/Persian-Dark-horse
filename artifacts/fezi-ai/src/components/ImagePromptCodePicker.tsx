import { useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { imagePromptCodes } from '../lib/image-prompt-codes';

type Props = {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  selectedCodes: string[];
  onChange: (codes: string[]) => void;
  isRtl: boolean;
};

export function ImagePromptCodePicker({ prompt, onPromptChange, selectedCodes, onChange, isRtl }: Props) {
  const [open, setOpen] = useState(true);
  const [search, setSearch] = useState('');
  const slashMatch = prompt.match(/(?:^|\s)\/([\w -]*)$/i);
  const slashQuery = slashMatch?.[1];
  const expanded = open || slashQuery !== undefined;
  const query = (search || slashQuery || '').trim().replace(/^\/+/, '').toLocaleLowerCase();
  const visibleCodes = imagePromptCodes.filter((item) =>
    !query || item.code.slice(1).includes(query) || item.descriptionEn.toLowerCase().includes(query) || item.descriptionFa.includes(query)
  );

  const toggle = (code: string) => {
    onChange(slashQuery !== undefined
      ? (selectedCodes.includes(code) ? selectedCodes : [...selectedCodes, code])
      : (selectedCodes.includes(code) ? selectedCodes.filter((item) => item !== code) : [...selectedCodes, code]));
    if (slashQuery !== undefined) onPromptChange(prompt.replace(/(?:^|\s)\/([\w -]*)$/i, '').trimEnd());
  };

  return (
    <section className="mt-3 min-w-0 rounded-2xl border border-primary/20 bg-primary/5 p-3 sm:p-4" aria-label={isRtl ? 'کدهای ساخت تصویر' : 'Image prompt codes'}>
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={expanded}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-start">
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{isRtl ? 'کدهای ساخت تصویر' : 'Image prompt codes'}</span>
          <span className="block text-xs leading-5 text-muted-foreground">
            {isRtl ? `۵۰ گزینه برای سبک، نور و ترکیب‌بندی · ${selectedCodes.length} انتخاب‌شده` : `50 options for style, light and composition · ${selectedCodes.length} selected`}
          </span>
        </span>
        <ChevronDown size={18} className={`shrink-0 text-primary transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {selectedCodes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label={isRtl ? 'کدهای انتخاب‌شده' : 'Selected codes'}>
          {selectedCodes.map((code) => (
            <button key={code} type="button" onClick={() => onChange(selectedCodes.filter((item) => item !== code))} aria-label={isRtl ? `حذف ${code}` : `Remove ${code}`}
              className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-primary/40 bg-primary/10 px-2 text-xs font-medium text-primary">
              <span dir="ltr">{code}</span><X size={12} />
            </button>
          ))}
        </div>
      )}
      {expanded && (
        <div className="mt-3">
          <p className="mb-2 text-xs leading-5 text-muted-foreground">
            {isRtl ? 'چند کد را انتخاب کنید یا در پرامپت «/» بنویسید. گزینه‌ها به توضیح تصویر تبدیل می‌شوند، نه دستور اختصاصی مدل.' : 'Select multiple codes or type “/” in the prompt. These are visual directions, not model-specific commands.'}
          </p>
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute start-3 top-3.5 text-muted-foreground" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
              placeholder={isRtl ? 'جست‌وجو، مثلاً /cinematic' : 'Search, e.g. /cinematic'}
              aria-label={isRtl ? 'جست‌وجوی کد تصویر' : 'Search image prompt codes'}
              className="min-h-11 w-full rounded-xl border border-border bg-background pe-3 ps-9 text-sm outline-none focus:border-primary" />
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border border-border/70 p-1.5">
            {visibleCodes.length ? (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {visibleCodes.map((item) => {
                  const selected = selectedCodes.includes(item.code);
                  return (
                    <button key={item.code} type="button" aria-pressed={selected} onClick={() => toggle(item.code)}
                      className={`flex min-h-12 min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-start transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected ? 'border-primary bg-primary/15' : 'border-border/60 bg-background/50 hover:border-primary/50'}`}>
                      <span className="min-w-0 flex-1">
                        <span dir="ltr" className="block truncate font-mono text-xs font-semibold text-primary">{item.code}</span>
                        <span className="block text-xs leading-5 text-muted-foreground">{isRtl ? item.descriptionFa : item.descriptionEn}</span>
                      </span>
                      {selected && <span className="shrink-0 text-primary" aria-hidden="true">✓</span>}
                    </button>
                  );
                })}
              </div>
            ) : <p className="p-3 text-xs text-muted-foreground">{isRtl ? 'کدی پیدا نشد.' : 'No matching codes.'}</p>}
          </div>
        </div>
      )}
    </section>
  );
}