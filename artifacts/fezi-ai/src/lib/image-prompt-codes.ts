export type ImagePromptCode = {
  code: string;
  descriptionEn: string;
  descriptionFa: string;
  instruction: string;
};

// Prompt shortcuts from the user's image-generation reference. These are descriptive
// directions, not provider-specific commands or guarantees of output resolution.
export const imagePromptCodes: ImagePromptCode[] = [
  { code: '/realistic', descriptionEn: 'Photorealistic image', descriptionFa: 'تصویر واقع‌گرایانه', instruction: 'Use a photorealistic appearance with believable materials and lighting.' },
  { code: '/cinematic', descriptionEn: 'Cinematic lighting and mood', descriptionFa: 'نورپردازی و حس سینمایی', instruction: 'Use cinematic composition, dramatic lighting, and film-like atmosphere.' },
  { code: '/4k', descriptionEn: 'High detail, 4K look', descriptionFa: 'جزئیات بالا با ظاهر 4K', instruction: 'Aim for a crisp, high-detail 4K-style look where the output allows it.' },
  { code: '/8k', descriptionEn: 'Ultra-detailed, 8K look', descriptionFa: 'جزئیات بسیار بالا با ظاهر 8K', instruction: 'Aim for exceptionally fine detail and an 8K-style look where the output allows it.' },
  { code: '/ultra realistic', descriptionEn: 'Hyper-realistic details', descriptionFa: 'جزئیات بسیار واقع‌گرایانه', instruction: 'Render lifelike textures, natural imperfections, and hyper-realistic detail.' },
  { code: '/photo', descriptionEn: 'Natural photograph', descriptionFa: 'عکس طبیعی', instruction: 'Compose the scene as a believable real photograph.' },
  { code: '/portrait', descriptionEn: 'Portrait composition', descriptionFa: 'ترکیب‌بندی پرتره', instruction: 'Use portrait photography framing that emphasizes the subject.' },
  { code: '/selfie', descriptionEn: 'Selfie perspective', descriptionFa: 'زاویهٔ سلفی', instruction: 'Use a natural handheld selfie perspective.' },
  { code: '/cartoon', descriptionEn: 'Cartoon style', descriptionFa: 'سبک کارتونی', instruction: 'Illustrate the scene in a colorful cartoon style.' },
  { code: '/anime', descriptionEn: 'Anime style', descriptionFa: 'سبک انیمه', instruction: 'Illustrate the scene with expressive anime-style visuals.' },
  { code: '/watercolor', descriptionEn: 'Watercolor painting', descriptionFa: 'نقاشی آبرنگ', instruction: 'Use soft watercolor washes and textured paper-like edges.' },
  { code: '/oil painting', descriptionEn: 'Oil painting', descriptionFa: 'نقاشی رنگ‌روغن', instruction: 'Use oil-paint brushwork, rich pigments, and painterly texture.' },
  { code: '/sketch', descriptionEn: 'Pencil sketch', descriptionFa: 'طراحی با مداد', instruction: 'Render the scene as a pencil sketch with visible shading and line work.' },
  { code: '/line art', descriptionEn: 'Minimal line art', descriptionFa: 'طراحی خطی ساده', instruction: 'Use clean, minimal line art with restrained detail.' },
  { code: '/minimalist', descriptionEn: 'Minimal design', descriptionFa: 'طراحی مینیمال', instruction: 'Keep the composition simple, spacious, and minimal.' },
  { code: '/vibrant', descriptionEn: 'Bright, vivid colors', descriptionFa: 'رنگ‌های شاد و زنده', instruction: 'Use bright, vivid, saturated colors.' },
  { code: '/black and white', descriptionEn: 'Monochrome image', descriptionFa: 'تصویر سیاه‌وسفید', instruction: 'Render the image in black and white with a full monochrome tonal range.' },
  { code: '/golden hour', descriptionEn: 'Warm golden-hour light', descriptionFa: 'نور گرم ساعت طلایی', instruction: 'Light the scene with warm, low-angle golden-hour sunlight.' },
  { code: '/studio lighting', descriptionEn: 'Professional studio light', descriptionFa: 'نورپردازی حرفه‌ای استودیو', instruction: 'Use controlled professional studio lighting.' },
  { code: '/night scene', descriptionEn: 'Nighttime lighting', descriptionFa: 'صحنه و نور شب', instruction: 'Set the scene at night with convincing low-light illumination.' },
  { code: '/hdr', descriptionEn: 'Wide dynamic range', descriptionFa: 'دامنهٔ دینامیکی بالا', instruction: 'Balance highlights and shadows for a high-dynamic-range look.' },
  { code: '/macro', descriptionEn: 'Close-up macro', descriptionFa: 'نمای خیلی نزدیک ماکرو', instruction: 'Use an extreme macro close-up with fine subject detail.' },
  { code: '/aerial view', descriptionEn: 'Bird’s-eye perspective', descriptionFa: 'نمای هوایی', instruction: 'Show the scene from a bird’s-eye or drone perspective.' },
  { code: '/wide angle', descriptionEn: 'Wide-angle perspective', descriptionFa: 'زاویهٔ دید باز', instruction: 'Use a wide-angle perspective that shows more of the surroundings.' },
  { code: '/blur background', descriptionEn: 'Blurred background', descriptionFa: 'پس‌زمینهٔ محو', instruction: 'Keep the subject in focus while softly blurring the background.' },
  { code: '/bokeh', descriptionEn: 'Soft background bokeh', descriptionFa: 'بوکهٔ پس‌زمینه', instruction: 'Add attractive soft bokeh highlights behind the subject.' },
  { code: '/sharp focus', descriptionEn: 'Crisp subject focus', descriptionFa: 'وضوح بالای سوژه', instruction: 'Keep the primary subject crisp and sharply focused.' },
  { code: '/soft focus', descriptionEn: 'Dreamy soft focus', descriptionFa: 'فوکوس نرم و رؤیایی', instruction: 'Give the image a gentle, dreamy soft-focus look.' },
  { code: '/dramatic lighting', descriptionEn: 'Strong contrast and light', descriptionFa: 'نور دراماتیک و پرکنتراست', instruction: 'Use dramatic, high-contrast lighting and strong shadows.' },
  { code: '/backlit', descriptionEn: 'Light behind the subject', descriptionFa: 'نور از پشت سوژه', instruction: 'Backlight the subject to create a luminous rim or silhouette.' },
  { code: '/moody', descriptionEn: 'Dark, atmospheric mood', descriptionFa: 'حال‌وهوای تاریک و احساسی', instruction: 'Create a dark, moody, atmospheric scene.' },
  { code: '/vintage', descriptionEn: 'Vintage look', descriptionFa: 'ظاهر قدیمی', instruction: 'Give the image a vintage photographic look and feel.' },
  { code: '/retro', descriptionEn: 'Retro style', descriptionFa: 'سبک رترو', instruction: 'Use nostalgic retro styling, colors, and details.' },
  { code: '/cyberpunk', descriptionEn: 'Futuristic cyberpunk', descriptionFa: 'سایبرپانک آینده‌گرا', instruction: 'Use a futuristic cyberpunk aesthetic with neon-lit details.' },
  { code: '/fantasy', descriptionEn: 'Magical fantasy world', descriptionFa: 'دنیای فانتزی جادویی', instruction: 'Depict the scene as a magical fantasy world.' },
  { code: '/sci fi', descriptionEn: 'Science-fiction theme', descriptionFa: 'فضای علمی‌تخیلی', instruction: 'Use science-fiction design and world-building elements.' },
  { code: '/nature', descriptionEn: 'Natural scenery', descriptionFa: 'منظرهٔ طبیعی', instruction: 'Emphasize beautiful, authentic natural scenery.' },
  { code: '/landscape', descriptionEn: 'Wide landscape', descriptionFa: 'منظرهٔ گسترده', instruction: 'Compose a broad landscape scene with a strong sense of place.' },
  { code: '/architecture', descriptionEn: 'Building photography', descriptionFa: 'عکاسی معماری', instruction: 'Emphasize building forms and architectural details.' },
  { code: '/interior', descriptionEn: 'Interior and rooms', descriptionFa: 'فضای داخلی و اتاق‌ها', instruction: 'Present the space as an interior design photograph.' },
  { code: '/product photo', descriptionEn: 'Clean product photography', descriptionFa: 'عکاسی تمیز محصول', instruction: 'Create clean product photography with the product as the focal point.' },
  { code: '/food photo', descriptionEn: 'Appetizing food photography', descriptionFa: 'عکاسی جذاب غذا', instruction: 'Style and light the food for an appetizing photograph.' },
  { code: '/fashion', descriptionEn: 'Fashion photography', descriptionFa: 'عکاسی مد و لباس', instruction: 'Use fashion photography styling and editorial composition.' },
  { code: '/concept art', descriptionEn: 'Creative concept art', descriptionFa: 'کانسپت آرت خلاقانه', instruction: 'Render the scene as expressive creative concept art.' },
  { code: '/illustration', descriptionEn: 'Digital illustration', descriptionFa: 'تصویرسازی دیجیتال', instruction: 'Illustrate the scene as polished digital artwork.' },
  { code: '/3d render', descriptionEn: '3D-rendered appearance', descriptionFa: 'ظاهر رندر سه‌بعدی', instruction: 'Give the image a polished three-dimensional rendered appearance.' },
  { code: '/isometric', descriptionEn: 'Isometric view', descriptionFa: 'نمای ایزومتریک', instruction: 'Use an isometric viewpoint and composition.' },
  { code: '/pastel', descriptionEn: 'Soft pastel tones', descriptionFa: 'رنگ‌های پاستلی ملایم', instruction: 'Use a soft pastel color palette.' },
  { code: '/high contrast', descriptionEn: 'High-contrast look', descriptionFa: 'کنتراست بالا', instruction: 'Use strong tonal contrast and clearly separated light and dark areas.' },
  { code: '/no text', descriptionEn: 'No writing in the image', descriptionFa: 'بدون نوشته در تصویر', instruction: 'Do not include visible words, letters, or numbers in the image.' },
];

const byCode = new Map(imagePromptCodes.map((item) => [item.code, item]));
const commandNames = imagePromptCodes.map(({ code }) => code.slice(1))
  .sort((a, b) => b.length - a.length)
  .map((name) => name.split(' ').join('\\s+'))
  .join('|');
const commandPattern = new RegExp(`(^|\\s)/(${commandNames})(?=$|[\\s.,!?;،])`, 'gi');

export function buildImagePrompt(prompt: string, selectedCodes: readonly string[] = []): string {
  const usedCodes = new Set(selectedCodes.filter((code) => byCode.has(code)));
  const subject = prompt.replace(commandPattern, (_match, before: string, name: string) => {
    usedCodes.add(`/${name.toLowerCase().replace(/\s+/g, ' ')}`);
    return before;
  }).replace(/[ \t]{2,}/g, ' ').trim();
  const directions = imagePromptCodes.filter(({ code }) => usedCodes.has(code)).map(({ instruction }) => instruction);
  return directions.length ? `${subject}\n\nVisual directions: ${directions.join(' ')}` : subject;
}