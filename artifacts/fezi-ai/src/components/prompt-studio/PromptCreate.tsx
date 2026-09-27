import { useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { Upload, Image as ImageIcon, Loader2, AlertCircle, WandSparkles } from 'lucide-react';
import { useTranslation } from '../../lib/i18n';
import { PageHeader, Button, Input, Textarea, Label, Card } from '../ui-parts';
import { useCreatePromptStudioPrompt, PromptStudioPromptInputCategory } from '@workspace/api-client-react';
import { useAuth } from '@clerk/react';

const CATEGORIES = [
  { id: 'realistic', labelEn: 'Realistic', labelFa: 'واقع‌گرایانه' },
  { id: 'cartoon', labelEn: 'Cartoon', labelFa: 'کارتونی' },
  { id: 'cinematic', labelEn: 'Cinematic', labelFa: 'سینمایی' },
  { id: 'modeling', labelEn: 'Modeling', labelFa: 'مدلینگ' },
  { id: 'disney', labelEn: 'Disney', labelFa: 'دیزنی' },
  { id: 'games', labelEn: 'Games', labelFa: 'بازی' },
  { id: 'thumbnails', labelEn: 'Thumbnails', labelFa: 'تصاویر بندانگشتی' },
  { id: 'made-by-fezi', labelEn: 'Made by Persian Dark Horse', labelFa: 'ساختهٔ Persian Dark Horse' }
];

export default function PromptCreate() {
  const { isRtl } = useTranslation();
  const [, setLocation] = useLocation();
  const { getToken } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [promptText, setPromptText] = useState('');
  const [category, setCategory] = useState<PromptStudioPromptInputCategory>('realistic');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const createPrompt = useCreatePromptStudioPrompt();
  
  const [createdPromptId, setCreatedPromptId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [announcementError, setAnnouncementError] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 8 * 1024 * 1024) {
        setFormError(isRtl ? 'حجم تصویر نباید بیشتر از 8 مگابایت باشد.' : 'Image size must be less than 8MB.');
        return;
      }
      setPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setFormError(null);
    }
  };

  const uploadPhoto = async (promptId: string, file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/prompt-studio/prompts/${promptId}/images`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: file
      });
      if (!res.ok) throw new Error('Upload failed');
      setPhotoUploaded(true);
      const result = await res.json() as { communityPostError?: boolean };
      if (result.communityPostError) {
        setAnnouncementError(true);
        return;
      }
      setLocation(`/prompt-studio/${promptId}`);
    } catch {
      setUploadError(isRtl ? 'آپلود تصویر با خطا مواجه شد.' : 'Image upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const retryAnnouncement = async (promptId: string) => {
    setIsUploading(true);
    try {
      const token = await getToken();
      const res = await fetch(`/api/prompt-studio/prompts/${encodeURIComponent(promptId)}/community-post`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Community post failed');
      setAnnouncementError(false);
      setLocation(`/prompt-studio/${promptId}`);
    } catch {
      setAnnouncementError(true);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !promptText.trim() || promptText.trim().length > 3000 || !photo) {
      setFormError(isRtl ? 'عنوان، متن پرامپت و تصویر نمونه الزامی‌اند؛ متن باید حداکثر ۳۰۰۰ نویسه باشد.' : 'Title, prompt text, and an example image are required; prompt text must be at most 3,000 characters.');
      return;
    }

    setFormError(null);
    
    // If prompt is already created but upload failed previously
    if (createdPromptId) {
      if (photoUploaded) await retryAnnouncement(createdPromptId);
      else await uploadPhoto(createdPromptId, photo);
      return;
    }

    createPrompt.mutate({
      data: {
        title: title.trim(),
        description: description.trim(),
        promptText: promptText.trim(),
        category
      }
    }, {
      onSuccess: (data) => {
        setCreatedPromptId(data.prompt.id);
        void uploadPhoto(data.prompt.id, photo);
      },
      onError: () => {
        setFormError(isRtl ? 'ثبت پرامپت انجام نشد. ایمیل اصلی خود را تأیید کنید و دوباره تلاش کنید.' : 'Could not submit prompt. Verify your primary email and try again.');
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title={isRtl ? 'ثبت پرامپت جدید' : 'Submit New Prompt'}
        description={isRtl ? 'پرامپت خود را با جامعه کاربران به اشتراک بگذارید.' : 'Share your prompt with the community.'}
        action={
          <Button variant="ghost" onClick={() => setLocation('/prompt-studio')}>
            {isRtl ? 'بازگشت' : 'Cancel'}
          </Button>
        }
      />

      <Card>
        <p className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm leading-6 text-muted-foreground">
          {isRtl
            ? 'پرامپت، تصویر نمونه، نام نمایشی و تصویر پروفایل شما در گالری عمومی خواهند بود و به‌صورت خودکار در انجمن منتشر می‌شوند. تصویر نمونه و ایمیل تأییدشده الزامی است. خروجی‌هایی که با این پرامپت در استودیو ساخته شوند نیز عمومی هستند.'
            : 'Your prompt, example image, display name, and profile avatar will be public in the gallery and automatically posted to Community. A verified email and example image are required. Images generated from this prompt in Studio will also be public.'}
        </p>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <Label>{isRtl ? 'تصویر نمونه (الزامی)' : 'Example Image (Required)'}</Label>
            <p className="text-xs text-muted-foreground mb-4">
              {isRtl 
                ? 'نمایانگر خروجی این پرامپت. حداکثر 8 مگابایت (JPEG/PNG/WebP).'
                : 'Shows the output of this prompt. Max 8MB (JPEG/PNG/WebP).'}
            </p>
            
            <div 
              className={`relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all hover:bg-surface/50 ${
                photoPreview ? 'border-primary/50' : 'border-border'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {photoPreview ? (
                <>
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <Upload size={16} /> {isRtl ? 'تغییر تصویر' : 'Change Image'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <div className="rounded-full bg-surface p-4">
                    <ImageIcon size={32} />
                  </div>
                  <span className="text-sm font-medium">
                    {isRtl ? 'برای آپلود تصویر کلیک کنید' : 'Click to upload image'}
                  </span>
                </div>
              )}
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/jpeg,image/png,image/webp" 
              onChange={handlePhotoChange}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>{isRtl ? 'عنوان پرامپت' : 'Prompt Title'}</Label>
              <Input 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                placeholder={isRtl ? 'مثلا: پرتره سایبرپانک...' : 'e.g., Cyberpunk Portrait...'}
                disabled={!!createdPromptId || createPrompt.isPending}
                maxLength={140}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>{isRtl ? 'دسته‌بندی' : 'Category'}</Label>
              <select
                className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
                value={category}
                onChange={(e) => setCategory(e.target.value as PromptStudioPromptInputCategory)}
                disabled={!!createdPromptId || createPrompt.isPending}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{isRtl ? cat.labelFa : cat.labelEn}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{isRtl ? 'توضیحات (اختیاری)' : 'Description (Optional)'}</Label>
              <Textarea 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder={isRtl ? 'توضیح کوتاهی درباره این پرامپت...' : 'A short description about this prompt...'}
                className="h-20"
                disabled={!!createdPromptId || createPrompt.isPending}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>{isRtl ? 'متن پرامپت' : 'Prompt Text'}</Label>
              <Textarea 
                value={promptText} 
                onChange={(e) => setPromptText(e.target.value)} 
                placeholder={isRtl ? 'متن اصلی پرامپت به زبان انگلیسی...' : 'The actual prompt text in English...'}
                className="h-40 font-mono text-xs"
                disabled={!!createdPromptId || createPrompt.isPending}
                maxLength={3000}
                required
              />
            </div>
          </div>

          {formError && (
            <div className="rounded-xl border border-red-900/30 bg-red-900/10 p-3 text-sm text-red-400 flex items-center gap-2">
              <AlertCircle size={16} /> {formError}
            </div>
          )}

          {uploadError && (
            <div className="rounded-xl border border-red-900/30 bg-red-900/10 p-4 text-sm text-red-400">
              <div className="flex items-center gap-2 mb-2 font-medium">
                <AlertCircle size={16} /> {uploadError}
              </div>
              <p className="text-xs mb-3">{isRtl ? 'پرامپت شما ثبت شد اما تصویر آپلود نشد. دوباره تلاش کنید.' : 'Your prompt was created but the image failed to upload. Try again.'}</p>
              <Button type="button" size="sm" variant="danger" onClick={() => uploadPhoto(createdPromptId!, photo!)} disabled={isUploading}>
                {isUploading ? <Loader2 size={14} className="animate-spin mr-2"/> : <Upload size={14} />} 
                {isRtl ? 'تلاش مجدد آپلود' : 'Retry Upload'}
              </Button>
            </div>
          )}

          {announcementError && (
            <div className="rounded-xl border border-red-900/30 bg-red-900/10 p-4 text-sm text-red-400" data-testid="status-community-announcement-error">
              <p className="mb-3">{isRtl ? 'پرامپت و تصویر ذخیره شدند اما پست انجمن منتشر نشد. دوباره تلاش کنید.' : 'Your prompt and image were saved, but the Community post failed. Please retry.'}</p>
              <Button type="button" size="sm" variant="danger" onClick={() => createdPromptId && void retryAnnouncement(createdPromptId)} disabled={isUploading} data-testid="button-retry-community-announcement">
                {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {isRtl ? 'تلاش دوباره برای انتشار' : 'Retry Community post'}
              </Button>
            </div>
          )}
          <div className="pt-4 border-t border-border flex justify-end">
            <Button 
              type="submit" 
              disabled={createPrompt.isPending || isUploading}
              className="min-w-[150px]"
            >
              {(createPrompt.isPending || isUploading) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <WandSparkles size={16} />
              )}
              {isUploading 
                ? (isRtl ? 'در حال آپلود...' : 'Uploading...') 
                : createPrompt.isPending 
                  ? (isRtl ? 'در حال ثبت...' : 'Submitting...')
                  : (isRtl ? 'ثبت پرامپت' : 'Submit Prompt')}
            </Button>
          </div>
        </form>
      </Card>

      <div className="text-center text-xs text-muted-foreground/60">
        {isRtl 
          ? 'تمامی پرامپت‌ها و تصاویر آپلود شده به صورت عمومی در گالری جامعه کاربران نمایش داده می‌شوند.' 
          : 'All submitted prompts and uploaded images will be publicly visible in the community gallery.'}
      </div>
    </div>
  );
}
