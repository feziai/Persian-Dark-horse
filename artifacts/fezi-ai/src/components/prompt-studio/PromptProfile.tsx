import { useLocation } from 'wouter';
import { useTranslation } from '../../lib/i18n';
import { useGetPromptStudioProfile } from '@workspace/api-client-react';
import { ArrowLeft, UserCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button, Card } from '../ui-parts';
import PromptCard from './PromptCard';
import { publicAvatarSource } from '../../lib/avatar-options';

export default function PromptProfile({ params }: { params: { publicId: string } }) {
  const { isRtl } = useTranslation();
  const [, setLocation] = useLocation();
  const { publicId } = params;

  const { data, isLoading, isError } = useGetPromptStudioProfile(publicId);

  if (isLoading) {
    return (
      <div className="flex py-32 items-center justify-center text-primary">
        <Loader2 size={40} className="animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-xl text-center py-32 space-y-6">
        <AlertCircle size={48} className="mx-auto text-red-400 opacity-50" />
        <div>
          <h2 className="text-xl font-bold">{isRtl ? 'پروفایل یافت نشد' : 'Profile not found'}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {isRtl ? 'مشکلی در دریافت اطلاعات کاربر به وجود آمد.' : 'There was a problem loading this user profile.'}
          </p>
        </div>
        <Button variant="secondary" onClick={() => setLocation('/prompt-studio')}>
          {isRtl ? 'بازگشت به گالری' : 'Back to Gallery'}
        </Button>
      </div>
    );
  }

  const { profile, prompts } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => setLocation('/prompt-studio')} className="px-2">
          <ArrowLeft size={20} className={isRtl ? 'rotate-180' : ''} />
        </Button>
        <h1 className="text-lg font-medium text-muted-foreground">
          {publicId === 'library'
            ? (isRtl ? 'کتابخانهٔ پرامپت' : 'Prompt Library')
            : (isRtl ? 'پروفایل کاربر' : 'User Profile')}
        </h1>
      </div>

      <Card className="flex flex-col items-center justify-center p-12 text-center border-primary/10 bg-surface/30">
        {publicAvatarSource(profile.avatarId, profile.publicId) ? (
          <img src={publicAvatarSource(profile.avatarId, profile.publicId)} alt="" className="h-24 w-24 rounded-full object-cover border-4 border-background shadow-xl mb-6" />
        ) : (
          <UserCircle size={96} className="text-muted-foreground/30 mb-6" />
        )}
        <h2 className="text-2xl font-bold">{profile.displayName}</h2>
        <div className="mt-2 flex items-center gap-4 text-sm font-medium text-muted-foreground">
          <div className="px-3 py-1 rounded-full bg-background border border-border">
            <span className="text-foreground">{prompts.length}</span> {isRtl ? 'پرامپت' : 'Prompts'}
          </div>
        </div>
      </Card>

      <div className="space-y-6 pt-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          {isRtl ? 'پرامپت‌های منتشر شده' : 'Published Prompts'}
        </h3>
        
        {prompts.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface/30 p-12 text-center text-muted-foreground">
            {isRtl ? 'این کاربر هنوز پرامپتی منتشر نکرده است.' : 'This user hasn\'t published any prompts yet.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {prompts.map(prompt => (
              <PromptCard key={prompt.id} prompt={prompt} isRtl={isRtl} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
