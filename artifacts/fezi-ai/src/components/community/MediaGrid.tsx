import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { safeHref, type Media } from '../../lib/community';
import { Sheet } from './primitives';
import { cn } from '../../lib/utils';

export function MediaGrid({ media, compact, contain }: { media: Media[]; compact?: boolean; contain?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = media.filter((m) => safeHref(m.url));
  if (!items.length) return null;
  const video = items.find((m) => m.kind === 'video');
  if (video) {
    return (
      <video src={safeHref(video.url)!} controls playsInline preload="metadata" className={cn('mt-3 w-full rounded-2xl border border-border bg-background object-contain', compact ? 'max-h-64' : 'max-h-[70vh]')} data-testid={`video-media-${video.id}`} />
    );
  }
  const images = items.slice(0, 5);
  const cols = images.length === 1 ? 'grid-cols-1' : 'grid-cols-2';
  return (
    <>
      <div className={cn('mt-3 grid gap-1 overflow-hidden rounded-2xl border border-border', cols)}>
        {images.map((m, i) => (
          <button key={m.id} type="button" onClick={(e) => { e.stopPropagation(); setOpen(i); }}
            className={cn('relative block overflow-hidden bg-surface-hover focus-visible:outline-2 focus-visible:outline-ring', images.length === 1 ? (compact ? 'max-h-64' : 'max-h-[520px]') : 'aspect-square', contain && images.length === 1 && 'aspect-[4/5]', images.length === 3 && i === 0 && 'row-span-2 aspect-auto', images.length === 5 && i === 0 && 'col-span-2 aspect-[2/1]')}
            aria-label={`Image ${i + 1} of ${images.length}`} data-testid={`button-media-${m.id}`}>
            <img src={safeHref(m.url)!} alt="" loading="lazy" className={cn('h-full w-full transition-transform duration-300 hover:scale-[1.02]', contain ? 'object-contain' : 'object-cover')} />
          </button>
        ))}
      </div>
      <Sheet open={open !== null} onClose={() => setOpen(null)} title={open !== null ? `${open + 1} / ${images.length}` : ''} wide>
        {open !== null && (
          <div className="relative">
            <img src={safeHref(images[open].url)!} alt="" className="max-h-[70dvh] w-full rounded-2xl object-contain" />
            {images.length > 1 && (
              <div className="mt-3 flex justify-center gap-2" dir="ltr">
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-border" aria-label="Previous" onClick={() => setOpen((open + images.length - 1) % images.length)}><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" className="flex h-11 w-11 items-center justify-center rounded-full border border-border" aria-label="Next" onClick={() => setOpen((open + 1) % images.length)}><ChevronRight className="h-5 w-5" /></button>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </>
  );
}
