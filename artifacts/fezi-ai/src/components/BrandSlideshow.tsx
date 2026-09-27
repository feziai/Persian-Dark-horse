import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { brandArtwork } from '../lib/brand-artwork';

export interface BrandSlideshowLabels {
  artwork: string; previous: string; next: string; pause: string; resume: string;
}

export default function BrandSlideshow({ labels, testIdPrefix = 'faq' }: { labels: BrandSlideshowLabels; testIdPrefix?: string }) {
  const [slide, setSlide] = useState(() => Math.floor(Math.random() * brandArtwork.length));
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [slideRevision, setSlideRevision] = useState(0);

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    if (paused || hidden) return;
    const timer = window.setInterval(() => {
      setSlide((current) => (current + 1 + Math.floor(Math.random() * (brandArtwork.length - 1))) % brandArtwork.length);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [paused, hidden, slideRevision]);

  const moveSlide = (direction: number) => {
    setSlide((current) => (current + direction + brandArtwork.length) % brandArtwork.length);
    setSlideRevision((current) => current + 1);
  };

  const btn = 'flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
  return (
    <section aria-label={labels.artwork} className="overflow-hidden rounded-3xl border border-primary/20 bg-black">
      <div className="aspect-[3/2] w-full">
        <img src={brandArtwork[slide].url} alt={`${labels.artwork} ${slide + 1} / ${brandArtwork.length}`} className="h-full w-full object-contain" data-testid={`img-${testIdPrefix}-artwork`} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-white/20 px-3 py-2 text-white sm:px-5">
        <span className="text-xs" aria-live="off" data-testid={`text-${testIdPrefix}-slide-count`}>{slide + 1} / {brandArtwork.length}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => moveSlide(-1)} aria-label={labels.previous} data-testid={`button-${testIdPrefix}-previous`} className={btn}><ChevronLeft size={20} aria-hidden="true" /></button>
          <button type="button" onClick={() => setPaused((v) => !v)} aria-label={paused ? labels.resume : labels.pause} aria-pressed={paused} data-testid={`button-${testIdPrefix}-pause`} className={btn}>{paused ? <Play size={19} aria-hidden="true" /> : <Pause size={19} aria-hidden="true" />}</button>
          <button type="button" onClick={() => moveSlide(1)} aria-label={labels.next} data-testid={`button-${testIdPrefix}-next`} className={btn}><ChevronRight size={20} aria-hidden="true" /></button>
        </div>
      </div>
    </section>
  );
}
