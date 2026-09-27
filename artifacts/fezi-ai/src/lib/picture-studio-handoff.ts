/** Carry an unlocked gallery prompt into Picture Studio without exposing its text in the URL. */
export const isAngleReferencePrompt = (id: string) =>
  id === 'every-camera-angle' || id === 'twelve-panel-version-of-every-angle' || id === 'twelve-panel-every-angle-v2' || id === 'nine-panel-every-angle-prompt';
export const isReferenceOnlyPrompt = (id: string) =>
  isAngleReferencePrompt(id) || id === 'community-sheet-prompt' || id === '12-men-hair-style' || id === '12-women-hair-style' || id === '12-women-hair-style-v1';

export async function handoffToPictureStudio(id: string, title: string, promptText: string, coverUrl?: string | null) {
  window.sessionStorage.setItem('fezi_manika_prompt_draft', JSON.stringify({ id, prompt: promptText }));
  window.sessionStorage.removeItem('fezi_studio_image_source');

  // Reference sheets are examples, not the user's source portrait or character.
  if (!coverUrl || isReferenceOnlyPrompt(id)) return;
  try {
    const response = await fetch(coverUrl);
    if (!response.ok) return;
    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    window.sessionStorage.setItem('fezi_studio_image_source', JSON.stringify({
      name: title, dataUrl, mimeType: blob.type || 'image/jpeg', kind: 'image',
    }));
  } catch {
    // The prompt remains usable even if the optional gallery example cannot load.
  }
}