export type ImageApp = {
  id: string;
  name: string;
  description: string;
  supported: string[];
  unavailable: string[];
  creditCost: number;
  requiresSubscription?: boolean;
  freeDailyLimit?: number;
};

const imageControls = ['studio_aspect', 'studio_visual_style', 'studio_lighting', 'studio_lens', 'studio_resolution'];

export const imageAppCatalog: ImageApp[] = [
  { id: 'stable-diffusion', name: 'Stable Diffusion / SDXL', description: 'Open image generation for up to five free images each day.', supported: imageControls, unavailable: [], creditCost: 210, freeDailyLimit: 5 },
  { id: 'gapgpt/z-image', name: 'Persian Dark Horse · Z-Image', description: 'Persian Dark Horse Z-Image generation within the daily five-image allowance.', supported: imageControls, unavailable: [], creditCost: 80, freeDailyLimit: 5 },
  { id: 'gemini-2.5-flash-image', name: 'Persian Dark Horse · Nano Banana (Gemini 2.5 Flash Image)', description: 'Nano Banana image generation within the daily five-image allowance.', supported: imageControls.filter((item) => item !== 'studio_lens'), unavailable: ['studio_lens'], creditCost: 150, freeDailyLimit: 5 },
  { id: 'flux-1-schnell', name: 'Persian Dark Horse · FLUX Schnell', description: 'Fast FLUX Schnell image generation within the daily five-image allowance.', supported: imageControls.slice(0, 3), unavailable: ['studio_lens', 'studio_resolution'], creditCost: 120, freeDailyLimit: 5 },
  { id: 'midjourney', name: 'Midjourney', description: 'Style-led image exploration and art direction.', supported: imageControls.slice(0, 4), unavailable: ['studio_resolution'], creditCost: 130 },
  { id: 'dall-e', name: 'DALL·E', description: 'Prompt-led image concept generation.', supported: imageControls.slice(0, 3), unavailable: ['studio_lens', 'studio_resolution'], creditCost: 99 },
  { id: 'imagen', name: 'Google Imagen', description: 'Photographic and illustrative image direction.', supported: imageControls.filter((item) => item !== 'studio_lens'), unavailable: ['studio_lens'], creditCost: 140 },
  { id: 'firefly', name: 'Adobe Firefly', description: 'Commercially focused image and design ideation.', supported: imageControls.slice(0, 3), unavailable: ['studio_lens', 'studio_resolution'], creditCost: 160 },
  { id: 'flux', name: 'Persian Dark Horse · FLUX', description: 'Prompt, composition, and reference-led image work.', supported: imageControls, unavailable: [], creditCost: 95 },
  { id: 'ideogram', name: 'Ideogram', description: 'Image concepts with typography-aware direction.', supported: imageControls.filter((item) => item !== 'studio_lens'), unavailable: ['studio_lens'], creditCost: 75 },
  { id: 'leonardo', name: 'Leonardo AI', description: 'Asset, character, and concept image workflow.', supported: imageControls, unavailable: [], creditCost: 130 },
  { id: 'recraft', name: 'Recraft', description: 'Brand, vector, and visual system exploration.', supported: imageControls.slice(0, 3), unavailable: ['studio_lens', 'studio_resolution'], creditCost: 85 },
];