export const GPT_IMAGE_FAMILY = 'openai/gpt-image-2.5';
export const GPT_IMAGE_FLARE = 'openai/gpt-image-2.5-flare';
export const GPT_IMAGE_SUNBURST = 'openai/gpt-image-2.5-sunburst';

export function isGptImageVariant(id: string) {
  return id === GPT_IMAGE_FLARE || id === GPT_IMAGE_SUNBURST;
}

export function groupGptImageModels<T extends { id: string; name: string; available?: boolean }>(models: T[]): T[] {
  const variants = models.filter((model) => isGptImageVariant(model.id));
  if (!variants.length) return models;
  const family = {
    ...variants[0],
    id: GPT_IMAGE_FAMILY,
    name: 'GPT Image 2.5',
    available: variants.some((model) => model.available !== false),
  };
  let inserted = false;
  return models.flatMap((model) => {
    if (isGptImageVariant(model.id) || model.id === GPT_IMAGE_FAMILY) {
      if (inserted) return [];
      inserted = true;
      return [family];
    }
    return [model];
  });
}

export function resolveGptImageVariant(preferred: string, availableIds: string[]) {
  if (availableIds.includes(preferred)) return preferred;
  return availableIds.includes(GPT_IMAGE_FLARE) ? GPT_IMAGE_FLARE : GPT_IMAGE_SUNBURST;
}

type GptImageVariantProps = {
  value: string;
  availableIds: string[];
  onChange: (id: string) => void;
  isRtl: boolean;
  name: string;
};

export function GptImageVariant({ value, availableIds, onChange, isRtl, name }: GptImageVariantProps) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-primary/25 bg-primary/5 p-3" data-testid={`group-${name}`}>
      <legend className="px-1 text-xs font-semibold text-foreground">{isRtl ? 'نوع GPT Image 2.5' : 'GPT Image 2.5 variant'}</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          { id: GPT_IMAGE_FLARE, title: 'Flare', description: isRtl ? 'سریع‌تر' : 'Faster' },
          { id: GPT_IMAGE_SUNBURST, title: 'Sunburst', description: isRtl ? 'دقیق‌تر' : 'Precision' },
        ].map(({ id, title, description }) => (
          <label key={id} className={`flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs focus-within:ring-2 focus-within:ring-primary ${value === id ? 'border-primary bg-primary/10' : 'border-border bg-background/60'} ${!availableIds.includes(id) ? 'cursor-not-allowed opacity-50' : ''}`}>
            <input
              type="radio"
              name={name}
              data-testid={`radio-${name}-${title.toLowerCase()}`}
              value={id}
              checked={value === id}
              disabled={!availableIds.includes(id)}
              onChange={() => onChange(id)}
              className="accent-primary"
            />
            <span className="min-w-0"><span className="block font-semibold" dir="ltr">{title}</span><span className="block text-muted-foreground">{description}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}