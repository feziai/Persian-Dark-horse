/**
 * Hugging Face Inference Providers / fal-ai Stable Diffusion XL adapter.
 *
 * The public model mapping is checked at request time: a model page alone does
 * not establish that the provider is currently serving it. The fal-ai provider
 * returns an image URL, rather than raw image bytes; never hand that URL back
 * without fetching and validating the actual image.
 *
 * https://huggingface.co/docs/inference-providers/tasks/text-to-image
 * https://huggingface.co/api/models/stabilityai/stable-diffusion-xl-base-1.0?expand[]=inferenceProviderMapping
 * https://github.com/huggingface/huggingface_hub/blob/main/src/huggingface_hub/inference/_providers/fal_ai.py
 */

const MODEL = "stabilityai/stable-diffusion-xl-base-1.0";
const MAPPING_URL = `https://huggingface.co/api/models/${MODEL}?expand[]=inferenceProviderMapping`;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

type ImageResult = { imageBase64: string; mimeType: string; model: string };

export function isStableDiffusionAvailable(): boolean {
  // The key must be a Hugging Face token: the router cannot use a native fal key.
  return Boolean(process.env.HUGGINGFACE_API_KEY?.trim().startsWith("hf_"));
}

export const isStableDiffusionConfigured = isStableDiffusionAvailable;

function getImageMimeType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return "image/png";
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

async function readBoundedImage(response: Response): Promise<{ imageBase64: string; mimeType: string }> {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_IMAGE_BYTES) throw new Error("Stable Diffusion image exceeds size limit");
  const stream = response.body;
  if (!stream) throw new Error("Stable Diffusion image response is empty");
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BYTES) throw new Error("Stable Diffusion image exceeds size limit");
      chunks.push(value);
    }
  } finally {
    // Cancellation of a tee'd stream can wait indefinitely for another reader.
    // Do not block error reporting on the remote stream's cancellation.
    void reader.cancel().catch(() => {});
  }
  const bytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), size);
  if (bytes.length < 100) throw new Error("Stable Diffusion image response is too small");
  const mimeType = getImageMimeType(bytes);
  if (!mimeType || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== mimeType)
    throw new Error("Stable Diffusion returned an invalid image type");
  return { imageBase64: bytes.toString("base64"), mimeType };
}

export async function requestStableDiffusionImage(
  prompt: string,
  imageBase64?: string,
  imageMimeType?: string,
): Promise<ImageResult> {
  if (!isStableDiffusionAvailable()) throw new Error("Stable Diffusion unavailable: Hugging Face Inference Providers token is not configured");
  // This mapping serves text-to-image only. Never silently drop a reference image.
  if (imageBase64 !== undefined || imageMimeType !== undefined)
    throw new Error("Stable Diffusion XL reference images are not supported by this text-to-image endpoint");
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 4000)
    throw new Error("Stable Diffusion prompt must contain 1–4000 characters");

  const mappingResponse = await fetch(MAPPING_URL, {
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!mappingResponse.ok) throw new Error(`Stable Diffusion provider lookup failed (${mappingResponse.status})`);
  const mapping = await mappingResponse.json() as {
    inferenceProviderMapping?: { "fal-ai"?: { status?: string; providerId?: string; task?: string } };
  };
  const provider = mapping.inferenceProviderMapping?.["fal-ai"];
  if (provider?.status !== "live" || provider.task !== "text-to-image" ||
      !provider.providerId || !/^fal-ai\/[a-zA-Z0-9/_-]+$/.test(provider.providerId))
    throw new Error("Stable Diffusion unavailable: no live fal-ai text-to-image provider mapping");

  // The two fal-ai segments are intentional: the router's provider prefix is
  // followed by the mapped fal model ID (currently "fal-ai/fast-sdxl").
  // This matches huggingface_hub's TaskProviderHelper._prepare_base_url /
  // _prepare_url and FalAITask._prepare_route.
  const generationResponse = await fetch(`https://router.huggingface.co/fal-ai/${provider.providerId}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY!.trim()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ prompt: prompt.trim() }),
    signal: AbortSignal.timeout(90_000),
    redirect: "error",
  });
  if (!generationResponse.ok) throw new Error(`Stable Diffusion generation failed (${generationResponse.status})`);
  const result = await generationResponse.json() as { images?: Array<{ url?: unknown }> };
  const imageUrl = result.images?.[0]?.url;
  if (typeof imageUrl !== "string") throw new Error("Stable Diffusion provider did not return an image");
  let url: URL;
  try {
    url = new URL(imageUrl);
  } catch {
    throw new Error("Stable Diffusion provider returned an invalid image URL");
  }
  // Only retrieve images from fal's media CDN, never arbitrary URLs supplied in responses.
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !(url.hostname === "fal.media" || url.hostname.endsWith(".fal.media")))
    throw new Error("Stable Diffusion provider returned an untrusted image URL");
  const imageResponse = await fetch(url, { signal: AbortSignal.timeout(20_000), redirect: "error" });
  if (!imageResponse.ok) throw new Error(`Stable Diffusion image download failed (${imageResponse.status})`);
  const image = await readBoundedImage(imageResponse);
  return { ...image, model: MODEL };
}