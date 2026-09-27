export type GeneratePromptInput = {
  kind: 'image' | 'video';
  brief: string;
  model?: string;
  websiteUrl?: string;
  language: 'fa' | 'en';
  durationSeconds?: number;
};

export type GeneratePromptResult = {
  prompt: string;
  creditsUsed: number;
  websiteChecked: boolean;
  websiteTitle?: string;
  remainingCredits: number;
};

export type UnlockPromptResult = {
  promptText: string;
  creditsUsed: number;
};

export class PromptStudioActionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function postPromptStudio<T>(path: string, body: object, getToken: () => Promise<string | null>): Promise<T> {
  const token = await getToken();
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string; message?: string };
    throw new PromptStudioActionError(response.status, payload.message || payload.error || 'Request failed');
  }
  return response.json() as Promise<T>;
}

export const generateStudioPrompt = (input: GeneratePromptInput, getToken: () => Promise<string | null>) =>
  postPromptStudio<GeneratePromptResult>('/api/prompt-studio/generate', input, getToken);

export const unlockStudioPrompt = (id: string, action: 'copy' | 'use', getToken: () => Promise<string | null>) =>
  postPromptStudio<UnlockPromptResult>(`/api/prompt-studio/prompts/${encodeURIComponent(id)}/unlock`, { action }, getToken);