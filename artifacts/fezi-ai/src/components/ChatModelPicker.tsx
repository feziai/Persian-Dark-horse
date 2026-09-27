import { useState } from 'react';
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  ChevronRight,
  Code2,
  Film,
  Image as ImageIcon,
  MessageSquareText,
  PanelsTopLeft,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import feziAiLogo from '@assets/iE9m9onSritTKUxPbsBH8q5DneY-MQuBkfs3QACpzN_TNiooTg_1790234214392.png';

export type PickerModel = {
  id: string;
  name: string;
  free: boolean;
  supportsReasoning: boolean;
  provider: string;
  providerLabel: string;
  requiresSubscription?: boolean;
  available?: boolean;
  availabilityLabel?: string;
};

export type ChatModelCatalog = {
  chat: PickerModel[];
  code: PickerModel[];
  image: PickerModel[];
  video: PickerModel[];
  audio: PickerModel[];
};

type PickerCategory = 'chat' | 'video' | 'image' | 'coding' | 'reasoning' | 'apps' | 'smart';

type ChatModelPickerProps = {
  catalog: ChatModelCatalog;
  loading: boolean;
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
  onOpenImage: () => void;
  onOpenVideo: () => void;
  onClose: () => void;
  isRtl: boolean;
};

const SMART_MODEL = 'smart';

const categoryCopy: Record<PickerCategory, {
  label: string;
  labelFa: string;
  hint: string;
  hintFa: string;
  icon: LucideIcon;
}> = {
  chat: {
    label: 'Chat',
    labelFa: 'گفتگو',
    hint: 'Everyday conversation and analysis',
    hintFa: 'گفتگو و تحلیل روزمره',
    icon: MessageSquareText,
  },
  video: {
    label: 'Create video',
    labelFa: 'ساخت ویدیو',
    hint: 'Generate video in chat with automatic model routing',
    hintFa: 'ساخت ویدیو در گفتگو با انتخاب خودکار مدل',
    icon: Film,
  },
  image: {
    label: 'Create image',
    labelFa: 'ساخت تصویر',
    hint: 'Generate an image in chat with automatic model routing',
    hintFa: 'ساخت تصویر در گفتگو با انتخاب خودکار مدل',
    icon: ImageIcon,
  },
  coding: {
    label: 'Coding',
    labelFa: 'کدنویسی',
    hint: 'Models with tool support for shipping code',
    hintFa: 'مدل‌های مجهز به ابزار برای ساخت کد',
    icon: Code2,
  },
  reasoning: {
    label: 'Reasoning',
    labelFa: 'استدلال',
    hint: 'Models with visible reasoning capability',
    hintFa: 'مدل‌های دارای قابلیت استدلال',
    icon: BrainCircuit,
  },
  apps: {
    label: 'App building',
    labelFa: 'ساخت اپ',
    hint: 'A focused set of coding models for product work',
    hintFa: 'مجموعه‌ای از مدل‌های کدنویسی برای ساخت محصول',
    icon: PanelsTopLeft,
  },
  smart: {
    label: 'Persian Dark Horse',
    labelFa: 'اسب تیره فارسی',
    hint: 'Smart routing by Persian Dark Horse',
    hintFa: 'مسیریابی هوشمند توسط اسب تیره فارسی',
    icon: Sparkles,
  },
};

const categories: PickerCategory[] = ['chat', 'video', 'image', 'coding', 'reasoning', 'apps', 'smart'];

function FeziPickerLogo({ className = '' }: { className?: string }) {
  return <img src={feziAiLogo} alt="Persian Dark Horse" className={`shrink-0 object-cover ${className}`} />;
}

function ProviderMark({ model }: { model: PickerModel }) {
  if (isFeziModel(model)) {
    return <FeziPickerLogo className="h-9 w-9 rounded-xl border border-primary/25" />;
  }
  return (
    <BrandLogo name={model.name} id={model.id} provider={model.providerLabel || model.provider} size={36} className="shrink-0" />
  );
}

function isFeziModel(model: PickerModel) {
  return model.provider === 'fezi'
    || model.provider === 'gapgpt'
    || /fezi|fuzzy/i.test(model.providerLabel);
}

function limitFeziModels(models: PickerModel[]) {
  const fezi = models.filter(isFeziModel);
  const external = models.filter((model) => !isFeziModel(model));
  return [...fezi.slice(0, 3), ...external];
}

