import { Storage } from "@google-cloud/storage";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { db, promptStudioImagesTable, promptStudioPromptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const SIDECAR = "http://127.0.0.1:1106";
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit", subject_token_type: "access_token", token_url: `${SIDECAR}/token`,
    type: "external_account", credential_source: { url: `${SIDECAR}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export async function savePromptStudioImage(input: Buffer, stableId?: string) {
  const out = await sharp(input, { limitInputPixels: 25_000_000 }).rotate()
    .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 }).toBuffer();
  const bucketName = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketName) throw new Error("Object storage is not configured");
  const id = stableId || randomUUID();
  const objectKey = `prompt-studio/${id}.webp`;
  await objectStorageClient.bucket(bucketName).file(objectKey).save(out, { contentType: "image/webp", resumable: false });
  return { id, objectKey };
}

export async function publishGeneratedPromptImage(promptId: string, generationPrompt: string, imageBase64: string, mimeType: string, ownerUserId: string) {
  const [prompt] = await db.select().from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, promptId)).limit(1);
  if (!prompt) throw new Error("Prompt Studio prompt was not found");
  if (!generationPrompt.includes(prompt.promptText)) throw new Error("Generated prompt does not contain the canonical Prompt Studio text");
  const { id, objectKey } = await savePromptStudioImage(Buffer.from(imageBase64, "base64"));
  try {
    const [image] = await db.insert(promptStudioImagesTable).values({ id, promptId, ownerUserId, objectKey, mimeType: "image/webp" }).returning();
    return { id: image.id, url: `/api/prompt-studio/images/${image.id}`, createdAt: image.createdAt.toISOString() };
  } catch (error) {
    await deletePromptStudioObject(objectKey);
    throw error;
  }
}

export async function deletePromptStudioObject(objectKey: string) {
  const bucketName = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketName || !objectKey.startsWith("prompt-studio/")) return;
  await objectStorageClient.bucket(bucketName).file(objectKey).delete({ ignoreNotFound: true });
}