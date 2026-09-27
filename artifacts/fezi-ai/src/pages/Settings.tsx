import { useEffect, useState } from 'react';
import { useUser } from '@clerk/react';
import { useLocalStore } from '../lib/store';
import { useTranslation } from '../lib/i18n';
import { PageHeader, Card, Button, Input, Label, Textarea } from '../components/ui-parts';
import { Brain, Check, Clock, CreditCard, FileText, Moon, Pencil, Save, Sun, Trash2, Upload, X } from 'lucide-react';
import { useAccount } from '../lib/account';
import { accountAvatarSource, avatarOptions, defaultFeziAvatar } from '../lib/avatar-options';
import { RewardTasks } from '../components/RewardTasks';
import { randomSuggestedName } from '../lib/suggested-names';

export function ProfilePage() {
  const { t, isRtl } = useTranslation();
  const { user } = useUser();
  const { account, isLoading, saveProfile, clearProfile, saveMemory, updateMemory, deleteMemory } = useAccount();
  const { profile: localProfile, setProfile } = useLocalStore();
  const serverProfile = account?.profile;
  const [formData, setFormData] = useState({
    name: '',
    avatarId: '',
    bio: '',
    lifeStage: '',
    occupation: '',
    valuesText: '',
    interestsText: '',
    customInstructions: '',
    interactionStyle: '',
  });
  const [suggestedName, setSuggestedName] = useState(randomSuggestedName);
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameFeedback, setUsernameFeedback] = useState('');
  const [usernameSaved, setUsernameSaved] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const [memoryDraft, setMemoryDraft] = useState('');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editingMemoryText, setEditingMemoryText] = useState('');
  const [membershipDays, setMembershipDays] = useState<number | null>(null);

  useEffect(() => {
    if (!serverProfile) return;
    setFormData({
      name: serverProfile.displayName,
      avatarId: serverProfile.avatarId,
      bio: serverProfile.bio,
      lifeStage: serverProfile.lifeStage,
      occupation: serverProfile.occupation,
      valuesText: serverProfile.valuesText,
      interestsText: serverProfile.interestsText,
      customInstructions: serverProfile.customInstructions,
      interactionStyle: serverProfile.interactionStyle,
    });
    setUsernameDraft(serverProfile.username || '');
  }, [serverProfile]);

  useEffect(() => {
    const joinedAt = user?.createdAt;
    if (!joinedAt) {
      setMembershipDays(null);
      return;
    }
    const updateMembershipDays = () => {
      const joinedDate = new Date(joinedAt);
      const today = new Date();
      const startOfToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      const startOfJoinDay = Date.UTC(joinedDate.getUTCFullYear(), joinedDate.getUTCMonth(), joinedDate.getUTCDate());
      setMembershipDays(Math.max(0, Math.floor((startOfToday - startOfJoinDay) / 86_400_000)));
    };
    updateMembershipDays();
    const timer = window.setInterval(updateMembershipDays, 60_000);
    return () => window.clearInterval(timer);
  }, [user?.createdAt]);

  const save = async () => {
    setSaveError(false);
    try {
      await saveProfile({
        displayName: formData.name,
        avatarId: formData.avatarId,
        bio: formData.bio,
        lifeStage: formData.lifeStage,
        occupation: formData.occupation,
        valuesText: formData.valuesText,
        interestsText: formData.interestsText,
        customInstructions: formData.customInstructions,
        interactionStyle: formData.interactionStyle,
      });
      setProfile({ name: formData.name, bio: formData.bio, email: user?.primaryEmailAddress?.emailAddress || localProfile.email });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaved(false);
      setSaveError(true);
    }
  };

  const saveUsername = async () => {
    setUsernameFeedback('');
    setUsernameSaved(false);
    if (!/^[A-Za-z0-9_]{4,20}$/.test(usernameDraft)) {
      setUsernameFeedback(isRtl
        ? 'نام کاربری باید ۴ تا ۲۰ نویسه و فقط شامل حروف انگلیسی، عدد یا زیرخط باشد.'
        : 'Username must be 4–20 characters and use only ASCII letters, digits, or underscores.');
      return;
    }
    try {
      await saveProfile({ username: usernameDraft });
      setUsernameSaved(true);
      window.setTimeout(() => setUsernameSaved(false), 2000);
    } catch (error) {
      setUsernameFeedback(error instanceof Error
        ? error.message
        : (isRtl ? 'این نام کاربری در دسترس نیست.' : 'That username is not available.'));
    }
  };

  const clearPersonalDetails = async () => {
    setClearing(true);
    setSaveError(false);
    try {
      await clearProfile();
      setFormData({ name: '', avatarId: '', bio: '', lifeStage: '', occupation: '', valuesText: '', interestsText: '', customInstructions: '', interactionStyle: '' });
      setProfile({ name: '', bio: '', email: localProfile.email });
    } catch {
      setSaveError(true);
    } finally {
      setClearing(false);
    }
  };

  const uploadProfileImage = async (file: File | undefined) => {
    if (!file || !user) return;
    setAvatarError('');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setAvatarError(isRtl ? 'یک تصویر PNG، JPG یا WebP کوچک‌تر از ۵ مگابایت انتخاب کنید.' : 'Choose a PNG, JPG or WebP image smaller than 5 MB.');
      return;
    }
    setAvatarBusy(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      setFormData((current) => ({ ...current, avatarId: 'account-photo' }));
      await saveProfile({ avatarId: 'account-photo' });
    } catch {
      setAvatarError('The profile image could not be updated. Please try again.');
    } finally {
      setAvatarBusy(false);
    }
  };

  const addMemory = async () => {
    const content = memoryDraft.trim();
    if (content.length < 3) return;
    await saveMemory(content, 'profile');
    setMemoryDraft('');
  };

  const saveEditedMemory = async () => {
    if (!editingMemoryId) return;
    const content = editingMemoryText.trim();
    if (content.length < 3) return;
    await updateMemory(editingMemoryId, content);
    setEditingMemoryId(null);
    setEditingMemoryText('');
  };

  const selectedAvatar = accountAvatarSource(formData.avatarId, user) || defaultFeziAvatar;

  return (
     <div className="fade-up mx-auto max-w-4xl min-w-0 space-y-6">
      <PageHeader title={t('profile_title')} description={t('profile_desc')} />
      {saveError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">Profile changes could not be saved. Please try again.</p>}
      <Card className="space-y-6">
        {isLoading && <p className="text-sm text-muted-foreground">Loading account profile…</p>}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
           <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
             <img src={selectedAvatar} alt="Profile avatar" className="h-20 w-20 shrink-0 rounded-3xl border border-primary/30 object-cover shadow-lg sm:h-24 sm:w-24" />
            <div className="min-w-0 flex-1">
                <p className="break-words text-xl font-bold tracking-tight sm:text-2xl">{formData.name.trim() || user?.fullName?.trim() || (isRtl ? 'نام شما' : 'Your name')}</p>
                {(serverProfile?.username || usernameDraft) && <p className="mt-0.5 text-sm font-medium text-primary">@{serverProfile?.username || usernameDraft}</p>}
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {isRtl ? 'این نام و آواتار در فضای کاری شما نمایش داده می‌شود.' : 'This name and avatar appear across your workspace.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                 <label className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/40 bg-background px-3 py-2 text-xs font-semibold text-primary focus-within:ring-2 focus-within:ring-primary ${avatarBusy ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-primary/10'}`}>
                  <Upload size={15} /> {avatarBusy ? (isRtl ? 'در حال بارگذاری…' : 'Uploading…') : (isRtl ? 'بارگذاری تصویر' : 'Upload image')}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={avatarBusy || !user} aria-label={isRtl ? 'بارگذاری تصویر پروفایل' : 'Upload profile image'} onChange={(event) => { void uploadProfileImage(event.target.files?.[0]); event.currentTarget.value = ''; }} />
                </label>
                  {accountAvatarSource('account-photo', user) && formData.avatarId !== 'account-photo' && <button type="button" onClick={() => setFormData((current) => ({ ...current, avatarId: 'account-photo' }))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground hover:border-primary/50"><X size={14} /> {isRtl ? 'استفاده از عکس حساب' : 'Use account photo'}</button>}
              </div>
            </div>
          </div>
          <div className="mt-5">
            <Label>{t('name')}</Label>
            <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder={isRtl ? `پیشنهاد: ${suggestedName}` : `Suggested: ${suggestedName}`} maxLength={120} />
            <p className="mt-1.5 text-xs text-muted-foreground">{isRtl ? `نام پیشنهادی — نام خودتان را انتخاب کنید یا از ${suggestedName} استفاده کنید.` : `Suggested name — choose your own or use ${suggestedName}.`}</p>
          </div>
          {user && <div className="mt-4">
            <Label>{isRtl ? 'نام کاربری' : 'Username'}</Label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <Input
                value={usernameDraft}
                onChange={(event) => { setUsernameDraft(event.target.value); setUsernameFeedback(''); setUsernameSaved(false); }}
                maxLength={20}
                autoComplete="username"
                dir="ltr"
                aria-describedby="username-rules username-feedback"
              />
              <Button type="button" className="shrink-0" onClick={() => void saveUsername()}>
                {isRtl ? 'ذخیره نام کاربری' : 'Save username'}
              </Button>
            </div>
            <p id="username-rules" className="mt-1.5 text-xs text-muted-foreground">
              {isRtl ? '۴ تا ۲۰ نویسه؛ فقط حروف انگلیسی، عدد و زیرخط. نام کاربری باید منحصربه‌فرد باشد.' : '4–20 characters; ASCII letters, digits, and underscores only. Usernames must be unique.'}
            </p>
            {usernameFeedback && <p id="username-feedback" role="alert" className="mt-1.5 text-xs text-red-400">{usernameFeedback}</p>}
            {usernameSaved && <p role="status" className="mt-1.5 text-xs text-green-500">{isRtl ? 'نام کاربری ذخیره شد.' : 'Username saved.'}</p>}
          </div>}
          <div className="mt-4">
            <Label>{t('profile_bio')}</Label>
            <Textarea rows={3} value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} maxLength={1000} className="mt-2" placeholder={isRtl ? 'کمی درباره خودتان بنویسید…' : 'Write a short bio about yourself…'} />
          </div>
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2.5">
              <span className="text-muted-foreground">{isRtl ? 'تاریخ عضویت' : 'Member since'}</span>
              <p className="mt-1 font-semibold text-foreground">
                {user?.createdAt
                  ? new Intl.DateTimeFormat(isRtl ? 'fa-IR' : 'en-US', { dateStyle: 'medium' }).format(new Date(user.createdAt))
                  : (isRtl ? 'در دسترس نیست' : 'Unavailable')}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/40 px-3 py-2.5">
              <span className="text-muted-foreground">{isRtl ? 'مدت عضویت' : 'Membership'}</span>
              <p className="mt-1 font-semibold text-foreground">
                {membershipDays === null ? (isRtl ? 'در دسترس نیست' : 'Unavailable') : (isRtl ? `${membershipDays} روز` : `${membershipDays} ${membershipDays === 1 ? 'day' : 'days'}`)}
              </p>
            </div>
          </div>
          {avatarError && <p role="alert" className="mt-2 text-xs text-red-400">{avatarError}</p>}
        </div>
        <div>
          <Label className="mb-3">{isRtl ? 'آواتارها' : 'Avatars'}</Label>
           <div className="grid grid-cols-3 gap-2 min-[380px]:grid-cols-4 sm:grid-cols-5 lg:grid-cols-8">
            {avatarOptions.map((avatar) => (
              <button type="button" key={avatar.id} onClick={() => setFormData((current) => ({ ...current, avatarId: avatar.id }))} aria-label={avatar.label} aria-pressed={formData.avatarId === avatar.id} title={avatar.label} className={`min-w-0 rounded-2xl border-2 p-1 transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${formData.avatarId === avatar.id ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'}`}>
                <img src={avatar.src} alt="" loading="lazy" className="aspect-square w-full rounded-xl object-cover" />
                <span className="mt-1 block truncate px-0.5 text-center text-[10px] text-muted-foreground">{avatar.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>{t('profile_email')}</Label>
          <Input type="email" value={user?.primaryEmailAddress?.emailAddress || ''} readOnly dir="ltr" className="text-start opacity-70" />
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <div><Label>Life stage</Label><Input value={formData.lifeStage} onChange={e => setFormData({...formData, lifeStage: e.target.value})} placeholder="e.g. Building a company" maxLength={120} /></div>
          <div><Label>Occupation</Label><Input value={formData.occupation} onChange={e => setFormData({...formData, occupation: e.target.value})} placeholder="Optional" maxLength={160} /></div>
          <div><Label>Interests</Label><Input value={formData.interestsText} onChange={e => setFormData({...formData, interestsText: e.target.value})} placeholder="Football, programming, SEO…" maxLength={1200} /></div>
          <div><Label>How should FEZI interact with you?</Label><Input value={formData.interactionStyle} onChange={e => setFormData({...formData, interactionStyle: e.target.value})} placeholder="e.g. Direct and concise" maxLength={600} /></div>
        </div>
        <div><Label>Values and ethics</Label><Textarea rows={3} value={formData.valuesText} onChange={e => setFormData({...formData, valuesText: e.target.value})} placeholder="Optional guidance for better responses" maxLength={1200} /></div>
        <div>
          <Label>Custom instructions for Agents</Label>
          <Textarea rows={5} value={formData.customInstructions} onChange={e => setFormData({...formData, customInstructions: e.target.value})} placeholder="Example: When I say X, do Y. Prefer concise answers and ask before changing my plan." maxLength={4000} />
          <p className="mt-2 text-xs leading-5 text-muted-foreground">These are treated as your preferences and cannot override FEZI safety rules or system limits.</p>
        </div>
        <div className="pt-4 flex items-center gap-4">
          <Button onClick={() => void save()}>{t('save')}</Button>
          {saved && <span className="text-green-500 text-sm flex items-center gap-1"><Check size={16} className="shrink-0"/> {t('saved')}</span>}
        </div>
        <div className="border-t border-border pt-5">
          <Button variant="danger" size="sm" disabled={clearing} onClick={() => void clearPersonalDetails()}><Trash2 size={15} /> {clearing ? 'Clearing…' : 'Clear optional personal details'}</Button>
        </div>
        <div className="rounded-2xl border border-border bg-surface/60 p-4">
          <div className="flex items-center gap-2"><Brain size={17} className="text-primary" /><h2 className="font-semibold">User memory</h2></div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Save facts and preferences you want Agents to remember. You can edit or delete them at any time.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input value={memoryDraft} onChange={(event) => setMemoryDraft(event.target.value)} placeholder="Example: I prefer Persian answers unless I ask for English." maxLength={2000} />
             <Button type="button" className="min-h-11" onClick={() => { void addMemory(); }} disabled={memoryDraft.trim().length < 3}><Brain size={15} /> Add memory</Button>
          </div>
          <div className="mt-4 space-y-2">
            {account?.memories?.length ? account.memories.map((memory) => (
              <div key={memory.id} className="rounded-xl border border-border bg-background p-3">
                {editingMemoryId === memory.id ? (
                  <div className="flex flex-col gap-2">
                    <Textarea rows={3} value={editingMemoryText} onChange={(event) => setEditingMemoryText(event.target.value)} />
                    <div className="flex gap-2"><Button type="button" onClick={() => { void saveEditedMemory(); }}><Save size={14} /> Save</Button><Button type="button" variant="ghost" onClick={() => setEditingMemoryId(null)}>Cancel</Button></div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-6">{memory.content}</p>
                     <div className="flex shrink-0 gap-1"><button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground sm:h-8 sm:w-8" onClick={() => { setEditingMemoryId(memory.id); setEditingMemoryText(memory.content); }} aria-label="Edit memory"><Pencil size={14} /></button><button type="button" className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-400 sm:h-8 sm:w-8" onClick={() => { void deleteMemory(memory.id); }} aria-label="Delete memory"><Trash2 size={14} /></button></div>
                  </div>
                )}
              </div>
            )) : <p className="text-xs text-muted-foreground">No saved memories yet.</p>}
          </div>
        </div>
      </Card>
      <RewardTasks />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><Clock size={17} className="text-primary" /> Activity</h2>
          <div className="space-y-3">
            {account?.activity.slice(0, 6).map((item) => <div key={item.id} className="border-b border-border/60 pb-2 text-xs"><p className="font-medium">{item.label}</p><p className="mt-1 text-muted-foreground">{item.detail}</p></div>)}
            {!account?.activity.length && <p className="text-sm text-muted-foreground">No account activity yet.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><FileText size={17} className="text-primary" /> Created files</h2>
          <div className="space-y-3">
            {account?.files.slice(0, 6).map((file) => <div key={file.id} className="border-b border-border/60 pb-2 text-xs"><p className="font-medium">{file.name}</p><p className="mt-1 text-muted-foreground">{file.mimeType}</p></div>)}
            {!account?.files.length && <p className="text-sm text-muted-foreground">Created files will appear here.</p>}
          </div>
        </Card>
        <Card>
          <h2 className="mb-4 flex items-center gap-2 font-semibold"><CreditCard size={17} className="text-primary" /> Purchases</h2>
          <div className="space-y-3">
            {account?.purchases.slice(0, 6).map((purchase) => <div key={purchase.id} className="border-b border-border/60 pb-2 text-xs"><p className="font-medium">{purchase.planId}</p><p className="mt-1 text-muted-foreground">{purchase.status} · {purchase.currencyId}</p></div>)}
            {!account?.purchases.length && <p className="text-sm text-muted-foreground">No purchases recorded yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function PersonalizePage() {
  const { t } = useTranslation();
  const { personalization, setPersonalization } = useLocalStore();
  const { account, saveProfile } = useAccount();
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const settings = account?.profile.personalization;
    if (!settings) return;
     setPersonalization({ theme: settings.theme === 'light' ? 'light' : 'dark', accent: settings.accent, sidebarCollapsed: settings.sidebarCollapsed });
  }, [account, setPersonalization]);

  const saveSetting = async (value: Record<string, string | boolean>) => {
    setSaveError(false);
    try {
      await saveProfile(value);
    } catch {
      setSaveError(true);
    }
  };
  
  // Strict Black and Gold identity
  const accents = [
    { name: 'Classic Gold', value: '43 68% 60%', hex: '#D4AF37' },
    { name: 'Pale Gold', value: '43 45% 75%', hex: '#D7C797' },
    { name: 'Deep Gold', value: '43 85% 45%', hex: '#C59B15' },
    { name: 'Rose Gold', value: '30 45% 65%', hex: '#C9A389' },
  ];

  return (
     <div className="fade-up mx-auto max-w-2xl min-w-0 space-y-6">
      <PageHeader title={t('pers_title')} description={t('pers_desc')} />
      {saveError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">Personalization changes could not be saved. Please try again.</p>}
      <Card className="space-y-8">
        <div>
          <Label className="mb-4">{t('pers_theme')}</Label>
           <div className="grid gap-4 sm:grid-cols-2">
            <button 
              type="button"
               onClick={() => { setPersonalization({ theme: 'light' }); saveSetting({ theme: 'light' }); }}
              className={`p-4 rounded-xl border-2 transition-all tactile-button flex flex-col items-center gap-3 ${personalization.theme === 'light' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-inner"><Sun size={21} /></div>
              <span className="text-sm font-medium">{t('pers_theme_light')}</span>
            </button>
            <button 
              type="button"
               onClick={() => { setPersonalization({ theme: 'dark' }); saveSetting({ theme: 'dark' }); }}
              className={`p-4 rounded-xl border-2 transition-all tactile-button flex flex-col items-center gap-3 ${personalization.theme === 'dark' ? 'border-primary bg-primary/5' : 'border-border bg-background hover:border-primary/50'}`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#333] bg-black text-white shadow-inner"><Moon size={21} /></div>
              <span className="text-sm font-medium">{t('pers_theme_dark')}</span>
            </button>
          </div>
        </div>
        
        <div>
          <Label className="mb-4">{t('pers_accent')}</Label>
          <div className="flex flex-wrap gap-4">
            {accents.map(c => (
              <button 
                key={c.name}
                 onClick={() => { setPersonalization({ accent: c.value }); saveSetting({ accent: c.value }); }}
                className={`w-14 h-14 rounded-full shadow-lg transition-transform hover:scale-110 focus:outline-none border-2 tactile-button ${personalization.accent === c.value ? 'border-foreground ring-2 ring-primary/50 ring-offset-2 ring-offset-background' : 'border-transparent'}`}
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">{t('pers_accent_desc')}</p>
        </div>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const { t, isRtl } = useTranslation();
  const { appSettings, setAppSettings } = useLocalStore();
  const { account, saveProfile } = useAccount();
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    const settings = account?.profile.personalization;
    if (!settings) return;
    setAppSettings({
      language: settings.language,
      notificationsEnabled: settings.notificationsEnabled,
      voiceEnabled: settings.voiceEnabled,
    });
  }, [account, setAppSettings]);

  const updateSetting = async (value: Record<string, string | boolean>) => {
    setSaveError(false);
    try {
      await saveProfile(value);
    } catch {
      setSaveError(true);
    }
  };
  
  return (
     <div className="fade-up mx-auto max-w-2xl min-w-0 space-y-6">
      <PageHeader title={t('set_title')} description={t('set_desc')} />
      {saveError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">Settings changes could not be saved. Please try again.</p>}
      <Card className="space-y-8">
        <div className="grid md:grid-cols-2 gap-8 md:gap-12">
          <div>
            <Label>{t('set_language')}</Label>
            <select 
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary mt-2"
              value={appSettings.language} 
               onChange={e => {
                 const language = e.target.value as 'en' | 'fa';
                 setAppSettings({ language });
                 updateSetting({ language });
               }}
            >
              <option value="en">English (LTR)</option>
              <option value="fa">فارسی (RTL)</option>
            </select>
          </div>
          
          <div className="space-y-6 pt-2">
             <div className="flex min-h-11 items-center justify-between gap-3">
               <div className="min-w-0">
                <span className="text-sm font-medium block">{t('set_notifications')}</span>
                <span className="text-[10px] text-muted-foreground">{t('set_pref_only')}</span>
              </div>
              <button 
                 onClick={() => {
                   const notificationsEnabled = !appSettings.notificationsEnabled;
                   setAppSettings({ notificationsEnabled });
                   updateSetting({ notificationsEnabled });
                 }}
                 className={`relative h-11 w-12 shrink-0 rounded-full transition-colors tactile-button before:absolute before:inset-x-0 before:top-2.5 before:h-6 before:rounded-full md:h-6 md:before:hidden ${appSettings.notificationsEnabled ? 'before:bg-primary md:bg-primary' : 'before:border before:border-border before:bg-surface-hover md:border md:border-border md:bg-surface-hover'}`}
              >
                 <div className={`absolute top-3.5 h-4 w-4 rounded-full bg-white transition-all md:top-1 ${appSettings.notificationsEnabled ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`}></div>
              </button>
            </div>
            
             <div className="flex min-h-11 items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('set_voice')}</span>
              <button 
                 onClick={() => {
                   const voiceEnabled = !appSettings.voiceEnabled;
                   setAppSettings({ voiceEnabled });
                   updateSetting({ voiceEnabled });
                 }}
                 className={`relative h-11 w-12 shrink-0 rounded-full transition-colors tactile-button before:absolute before:inset-x-0 before:top-2.5 before:h-6 before:rounded-full md:h-6 md:before:hidden ${appSettings.voiceEnabled ? 'before:bg-primary md:bg-primary' : 'before:border before:border-border before:bg-surface-hover md:border md:border-border md:bg-surface-hover'}`}
              >
                 <div className={`absolute top-3.5 h-4 w-4 rounded-full bg-white transition-all md:top-1 ${appSettings.voiceEnabled ? (isRtl ? 'right-7' : 'left-7') : (isRtl ? 'right-1' : 'left-1')}`}></div>
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}