function ModelRow({
  model,
  selected,
  onClick,
  isRtl,
}: {
  model: PickerModel;
  selected: boolean;
  onClick: () => void;
  isRtl: boolean;
}) {
  return (
    <button
      type="button"
      data-testid={`button-select-model-${model.id.replace(/[^a-z0-9]+/gi, '-')}`}
      aria-pressed={selected}
      disabled={model.available === false}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-start transition-[border-color,background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-55 ${
        selected
          ? 'border-primary/70 bg-primary/10 shadow-[inset_0_0_0_1px_hsl(var(--primary)/.12)]'
          : 'border-border/80 bg-background/35 hover:-translate-y-px hover:border-primary/40 hover:bg-surface-hover'
      }`}
    >
      <ProviderMark model={model} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-xs font-semibold text-foreground" dir="ltr">
            {isFeziModel(model) ? `Persian Dark Horse · ${model.name}` : model.name}
          </span>
          {model.supportsReasoning && (
            <span className="hidden rounded-full border border-primary/20 bg-primary/5 px-1.5 py-0.5 text-[9px] text-primary sm:inline">
              {isRtl ? 'استدلال' : 'Reasoning'}
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span dir="ltr">{model.providerLabel || model.provider}</span>
          <span className="text-border">·</span>
          <span dir="ltr">{model.id}</span>
          {model.supportsReasoning && <span>{isRtl ? 'استدلال' : 'Reasoning'}</span>}
          {model.requiresSubscription && (
            <span className="text-amber-500/90">{isRtl ? 'نیازمند اشتراک' : 'Subscription required'}</span>
          )}
          {model.available === false && (
            <span className="text-amber-500/90">{isRtl ? (model.availabilityLabel ?? 'فعلاً در دسترس نیست') : (model.availabilityLabel ?? 'Temporarily unavailable')}</span>
          )}
        </span>
      </span>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent group-hover:border-primary/50'}`}>
        <Check size={13} strokeWidth={2.5} />
      </span>
    </button>
  );
}

function SmartRow({
  selected,
  onClick,
  isRtl,
  showFeziLogo = false,
}: {
  selected: boolean;
  onClick: () => void;
  isRtl: boolean;
  showFeziLogo?: boolean;
}) {
  return (
    <button
      type="button"
      data-testid="button-select-model-smart"
      aria-pressed={selected}
      onClick={onClick}
      className={`group flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-start transition-[border-color,background-color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 ${
        selected ? 'border-primary/70 bg-primary/10' : 'border-border/80 bg-background/35 hover:-translate-y-px hover:border-primary/40 hover:bg-surface-hover'
      }`}
    >
      {showFeziLogo ? (
        <FeziPickerLogo className="h-9 w-9 rounded-xl border border-primary/35" />
      ) : (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/35 bg-primary/15 text-primary">
          <Sparkles size={16} />
        </span>
      )}
       <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-foreground">{isRtl ? 'هوشمند' : 'Smart'}</span>
        <span className="mt-1 block text-[10px] text-muted-foreground">{isRtl ? 'انتخاب خودکار بهترین مدل' : 'Automatic model routing for the task'}</span>
      </span>
      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent group-hover:border-primary/50'}`}>
        <Check size={13} strokeWidth={2.5} />
      </span>
    </button>
  );
}

