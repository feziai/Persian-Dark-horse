import { useLocation } from 'wouter';
import { ImageIcon, MessageSquare, Sparkles, Star, UserCircle } from 'lucide-react';
import { PromptStudioPromptSummary } from '@workspace/api-client-react';
import { publicAvatarSource } from '../../lib/avatar-options';
import { MANIKA_PROMPT_PRESETS } from '../../lib/manika-prompt-gallery';
import { PromptImageCarousel } from './PromptImageCarousel';

interface PromptCardProps {
  prompt: PromptStudioPromptSummary;
  isRtl: boolean;
}

export default function PromptCard({ prompt, isRtl }: PromptCardProps) {
  const [, setLocation] = useLocation();
  const avatarUrl = publicAvatarSource(prompt.author.avatarId, prompt.author.publicId);
  const preset = MANIKA_PROMPT_PRESETS.find(item => item.id === prompt.id);
  const title = isRtl && preset ? preset.titleFa : prompt.title;
  const description = isRtl && preset ? preset.descriptionFa : prompt.description || (isRtl ? 'برای مشاهدهٔ پرامپت، کارت را باز کنید.' : 'Open to view the prompt.');
  const categoryLabel = prompt.category === 'made-by-fezi'
    ? (isRtl ? 'ساختهٔ Persian Dark Horse' : 'Made by Persian Dark Horse')
    : prompt.category === 'thumbnails'
      ? (isRtl ? 'تصاویر بندانگشتی' : 'Thumbnails')
    : prompt.category;

  return (
    <div 
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50 cursor-pointer"
      onClick={() => setLocation(`/prompt-studio/${prompt.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setLocation(`/prompt-studio/${prompt.id}`)}
    >
        <div className={`relative w-full overflow-hidden bg-background ${prompt.category === 'thumbnails' ? 'aspect-video' : 'aspect-[4/3]'}`}>
          <PromptImageCarousel
            promptId={prompt.id}
            promptCategory={prompt.category}
             promptText=""
            coverImageUrl={prompt.coverImageUrl || undefined}
            imageCount={prompt.imageCount}
            isRtl={isRtl}
            className="h-full w-full"
          />
          <div className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur-sm shadow-sm pointer-events-none">
            {categoryLabel}
          </div>
          {prompt.featured && (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-sm pointer-events-none">
              <Sparkles size={11} />
              {isRtl ? 'ویژه' : 'Featured'}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-1 font-bold text-foreground text-sm">{title}</h3>
          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
          <div
            className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
            aria-label={prompt.ratingCount
              ? `${prompt.averageRating.toFixed(1)} average from ${prompt.ratingCount} ratings`
              : isRtl ? 'بدون امتیاز' : 'No ratings yet'}
          >
            <Star size={12} className={prompt.ratingCount ? 'fill-primary text-primary' : ''} />
            {prompt.ratingCount ? `${prompt.averageRating.toFixed(1)} (${prompt.ratingCount})` : (isRtl ? 'بدون امتیاز' : 'No ratings yet')}
          </div>

          <div className="mt-auto pt-4 flex items-center justify-between">
            <div 
              className="flex items-center gap-2 truncate rounded-full hover:text-primary transition-colors cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLocation(`/prompt-studio/profile/${prompt.author.publicId}`);
              }}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-5 w-5 rounded-full object-cover bg-background border border-border" />
              ) : (
                <UserCircle size={20} className="text-muted-foreground" />
              )}
              <span className="truncate text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {prompt.author.displayName}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-3 text-[11px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-md border border-border/50">
                <ImageIcon size={12} /> {prompt.imageCount || 0}
              </span>
              <span className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-md border border-border/50">
                <MessageSquare size={12} /> {prompt.commentCount || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
  );
}
