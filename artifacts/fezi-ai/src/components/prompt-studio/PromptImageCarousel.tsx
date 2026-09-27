import { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';
import { useGetPromptStudioPrompt } from '@workspace/api-client-react';
import { MANIKA_PROMPT_PRESETS } from '../../lib/manika-prompt-gallery';
import { getPromptSampleImage } from '../../lib/prompt-studio-samples';
import { isAngleReferencePrompt, isReferenceOnlyPrompt } from '../../lib/picture-studio-handoff';

export type CarouselImageType = 'cover' | 'db' | 'preset' | 'dataset' | 'category';

export interface CarouselImage {
  id: string;
  url: string;
  type: CarouselImageType;
  fallbackUrl?: string;
}

interface PromptImageCarouselProps {
  promptId: string;
  promptCategory: string;
  promptText: string;
  coverImageUrl?: string;
  imageCount?: number;
  initialImages?: any[]; // Full images if available (e.g. from PromptDetail)
  isRtl: boolean;
  onImageClick?: (image: CarouselImage) => void;
  className?: string;
  disableNavigation?: boolean; // if we want to disable fetching and just show cover
}

export function PromptImageCarousel({
  promptId,
  promptCategory,
  promptText,
  coverImageUrl,
  imageCount = 0,
  initialImages,
  isRtl,
  onImageClick,
  className = '',
}: PromptImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [pendingStep, setPendingStep] = useState<-1 | 0 | 1>(0);

  // If initialImages is not provided, we lazily fetch them when isExpanded is true
  const { data: detailData, isLoading, isError, refetch } = useGetPromptStudioPrompt(promptId, {
    query: {
      queryKey: [`/api/prompt-studio/prompts/${promptId}`],
      enabled: isExpanded && !initialImages,
      staleTime: 5 * 60 * 1000,
    }
  });

  const resolvedImages = useMemo<CarouselImage[]>(() => {
    const preset = MANIKA_PROMPT_PRESETS.find(p => p.id === promptId);
    
    // Helper to get fallback
    const getFallback = (): CarouselImage => {
      const sample = getPromptSampleImage(promptId, promptCategory);
      if (sample.type === 'dataset') {
        return { id: 'dataset-sample', ...sample };
      }
      if (preset?.referenceImageUrl) {
        return { id: 'preset', url: preset.referenceImageUrl, type: 'preset' };
      }
      return { id: 'fallback', ...sample };
    };

    // If we have full images (either from props or fetched data)
    const fullImagesSource = initialImages || detailData?.prompt?.images;
    if (fullImagesSource) {
      if (fullImagesSource.length === 0) {
        return [getFallback()];
      }
      
      return fullImagesSource.map((img: any) => ({
        id: img.id || img.url,
        url: img.url,
        type: img.id === 'cover' ? 'preset' : 'db',
      }));
    }

    // If not expanded and no initialImages, show the cover summary
    if (coverImageUrl) {
      return [{ id: 'cover', url: coverImageUrl, type: 'cover' }];
    }
    
    return [getFallback()];
  }, [promptId, promptCategory, coverImageUrl, initialImages, detailData]);

  const hasAllImages = Boolean(initialImages) || Array.isArray(detailData?.prompt?.images);
  const currentImage = resolvedImages[currentIndex] || resolvedImages[0];

  // When images update and currentIndex is out of bounds, reset it
  useEffect(() => {
    if (resolvedImages.length > 0 && currentIndex >= resolvedImages.length) {
      setCurrentIndex(0);
    }
  }, [resolvedImages.length, currentIndex]);

  useEffect(() => {
    if (pendingStep === 0 || isLoading) return;
    if (isError) {
      setPendingStep(0);
      return;
    }
    if (hasAllImages && resolvedImages.length > 1) {
      setCurrentIndex((index) => (index + pendingStep + resolvedImages.length) % resolvedImages.length);
    }
    setPendingStep(0);
  }, [pendingStep, isLoading, isError, hasAllImages, resolvedImages.length]);

  const total = hasAllImages
    ? resolvedImages.length
    : Math.max(imageCount, 1);
  const showControls = total > 1;
  const categoryFallbackVisible = Boolean(currentImage?.type === 'dataset' && imageFailed && currentImage.fallbackUrl);

  const handlePrev = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExpanded && !initialImages) {
      setIsExpanded(true);
      setPendingStep(-1);
    }
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : (resolvedImages.length > 1 ? resolvedImages.length - 1 : 0)));
    setImageFailed(false);
  };

  const handleNext = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isExpanded && !initialImages) {
      setIsExpanded(true);
      setPendingStep(1);
    }
    setCurrentIndex((prev) => (prev < resolvedImages.length - 1 ? prev + 1 : 0));
    setImageFailed(false);
  };

  const isFetching = isLoading && isExpanded;

  const handleClick = (e: React.MouseEvent) => {
    if (onImageClick && currentImage) {
      e.preventDefault();
      e.stopPropagation();
      onImageClick(currentImage);
    }
  };

  return (
    <div className={`relative flex items-center justify-center bg-background overflow-hidden ${className}`}>
      {categoryFallbackVisible ? (
        <img
          src={currentImage?.fallbackUrl}
          alt={isRtl ? 'تصویر نمایشی دسته‌بندی' : 'Category illustration'}
          className="h-full w-full object-cover"
        />
      ) : currentImage && currentImage.type === 'category' && imageFailed ? (
        <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_75%_25%,hsl(var(--primary)/.23),transparent_55%),linear-gradient(145deg,hsl(var(--surface)),hsl(var(--background)))] p-6 text-center">
          <div className="space-y-3 text-primary/70">
            <ImageIcon size={30} className="mx-auto opacity-60" />
            <span className="block max-h-[4.5rem] overflow-hidden text-xs leading-6">
              {promptText.slice(0, 145)}{promptText.length > 145 ? '…' : ''}
            </span>
          </div>
        </div>
      ) : currentImage ? (
        <img 
          key={currentImage.url}
          src={currentImage.url} 
          alt={promptId === '12-women-hair-style-v1' || promptId === '12-women-hair-style' ? "Example twelve-panel women's hairstyle lookbook" : promptId === '12-men-hair-style' ? "Example twelve-panel men's hairstyle lookbook" : promptId === 'community-sheet-prompt' ? 'Example eight-section character continuity sheet' : isAngleReferencePrompt(promptId) ? `Reference sheet of ${promptId === 'every-camera-angle' || promptId === 'nine-panel-every-angle-prompt' ? 'nine' : 'twelve'} camera angles in a concrete hall` : promptText.slice(0, 50)}
          className={`h-full w-full ${promptCategory === 'thumbnails' || isReferenceOnlyPrompt(promptId) || currentImage.type === 'preset' ? 'object-contain' : 'object-cover'} transition-transform duration-500 group-hover:scale-105`}
          loading="lazy"
          onError={() => setImageFailed(true)}
          onClick={handleClick}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-surface">
          <ImageIcon size={30} className="text-muted-foreground/30" />
        </div>
      )}

      {/* Loading Overlay */}
      {isFetching && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm pointer-events-none">
          <Loader2 size={24} className="animate-spin text-primary" />
        </div>
      )}

      {/* Labels */}
      {currentImage && currentImage.type === 'dataset' && !categoryFallbackVisible && (
        <div className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm border border-white/10 pointer-events-none">
          {isRtl ? 'نمونه از DiffusionDB' : 'DiffusionDB Sample'}
        </div>
      )}
      {currentImage && (currentImage.type === 'category' || categoryFallbackVisible) && (
        <div className="absolute bottom-3 left-3 rounded bg-black/70 px-2 py-1 text-[10px] font-medium text-white/80 backdrop-blur-sm border border-white/10 pointer-events-none">
          {isRtl ? 'تصویر نمایشی دسته‌بندی' : 'Category Illustration'}
        </div>
      )}
      {isError && isExpanded && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            refetch();
          }}
          className="absolute top-3 right-3 z-20 rounded bg-red-700/90 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-white"
        >
          {isRtl ? 'تلاش دوباره' : 'Retry loading'}
        </button>
      )}

      {/* Navigation Controls */}
      {showControls && (
        <>
          <button
            onClick={isRtl ? handleNext : handlePrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur-md transition-opacity hover:bg-black/75 lg:h-8 lg:w-8 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary z-10"
            aria-label={isRtl ? 'بعدی' : 'Previous'}
          >
            <ChevronLeft size={18} className={isRtl ? 'rotate-180' : ''} />
          </button>
          <button
            onClick={isRtl ? handlePrev : handleNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white opacity-100 backdrop-blur-md transition-opacity hover:bg-black/75 lg:h-8 lg:w-8 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-primary z-10"
            aria-label={isRtl ? 'قبلی' : 'Next'}
          >
            <ChevronRight size={18} className={isRtl ? 'rotate-180' : ''} />
          </button>

          {/* Counter */}
          <div className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm pointer-events-none">
            {isFetching ? (
              <Loader2 size={10} className="animate-spin" />
            ) : (
              `${Math.min(currentIndex + 1, total)} / ${total}`
            )}
          </div>
        </>
      )}
    </div>
  );
}