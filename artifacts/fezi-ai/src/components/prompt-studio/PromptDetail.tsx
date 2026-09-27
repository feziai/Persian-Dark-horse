import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useTranslation } from '../../lib/i18n';
import { useGetPromptStudioPrompt, useCreatePromptStudioComment, useDeletePromptStudioComment, useRatePromptStudioPrompt } from '@workspace/api-client-react';
import { useAuth, useUser } from '@clerk/react';
import { requestGuestAccount } from '../../lib/auth-gate';
import { unlockStudioPrompt, type UnlockPromptResult } from '../../lib/prompt-studio-actions';
import { MANIKA_PROMPT_PRESETS } from '../../lib/manika-prompt-gallery';
import { publicAvatarSource } from '../../lib/avatar-options';
import { ArrowLeft, Copy, WandSparkles, UserCircle, MessageSquare, Image as ImageIcon, Loader2, AlertCircle, Upload, Trash2, Calendar, Star } from 'lucide-react';
import { Button, Card, Textarea, Label } from '../ui-parts';
import { useQueryClient } from '@tanstack/react-query';
import { PromptImageCarousel } from './PromptImageCarousel';
import { handoffToPictureStudio, isAngleReferencePrompt } from '../../lib/picture-studio-handoff';

export default function PromptDetail({ params }: { params: { id: string } }) {
  const { isRtl } = useTranslation();
  const [, setLocation] = useLocation();
  const { id } = params;
  const { user } = useUser();
  const { getToken } = useAuth();
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [unlocking, setUnlocking] = useState<'copy' | 'use' | null>(null);
  const [unlockError, setUnlockError] = useState('');
  const [copyError, setCopyError] = useState('');
  const [unlocked, setUnlocked] = useState<Partial<Record<'copy' | 'use', UnlockPromptResult>> & { id?: string }>({});
  const [commentBody, setCommentBody] = useState('');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, isError } = useGetPromptStudioPrompt(id);

  const createComment = useCreatePromptStudioComment();
  const deleteComment = useDeletePromptStudioComment();
  const ratePrompt = useRatePromptStudioPrompt();

  if (isLoading) {
    return <div className="flex py-32 items-center justify-center text-primary"><Loader2 size={40} className="animate-spin" /></div>;
  }

  if (isError || !data?.prompt) {
    return (
      <div className="mx-auto max-w-xl text-center py-32 space-y-6">
        <AlertCircle size={48} className="mx-auto text-red-400 opacity-50" />
        <div>
          <h2 className="text-xl font-bold">{isRtl ? 'پرامپت یافت نشد' : 'Prompt not found'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRtl ? 'ممکن است حذف شده باشد یا آدرس اشتباه باشد.' : 'It may have been deleted or the URL is incorrect.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setLocation('/prompt-studio')}>
          {isRtl ? 'بازگشت به گالری' : 'Back to Gallery'}
        </Button>
      </div>
    );
  }

  const { prompt } = data;
  const preset = MANIKA_PROMPT_PRESETS.find(p => p.id === prompt.id);
  const coverUrl = preset?.referenceImageUrl || (prompt as any).coverImageUrl;
  const displayTitle = isRtl && preset ? preset.titleFa : prompt.title;
  const displayDescription = isRtl && preset ? preset.descriptionFa : prompt.description;

  const images = (prompt.images || []) as any[];
  const comments = (prompt.comments || []) as any[];

  // Keep real generated/uploads first and don't add an unrelated preset reference
  // to a prompt that already has its own published results.
  const allImages = [...images];
  if (
    images.length === 0
    && !prompt.id.startsWith('diffusiondb-')
    && coverUrl
    && !allImages.some(img => img.url === coverUrl)
  ) {
    allImages.unshift({ id: 'cover', url: coverUrl });
  }

  const getUnlocked = async (action: 'copy' | 'use') => {
    if (unlocked.id === prompt.id && (unlocked.copy?.promptText || unlocked.use?.promptText)) return (unlocked.copy || unlocked.use)!;
    const result = await unlockStudioPrompt(prompt.id, action, getToken);
    if (!result.promptText) throw new Error('Empty unlocked prompt');
    setUnlocked(current => ({ ...(current.id === prompt.id ? current : {}), id: prompt.id, [action]: result }));
    return result;
  };

  const copyPrompt = async () => {
    if (unlocking) return;
    if (!user) {
      requestGuestAccount(isRtl ? 'برای کپی پرامپت وارد حساب شوید.' : 'Sign in to copy this prompt.');
      return;
    }
    setUnlocking('copy');
    setUnlockError('');
    setCopyError('');
    try {
      const result = await getUnlocked('copy');
      try {
        await navigator.clipboard.writeText(result.promptText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        setCopyError(isRtl ? 'کپی انجام نشد. دوباره امتحان کنید.' : 'Clipboard failed. Try copying again.');
      }
    } catch (cause) {
      setUnlockError(cause instanceof Error ? cause.message : (isRtl ? 'باز کردن پرامپت ناموفق بود.' : 'Could not load the prompt.'));
    } finally {
      setUnlocking(null);
    }
  };

  const submitRating = (rating: number) => {
    if (!user) {
      requestGuestAccount(isRtl ? 'برای امتیاز دادن وارد حساب خود شوید.' : 'Sign in to rate this prompt.');
      return;
    }
    ratePrompt.mutate({ id: prompt.id, data: { rating } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/prompt-studio/prompts/${prompt.id}`] });
        queryClient.invalidateQueries({ queryKey: ['/api/prompt-studio/prompts'] });
      },
    });
  };

  const useInStudio = async () => {
    if (unlocking) return;
    if (!user) {
      requestGuestAccount(isRtl ? 'برای استفاده از پرامپت وارد حساب شوید.' : 'Sign in to use this prompt.');
      return;
    }
    setUnlocking('use');
    setUnlockError('');
    let text: string;
    try {
      text = (await getUnlocked('use')).promptText;
    } catch (cause) {
      setUnlockError(cause instanceof Error ? cause.message : (isRtl ? 'باز کردن پرامپت ناموفق بود.' : 'Could not load the prompt.'));
      setUnlocking(null);
      return;
    }
    await handoffToPictureStudio(prompt.id, prompt.title, text, coverUrl);
    setUnlocking(null);
    setLocation('/studio/image');
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      requestGuestAccount('comment');
      return;
    }
    if (!commentBody.trim()) return;
    
    createComment.mutate({
      id: prompt.id,
      data: { body: commentBody.trim() }
    }, {
      onSuccess: () => {
        setCommentBody('');
        queryClient.invalidateQueries({ queryKey: [`/api/prompt-studio/prompts/${prompt.id}`] });
      }
    });
  };

  const handleDeleteComment = (commentId: string) => {
    if (!window.confirm(isRtl ? 'آیا از حذف این نظر اطمینان دارید؟' : 'Are you sure you want to delete this comment?')) return;
    deleteComment.mutate({ id: commentId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [`/api/prompt-studio/prompts/${prompt.id}`] });
      }
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!user) {
      requestGuestAccount('upload_image');
      return;
    }
    
    if (file.size > 8 * 1024 * 1024) {
      setUploadError(isRtl ? 'حجم تصویر نباید بیشتر از 8 مگابایت باشد.' : 'Image size must be less than 8MB.');
      return;
    }
    
    setIsUploading(true);
    setUploadError(null);
    try {
      const res = await fetch(`/api/prompt-studio/prompts/${prompt.id}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
        },
        credentials: 'include',
        body: file
      });
      if (!res.ok) throw new Error('Upload failed');
      
      queryClient.invalidateQueries({ queryKey: [`/api/prompt-studio/prompts/${prompt.id}`] });
    } catch (err) {
      setUploadError(isRtl ? 'آپلود تصویر با خطا مواجه شد.' : 'Image upload failed.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderPromptHeading = (className: string) => (
    <div className={className}>
      <h1 className="text-3xl font-bold leading-tight text-foreground md:text-4xl">{displayTitle}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div
          className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 transition-colors hover:border-primary/50"
          onClick={() => setLocation(`/prompt-studio/profile/${prompt.author.publicId}`)}
        >
          {publicAvatarSource(prompt.author.avatarId, prompt.author.publicId) ? (
            <img src={publicAvatarSource(prompt.author.avatarId, prompt.author.publicId)} alt="" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <UserCircle size={24} className="text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">{prompt.author.displayName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar size={14} />
          {new Date(prompt.createdAt).toLocaleDateString()}
        </div>
      </div>
      {displayDescription && (
        <p className="mt-6 break-words text-base leading-relaxed text-muted-foreground">
          {displayDescription}
        </p>
      )}
    </div>
  );

  return (
    <div className="min-w-0 space-y-8">
      <div className="flex items-center gap-4 mb-4">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/prompt-studio')} className="px-2">
          <ArrowLeft size={20} className={isRtl ? 'rotate-180' : ''} />
        </Button>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-surface px-2.5 py-1 rounded-full border border-border">
          {prompt.category === 'made-by-fezi'
            ? (isRtl ? 'ساختهٔ Persian Dark Horse' : 'Made by Persian Dark Horse')
            : prompt.category === 'thumbnails'
              ? (isRtl ? 'تصاویر بندانگشتی' : 'Thumbnails')
            : prompt.category}
        </span>
      </div>

      {renderPromptHeading('lg:hidden')}

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* Main Content */}
        <div className="order-2 min-w-0 space-y-8 lg:order-1">
          <div className="hidden lg:block">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground leading-tight">{displayTitle}</h1>
            <div className="mt-4 flex items-center gap-4 flex-wrap">
              <div 
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => setLocation(`/prompt-studio/profile/${prompt.author.publicId}`)}
              >
                {publicAvatarSource(prompt.author.avatarId, prompt.author.publicId) ? (
                  <img src={publicAvatarSource(prompt.author.avatarId, prompt.author.publicId)} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                  <UserCircle size={24} className="text-muted-foreground" />
                )}
                <span className="text-sm font-medium text-foreground">{prompt.author.displayName}</span>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar size={14} />
                {new Date(prompt.createdAt).toLocaleDateString()}
              </div>
            </div>
            
            {displayDescription && (
              <p className="mt-6 break-words text-base leading-relaxed text-muted-foreground">
                {displayDescription}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isRtl ? 'امتیاز کاربران' : 'Community rating'}
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {prompt.ratingCount
                  ? `${prompt.averageRating.toFixed(1)} / 5 · ${prompt.ratingCount} ${isRtl ? 'امتیاز' : (prompt.ratingCount === 1 ? 'rating' : 'ratings')}`
                  : (isRtl ? 'هنوز امتیازی ثبت نشده' : 'No ratings yet')}
              </p>
            </div>
            <div
              className="flex items-center gap-1"
              role="group"
              aria-label={isRtl ? 'ثبت امتیاز از یک تا پنج ستاره' : 'Rate this prompt from one to five stars'}
            >
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  aria-label={isRtl ? `${rating} از ۵ ستاره` : `${rating} out of 5 stars`}
                  aria-pressed={prompt.viewerRating === rating}
                  title={isRtl ? `${rating} از ۵` : `${rating} of 5`}
                  disabled={ratePrompt.isPending}
                  onClick={() => submitRating(rating)}
                  className="flex h-10 w-10 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/10 disabled:cursor-wait disabled:opacity-50"
                >
                  <Star
                    size={20}
                    fill={prompt.viewerRating !== null && rating <= prompt.viewerRating ? 'currentColor' : 'none'}
                  />
                </button>
              ))}
            </div>
          </div>
          {ratePrompt.isError && (
            <p role="alert" className="text-sm text-red-400">
              {isRtl ? 'ثبت امتیاز ناموفق بود. دوباره تلاش کنید.' : 'Could not save your rating. Please try again.'}
            </p>
          )}

          <Card className="overflow-hidden border-primary/20">
            <div className="bg-surface/50 px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {isRtl ? 'متن پرامپت' : 'Prompt Text'}
              </span>
               <Button data-testid="button-copy-gallery-prompt" variant="ghost" size="sm" disabled={!!unlocking} onClick={copyPrompt} className="h-8 gap-2 text-primary hover:text-primary hover:bg-primary/10">
                 <Copy size={14} /> {unlocking === 'copy' ? (isRtl ? 'در حال بارگذاری...' : 'Loading...') : copied ? (isRtl ? 'کپی شد' : 'Copied') : (isRtl ? 'کپی رایگان' : 'Copy for free')}
              </Button>
            </div>
            <div className="break-words p-5 font-mono text-sm leading-relaxed whitespace-pre-wrap bg-background text-foreground/90">
               {prompt.promptText || (unlocked.id === prompt.id && (unlocked.copy?.promptText || unlocked.use?.promptText))
                 ? (prompt.promptText || unlocked.copy?.promptText || unlocked.use?.promptText)
                 : (isRtl ? 'برای دیدن متن، کپی یا استفاده را انتخاب کنید.' : 'Choose Copy or Use to view the full prompt.')}
            </div>
             <div className="p-4 bg-surface/30 border-t border-border space-y-3">
               <p className="text-xs leading-5 text-muted-foreground">{isRtl ? 'کپی و استفاده از پرامپت‌های آماده رایگان است. ساخت تصویر یا ویدیو هزینهٔ جداگانه دارد.' : 'Prepared prompts are free to copy and use. Image and video generation are charged separately.'}</p>
               {unlockError && <p data-testid="status-gallery-unlock-error" role="alert" className="text-sm text-red-400">{unlockError}</p>}
               {copyError && <p role="alert" className="text-sm text-red-400">{copyError}</p>}
               <div className="flex justify-end"><Button data-testid="button-use-gallery-prompt" disabled={!!unlocking} onClick={useInStudio} className="gap-2 px-6">
                 <WandSparkles size={16} /> {unlocking === 'use' ? (isRtl ? 'در حال بارگذاری...' : 'Loading...') : (isRtl ? 'استفادهٔ رایگان در استودیو' : 'Use in Studio for free')}
              </Button>
               </div>
            </div>
          </Card>

          {/* Comments Section */}
          <div className="pt-8 border-t border-border">
            <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
              <MessageSquare size={20} className="text-primary" />
              {isRtl ? 'نظرات' : 'Comments'} 
              <span className="text-sm font-normal text-muted-foreground">({comments.length})</span>
            </h3>

            <div className="space-y-6">
              <form onSubmit={submitComment} className="min-w-0">
                <div className="min-w-0 space-y-3">
                  <Textarea 
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder={isRtl ? 'نظر خود را بنویسید...' : 'Write your comment...'}
                    className="h-24 w-full min-w-0"
                    disabled={createComment.isPending}
                    maxLength={1000}
                  />
                  {createComment.isError && (
                    <p role="alert" className="text-xs text-red-400">
                      {isRtl ? 'ثبت نظر ناموفق بود. دوباره تلاش کنید.' : 'Could not post your comment. Please try again.'}
                    </p>
                  )}
                   <div className="flex justify-stretch sm:justify-end">
                     <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={createComment.isPending || (!user && !commentBody.trim())} size="sm">
                      {createComment.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      {user ? (isRtl ? 'ثبت نظر' : 'Post Comment') : (isRtl ? 'ورود برای ثبت نظر' : 'Sign in to Comment')}
                    </Button>
                  </div>
                </div>
              </form>

              <div className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-4 p-4 rounded-2xl bg-surface/50 border border-border">
                    <div 
                      className="shrink-0 cursor-pointer"
                      onClick={() => setLocation(`/prompt-studio/profile/${comment.author.publicId}`)}
                    >
                      {publicAvatarSource(comment.author.avatarId, comment.author.publicId) ? (
                        <img src={publicAvatarSource(comment.author.avatarId, comment.author.publicId)} alt="" className="h-10 w-10 rounded-full object-cover border border-border" />
                      ) : (
                        <UserCircle size={40} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span 
                            className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
                            onClick={() => setLocation(`/prompt-studio/profile/${comment.author.publicId}`)}
                          >
                            {comment.author.displayName}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(comment.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {comment.canDelete && (
                          <button 
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-muted-foreground hover:text-red-400 transition-colors p-1"
                            title={isRtl ? 'حذف' : 'Delete'}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                        {comment.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Images */}
        <div className="order-1 min-w-0 space-y-6 lg:order-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <ImageIcon size={18} className="text-primary" />
              {isRtl ? 'تصاویر' : 'Images'}
              <span className="text-sm font-normal text-muted-foreground">({allImages.length})</span>
            </h3>
            
            {prompt.category !== 'made-by-fezi' && (
              <>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoUpload}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => {
                    if (!user) requestGuestAccount('upload_image');
                    else fileInputRef.current?.click();
                  }}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {isRtl ? 'آپلود تصویر' : 'Upload'}
                </Button>
              </>
            )}
          </div>

          {prompt.category !== 'made-by-fezi' && uploadError && (
            <div className="p-3 text-xs text-red-400 bg-red-900/10 border border-red-900/30 rounded-xl flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" /> {uploadError}
            </div>
          )}
          {prompt.category !== 'made-by-fezi' && (
            <p className="text-xs leading-5 text-muted-foreground">
              {isRtl ? 'تصویری که آپلود می‌کنید با نام نمایشی و پروفایل شما برای همه قابل دیدن خواهد بود.' : 'Uploaded images will be visible to everyone alongside your display name and profile.'}
            </p>
          )}

          <div className="rounded-2xl overflow-hidden border border-border ring-1 ring-border/50">
            <PromptImageCarousel
              promptId={prompt.id}
              promptCategory={prompt.category}
               promptText={unlocked.id === prompt.id ? (unlocked.copy?.promptText || unlocked.use?.promptText || '') : ''}
              initialImages={allImages}
              isRtl={isRtl}
              className={prompt.id === '12-women-hair-style-v1' || prompt.id === '12-women-hair-style' || prompt.id === '12-men-hair-style' || prompt.id === 'community-sheet-prompt' || prompt.id === 'twelve-panel-version-of-every-angle' || prompt.id === 'twelve-panel-every-angle-v2' || prompt.id === 'nine-panel-every-angle-prompt' ? 'aspect-[3/4] w-full' : isAngleReferencePrompt(prompt.id) ? 'aspect-[2/3] w-full' : prompt.category === 'thumbnails' ? 'aspect-video w-full' : 'aspect-square w-full'}
              onImageClick={(image) => {
                if (image.type !== 'category') {
                  window.open(image.url, '_blank');
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
