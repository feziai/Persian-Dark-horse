import { randomUUID } from "node:crypto";
import { objectStorageClient } from "../lib/promptStudioStorage";

const prefix = "chat-media/";

export async function preflightChatMediaStorage() {
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) throw new Error("App Storage is not configured for chat media.");
  // App Storage's scoped credentials permit object access but may not permit
  // storage.buckets.get. A bounded read-only prefix probe checks the actual
  // object API without a misleading 403 from bucket.exists().
  await objectStorageClient.bucket(bucket).getFiles({ prefix, maxResults: 1 });
  return bucket;
}

export async function saveChatMedia(bucket: string, bytes: Buffer, mimeType: string) {
  if (!bytes.length || bytes.length > 30 * 1024 * 1024) throw new Error("The generated media is empty or too large.");
  const validBytes = mimeType === "video/mp4" ? bytes.length >= 12 && bytes.toString("ascii", 4, 8) === "ftyp"
    : mimeType === "image/png" ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === "image/jpeg" ? bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
    : mimeType === "image/webp" ? bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
    : false;
  if (!validBytes) throw new Error("The generator did not return valid media bytes for its declared type.");
  const ext = mimeType === "video/mp4" ? "mp4" : mimeType === "image/jpeg" ? "jpg" : mimeType === "image/webp" ? "webp" : mimeType === "image/png" ? "png" : "";
  if (!ext) throw new Error("The generator returned an unsupported media format.");
  const key = `${prefix}${randomUUID()}.${ext}`;
  const file = objectStorageClient.bucket(bucket).file(key);
  await file.save(bytes, { resumable: false, contentType: mimeType, metadata: { cacheControl: "private, no-store" } });
  return key;
}

export async function removeChatMedia(bucket: string, key: string) {
  if (key.startsWith(prefix)) await objectStorageClient.bucket(bucket).file(key).delete({ ignoreNotFound: true });
}

export function chatMediaFile(bucket: string, key: string) {
  if (!key.startsWith(prefix) || key.includes("..")) throw new Error("Invalid chat media key.");
  return objectStorageClient.bucket(bucket).file(key);
}