export function ChatModelPicker({
  catalog,
  loading,
  selectedModel,
  onSelectModel,
  onOpenImage,
  onOpenVideo,
  onClose,
  isRtl,
}: ChatModelPickerProps) {
  const [category, setCategory] = useState<PickerCategory | null>(null);
  const copy = category ? categoryCopy[category] : null;
  const CategoryIcon = copy?.icon;

  const chooseModel = onSelectModel;

  const reasoningModels = Array.from(new Map(
    [...catalog.chat, ...catalog.code].filter((model) => model.supportsReasoning).map((model) => [model.id, model]),
  ).values());
  const categoryModels = category === 'chat'
    ? limitFeziModels(catalog.chat)
    : category === 'coding' || category === 'apps'
        ? limitFeziModels(catalog.code)
        : category === 'reasoning'
          ? limitFeziModels(reasoningModels)
          : [];

  return (
    <section className="touch-pan-y overflow-hidden rounded-2xl border border-primary/20 bg-[linear-gradient(135deg,hsl(var(--surface)),hsl(var(--background)))]" aria-label={isRtl ? 'انتخاب مدل و ابزار' : 'Model and tool picker'}>
      {!category ? (
        <div className="p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">{isRtl ? 'مدل‌ها' : 'Models'}</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{isRtl ? 'برای شروع چه چیزی می‌سازید؟' : 'What are you working on?'}</p>
              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{isRtl ? 'برای گفتگو مدل را انتخاب کنید؛ برای رسانه مدل به‌صورت خودکار انتخاب می‌شود.' : 'Choose a chat model, or let the server route image and video generation.'}</p>
            </div>
            <button type="button" data-testid="button-close-model-picker" aria-label={isRtl ? 'بستن انتخابگر مدل' : 'Close model picker'} onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
              <ChevronRight size={16} className={isRtl ? 'rotate-180' : ''} />
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {categories.map((item) => {
              const itemCopy = categoryCopy[item];
              const Icon = itemCopy.icon;
              return (
                <button
                  key={item}
                  type="button"
                  data-testid={`button-model-category-${item}`}
                  onClick={() => setCategory(item)}
                  className="group flex min-h-[68px] items-center gap-3 rounded-2xl border border-border/80 bg-background/30 px-3 py-3 text-start transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-primary/45 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                >
                  {item === 'smart' ? (
                    <FeziPickerLogo className="h-9 w-9 rounded-xl border border-border transition-colors group-hover:border-primary/30" />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-primary transition-colors group-hover:border-primary/30">
                      <Icon size={17} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-foreground">{isRtl ? itemCopy.labelFa : itemCopy.label}</span>
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">{isRtl ? itemCopy.hintFa : itemCopy.hint}</span>
                  </span>
                  <ChevronRight size={15} className={`shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 ${isRtl ? 'rotate-180' : ''}`} />
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2.5 text-[10px] text-muted-foreground">
            <FeziPickerLogo className="h-4 w-4 rounded" />
            <span>{isRtl ? 'هوش هوشمند اسب تیره فارسی همیشه در دسترس است.' : 'Persian Dark Horse Smart AI is always ready when you do not want to compare models.'}</span>
          </div>
        </div>
      ) : (
        <div className="p-3">
          <div className="mb-3 flex items-center gap-2">
            <button type="button" data-testid="button-model-picker-back" onClick={() => setCategory(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70" aria-label={isRtl ? 'بازگشت به دسته‌ها' : 'Back to categories'}>
              <ArrowLeft size={16} className={isRtl ? 'rotate-180' : ''} />
            </button>
            {category === 'smart' ? (
              <FeziPickerLogo className="h-8 w-8 rounded-lg border border-primary/25" />
            ) : CategoryIcon && (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><CategoryIcon size={16} /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{isRtl ? copy?.labelFa : copy?.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{isRtl ? copy?.hintFa : copy?.hint}</p>
            </div>
            <button type="button" data-testid="button-close-model-category" onClick={onClose} aria-label={isRtl ? 'بستن انتخابگر مدل' : 'Close model picker'} className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
              <ChevronRight size={16} className={isRtl ? 'rotate-180' : ''} />
            </button>
          </div>

          {category === 'smart' ? (
            <div className="space-y-2">
              <SmartRow selected={selectedModel === SMART_MODEL} onClick={() => chooseModel(SMART_MODEL)} isRtl={isRtl} showFeziLogo />
              <p className="px-1 text-[10px] leading-5 text-muted-foreground">{isRtl ? 'اسب تیره فارسی مدل و مسیر مناسب را بر اساس درخواست شما انتخاب می‌کند.' : 'Persian Dark Horse picks the best available route for the request, without making you browse providers.'}</p>
            </div>
          ) : category === 'video' ? (
            <div className="space-y-2">
              <p className="px-1 text-[11px] leading-5 text-muted-foreground">{isRtl ? 'در گفتگو مدل و هزینه را سرور تعیین می‌کند. ساخت ویدیوی واقعی ممکن است به اعتبار زیادی نیاز داشته باشد؛ هزینه نهایی را قبل از ارسال در اطلاعات حساب بررسی کنید.' : 'The server chooses the model and price for inline chat video. Real video generation can require substantial Credits; check your account for current pricing.'}</p>
               <button type="button" data-testid="button-open-video-creation" onClick={onOpenVideo} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
                 <Film size={14} /> {isRtl ? 'ادامه ساخت ویدیو' : 'Continue to video creation'}
               </button>
            </div>
          ) : category === 'image' ? (
            <div className="space-y-2">
              <p className="px-1 text-[11px] leading-5 text-muted-foreground">{isRtl ? 'در گفتگو سرور مدل تصویر قابل‌دسترس را انتخاب می‌کند. برای انتخاب مدل تصویر به استودیوی تصویر بروید.' : 'The server chooses an available image model for inline chat. Use Image Studio to choose an explicit image model.'}</p>
              <button type="button" data-testid="button-open-image-creation" onClick={onOpenImage} className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
                <ImageIcon size={14} /> {isRtl ? 'ادامه ساخت تصویر' : 'Continue to image creation'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {category === 'chat' && <SmartRow selected={selectedModel === SMART_MODEL} onClick={() => chooseModel(SMART_MODEL)} isRtl={isRtl} showFeziLogo />}
              {loading ? (
                <div className="space-y-2" aria-label={isRtl ? 'در حال بارگذاری مدل‌ها' : 'Loading models'}>
                  {[1, 2, 3].map((item) => <div key={item} className="h-[66px] animate-pulse rounded-2xl border border-border/70 bg-background/40" />)}
                </div>
              ) : categoryModels.map((model) => (
                <ModelRow key={model.id} model={model} selected={selectedModel === model.id} onClick={() => chooseModel(model.id)} isRtl={isRtl} />
              ))}
              {!loading && categoryModels.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border px-4 py-5 text-center">
                  <p className="text-xs font-medium">{isRtl ? 'مدلی برای این دسته در دسترس نیست' : 'No models are available for this category'}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{isRtl ? 'کاتالوگ زنده اسب تیره فارسی خالی است.' : 'The live Persian Dark Horse catalog is empty here.'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}