/**
 * Native text-to-video for inline chat (not the still-image FFmpeg preview).
 * xAI REST contract: https://docs.x.ai/developers/model-capabilities/video/generation
 * Model pricing: https://docs.x.ai/developers/models/grok-imagine-video-1.5
 */

const MODEL = "grok-imagine-video-1.5";
const DURATION_SECONDS = 5;
// Official model page lists 480p text-to-video output at $0.08/second.
export const NATIVE_CHAT_VIDEO_COST_USD = DURATION_SECONDS * 0.08;
// The least expensive one-time video-eligible package is 200,000 Credits/$120.
// ceil(($0.40 / 0.75) / ($120 / 200000)) = 889 Credits for >=25% gross margin.
export const NATIVE_CHAT_VIDEO_MIN_CREDITS = Math.ceil(NATIVE_CHAT_VIDEO_COST_USD / 0.75 / (120 / 200_000));
const API_ORIGIN = "https://api.x.ai";
const OUTPUT_HOST = "vidgen.x.ai"; // Host shown in xAI's official completed-response example.
const MAX_PROMPT_LENGTH = 4000;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_JSON_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 180_000;
const POLL_INTERVAL_MS = 4_000;

export function isNativeChatVideoConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

function assertOutputUrl(value: unknown): URL {
  if (typeof value !== "string") throw new Error("xAI did not return a video URL.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("xAI returned an invalid video URL.");
  }
  // No arbitrary user-controlled URLs, redirects, credentials, ports or lookalike subdomains.
  if (url.protocol !== "https:" || url.hostname !== OUTPUT_HOST || url.port ||
      url.username || url.password || !url.pathname.startsWith("/") ||
      url.pathname.includes("..") || url.hash) {
    throw new Error("xAI returned a video URL outside the permitted host.");
  }
  return url;
}

async function readLimited(response: Response, limit: number): Promise<Buffer> {
  const length = response.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
    await response.body?.cancel();
    throw new Error("xAI video response exceeds the size limit.");
  }
  if (!response.body) throw new Error("xAI returned an empty response.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("xAI video response exceeds the size limit.");
      chunks.push(value);
    }
  } finally {
    if (size > limit) await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
}

async function jsonResponse(response: Response): Promise<Record<string, unknown>> {
  if (!response.ok) throw new Error(`xAI video request failed (HTTP ${response.status}).`);
  const data = await readLimited(response, MAX_JSON_BYTES);
  try {
    const parsed: unknown = JSON.parse(data.toString("utf8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Do not include the provider body; it can contain user prompts or signed URLs.
  }
  throw new Error("xAI returned an invalid video response.");
}

/**
 * Generates a five-second 480p MP4. Estimated provider output cost is $0.40
 * ($0.08/second); the caller must charge at least NATIVE_CHAT_VIDEO_MIN_CREDITS
 * (not the older providerCreditCost(250) inline-video charge).
 * Never calls a paid provider unless invoked explicitly.
 */
export async function requestNativeChatVideo(
  prompt: string,
  signal?: AbortSignal,
): Promise<{ video: Buffer; mimeType: "video/mp4"; model: string; durationSeconds: number }> {
  if (!isNativeChatVideoConfigured()) throw new Error("XAI_API_KEY is not configured for native video.");
  if (typeof prompt !== "string" || prompt.trim().length < 3 || prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Video prompt must contain 3–${MAX_PROMPT_LENGTH} characters.`);
  }
  const key = process.env.XAI_API_KEY!;
  const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  const apiFetch = async (url: string, options: RequestInit = {}) => {
    combined.throwIfAborted();
    return fetch(url, { ...options, headers, signal: combined, redirect: "error" });
  };
  try {
    const started = await jsonResponse(await apiFetch(`${API_ORIGIN}/v1/videos/generations`, {
      method: "POST",
      body: JSON.stringify({ model: MODEL, prompt: prompt.trim(), duration: DURATION_SECONDS, aspect_ratio: "16:9", resolution: "480p" }),
    }));
    const requestId = started.request_id;
    if (typeof requestId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) {
      throw new Error("xAI did not return a valid video request ID.");
    }
    while (!combined.aborted) {
      const result = await jsonResponse(await apiFetch(`${API_ORIGIN}/v1/videos/${requestId}`));
      if (result.status === "failed" || result.status === "expired") {
        throw new Error(`xAI video generation ${result.status}.`);
      }
      if (result.status === "done") {
        const metadata = result.video;
        if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
          throw new Error("xAI returned no video metadata.");
        }
        const videoInfo = metadata as Record<string, unknown>;
        if (videoInfo.respect_moderation === false) throw new Error("xAI rejected the video under its moderation policy.");
        const url = assertOutputUrl(videoInfo.url);
        // No auth header on media requests: signed output URL is sufficient.
        combined.throwIfAborted();
        const media = await fetch(url, { signal: combined, redirect: "error" });
        if (!media.ok) throw new Error(`xAI video download failed (HTTP ${media.status}).`);
        if (media.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "video/mp4") {
          await media.body?.cancel();
          throw new Error("xAI did not return MP4 video media.");
        }
        const video = await readLimited(media, MAX_VIDEO_BYTES);
        if (video.length < 12 || video.toString("ascii", 4, 8) !== "ftyp") {
          throw new Error("xAI returned invalid MP4 media.");
        }
        const duration = videoInfo.duration;
        return {
          video,
          mimeType: "video/mp4",
          model: MODEL,
          durationSeconds: typeof duration === "number" && Number.isFinite(duration) && duration >= 1 && duration <= 15
            ? duration : DURATION_SECONDS,
        };
      }
      if (result.status !== "pending") throw new Error("xAI returned an unknown video status.");
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          combined.removeEventListener("abort", onAbort);
          resolve();
        }, POLL_INTERVAL_MS);
        const onAbort = () => {
          clearTimeout(timer);
          reject(combined.reason);
        };
        combined.addEventListener("abort", onAbort, { once: true });
        if (combined.aborted) onAbort();
      });
    }
    throw combined.reason;
  } catch (error) {
    if (deadline.aborted && !signal?.aborted) throw new Error("xAI video generation timed out.");
    throw error;
  }
}