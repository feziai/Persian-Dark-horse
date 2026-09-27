import stoolReference from '@assets/promptbank109_1790128203531.jpg';
import silkReference from '@assets/fezi-studio-image_1790128907456.png';
import cosplayCatReference from '@assets/1771859190886_0f1f4843-fd5d-4280-9182-5d8171972516_1790238326304.jpg';
import strawberryIceCreamReference from '@assets/1768658880529_0447832d-bfa3-4754-949d-8537cd53a28e_1790238506816.jpg';
import waterPortraitReference from '@assets/1768656275607_87e767e1-d708-4908-9f89-4a27d3ad45c4_1790299702263.jpg';
import emeraldNoirReference from '@assets/generated_images/emerald-noir-editorial.jpg';
import waterCausticsCard from '../assets/prompt-presets/water-caustics.webp';
import emeraldNoirCard from '../assets/prompt-presets/emerald-noir.webp';
import crimsonSilkCard from '../assets/prompt-presets/crimson-silk.webp';
import monochromeStoolCard from '../assets/prompt-presets/monochrome-stool.webp';
import cosplayCatCard from '../assets/prompt-presets/cosplay-cat.webp';
import strawberryIceCreamCard from '../assets/prompt-presets/strawberry-ice-cream.webp';

export type ManikaGalleryStatus = 'pending' | 'complete' | 'failed';

export type ManikaGalleryEntry = {
  id: string;
  prompt: string;
  imageDataUrl?: string;
  status: ManikaGalleryStatus;
  createdAt: string;
  toolId?: string;
  settings?: string;
  error?: string;
};

export type ManikaPromptPreset = {
  id: string;
  title: string;
  titleFa: string;
  description: string;
  descriptionFa: string;
  cardImageUrl: string;
  referenceImageUrl?: string;
  referenceLabel?: string;
};

const STORAGE_PREFIX = 'fezi-manika-prompt-gallery:v1:';
const MAX_ENTRIES = 18;

export const MANIKA_PROMPT_PRESETS: readonly ManikaPromptPreset[] = [
  {
    id: 'water-caustics-close-up-portrait',
    title: 'Water Caustics Close-Up Portrait',
    titleFa: 'پرترهٔ نمای نزدیک با بازتاب نور آب',
    description: 'A dreamy, photorealistic close-up portrait emerging from clear water, with rippling light, droplets, and cinematic detail.',
    descriptionFa: 'پرتره‌ای رؤیایی و واقع‌گرایانه از چهره‌ای در میان آب شفاف، با موج‌های نور، قطرات آب و جزئیات سینمایی.',
    cardImageUrl: waterCausticsCard,
    referenceImageUrl: waterPortraitReference,
    referenceLabel: 'Submitted water portrait reference',
  },
  {
    id: 'emerald-noir-editorial',
    title: 'Emerald Noir Editorial',
    titleFa: 'ادیتوریال نوآر روی میز بیلیارد',
    description: 'A cinematic late-70s / early-80s high-fashion portrait with emerald felt, pearls, scarlet heels, harsh overhead light, and authentic film texture.',
    descriptionFa: 'پرترهٔ فشن سینمایی با فضای اواخر دههٔ ۷۰ و اوایل دههٔ ۸۰، نور خشن، مروارید، کفش قرمز و بافت واقعی فیلم.',
    cardImageUrl: emeraldNoirCard,
    referenceImageUrl: emeraldNoirReference,
    referenceLabel: 'Generated editorial concept preview',
  },
  {
    id: 'crimson-silk-noir-editorial',
    title: 'Crimson Silk Noir',
    titleFa: 'نوآر ابریشم قرمز',
    description: 'An adult fashion editorial with red silk, black bedding, dramatic side light, and a dark studio atmosphere.',
    descriptionFa: 'ادیتوریال فشن بزرگسالانه با ابریشم قرمز، ملحفهٔ مشکی، نور جانبی دراماتیک و فضای تاریک استودیویی.',
    cardImageUrl: crimsonSilkCard,
    referenceImageUrl: silkReference,
    referenceLabel: 'Persian Dark Horse Studio silk reference',
  },
  {
    id: 'monochrome-stool-lingerie',
    title: 'Monochrome Stool Lingerie',
    titleFa: 'پرترهٔ سیاه‌وسفید روی چهارپایه',
    description: 'A high-contrast black-and-white lingerie editorial built around a dynamic stool pose, stockings, hard studio light, and a minimalist backdrop.',
    descriptionFa: 'ادیتوریال سیاه‌وسفید با کنتراست بالا، ژست پویا روی چهارپایه، جوراب، نور سخت استودیویی و پس‌زمینهٔ مینیمال.',
    cardImageUrl: monochromeStoolCard,
    referenceImageUrl: stoolReference,
    referenceLabel: 'promptbank109 reference',
  },
  {
    id: 'pink-devil-cosplayer-with-cat',
    title: 'Afternoon Cosplay with a Curious Cat',
    titleFa: 'کازپلی عصرگاهی با گربه‌ای کنجکاو',
    description: 'A warm vertical portrait with pastel-pink hair, small devil horns, a fluffy white cat, and late-afternoon window light.',
    descriptionFa: 'پرتره‌ای عمودی و گرم با موهای صورتی پاستلی، شاخ‌های کوچک، گربه‌ای سفید و نور عصرگاهی پنجره.',
    cardImageUrl: cosplayCatCard,
    referenceImageUrl: cosplayCatReference,
    referenceLabel: 'Submitted cosplay reference',
  },
  {
    id: 'strawberry-ice-cream-close-up',
    title: 'Strawberry Ice Cream Close-Up',
    titleFa: 'نمای نزدیک بستنی توت‌فرنگی',
    description: 'A photorealistic summer close-up portrait with glossy pink lips, melting strawberry ice cream, and a turquoise pool backdrop.',
    descriptionFa: 'پرتره‌ای واقع‌گرایانه از لب‌های صورتی براق و بستنی توت‌فرنگی آب‌شونده، با پس‌زمینهٔ استخر فیروزه‌ای و حال‌وهوای تابستانی.',
    cardImageUrl: strawberryIceCreamCard,
    referenceImageUrl: strawberryIceCreamReference,
    referenceLabel: 'Submitted strawberry ice cream reference',
  },
] as const;

