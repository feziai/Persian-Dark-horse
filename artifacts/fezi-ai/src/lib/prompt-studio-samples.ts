import disneySample from '@assets/generated_images/prompt-sample-disney.jpg';
import gamesSample from '@assets/generated_images/prompt-sample-games.jpg';
import modelingSample from '@assets/generated_images/prompt-sample-modeling.jpg';
import cinematicSample from '@assets/generated_images/prompt-sample-cinematic.jpg';
import cartoonSample from '@assets/generated_images/prompt-sample-cartoon.jpg';
import realisticSample from '@assets/generated_images/prompt-sample-realistic.jpg';

export interface PromptSampleImage {
  url: string;
  type: 'dataset' | 'category';
  fallbackUrl: string;
}

const categorySamples: Record<string, string> = {
  disney: disneySample,
  games: gamesSample,
  modeling: modelingSample,
  cinematic: cinematicSample,
  cartoon: cartoonSample,
  realistic: realisticSample,
};

function getCategorySample(category: string): string {
  return categorySamples[category.toLowerCase()] ?? realisticSample;
}

/** Returns a matched CC0 DiffusionDB image for library prompts, otherwise category artwork. */
export function getPromptSampleImage(promptId: string, category: string): PromptSampleImage {
  const fallbackUrl = getCategorySample(category);
  if (promptId.startsWith('diffusiondb-')) {
    return {
      url: `${import.meta.env.BASE_URL}prompt-samples/${encodeURIComponent(promptId)}.webp`,
      type: 'dataset',
      fallbackUrl,
    };
  }
  return { url: fallbackUrl, type: 'category', fallbackUrl };
}

export function getCategoryPromptSample(category: string): string {
  return getCategorySample(category);
}