function storageKey(userId?: string | null) {
  return `${STORAGE_PREFIX}${userId || 'guest'}`;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readManikaGallery(userId?: string | null): ManikaGalleryEntry[] {
  if (!canUseStorage()) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey(userId)) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ManikaGalleryEntry => (
      item
      && typeof item.id === 'string'
      && typeof item.prompt === 'string'
      && typeof item.status === 'string'
      && typeof item.createdAt === 'string'
    ));
  } catch {
    return [];
  }
}

function tryWrite(userId: string | null | undefined, entries: ManikaGalleryEntry[]) {
  if (!canUseStorage()) return false;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    return true;
  } catch {
    return false;
  }
}

export function writeManikaGallery(userId: string | null | undefined, entries: ManikaGalleryEntry[]) {
  const normalized = entries
    .filter((entry) => entry.prompt.trim())
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_ENTRIES);
  if (tryWrite(userId, normalized)) return normalized;

  // Generated data URLs can be large. Preserve the prompt history if the
  // browser quota is reached, while dropping the oldest rendered images first.
  const withoutImages = normalized.map((entry) => ({ ...entry, imageDataUrl: undefined }));
  if (tryWrite(userId, withoutImages)) return withoutImages;

  const compact = normalized.slice(0, 8).map(({ imageDataUrl: _imageDataUrl, ...entry }) => entry);
  tryWrite(userId, compact);
  return compact;
}

export function upsertManikaGalleryEntry(
  userId: string | null | undefined,
  entry: ManikaGalleryEntry,
) {
  const entries = readManikaGallery(userId);
  const next = [entry, ...entries.filter((item) => item.id !== entry.id)];
  return writeManikaGallery(userId, next);
}

export function removeManikaGalleryEntry(userId: string | null | undefined, id: string) {
  return writeManikaGallery(userId, readManikaGallery(userId).filter((entry) => entry.id !== id));
}

export function rememberManikaPrompt(userId: string | null | undefined, prompt: string, imageDataUrl?: string) {
  return upsertManikaGalleryEntry(userId, {
    id: `manika-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    prompt: prompt.trim(),
    imageDataUrl,
    status: imageDataUrl ? 'complete' : 'pending',
    createdAt: new Date().toISOString(),
  });
}