import { Router, type IRouter, type Request } from "express";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  db, promptStudioCommentsTable,
  promptStudioImagesTable, promptStudioPromptsTable,
  promptStudioRatingsTable,
  userProfilesTable,
} from "@workspace/db";
import { RatePromptStudioPromptBody, UnlockPromptStudioPromptBody } from "@workspace/api-zod";
import { getAuthenticatedUserId, requireAuth } from "../middlewares/auth";
import { deletePromptStudioObject, objectStorageClient, savePromptStudioImage } from "../lib/promptStudioStorage";
import { clerkClient } from "@clerk/express";
import { accountPhotoUrl } from "../lib/profile-defaults";
import { announceCuratedGalleryPrompt, announceGalleryPrompt, ensureProfile, promptCommunityUrl, query as communityQuery, removePost } from "../lib/community";
import promptLibrary from "../data/prompt-library.json";
import pinkDevilCosplayPrompt from "../data/pink-devil-cosplayer.json";
import strawberryIceCreamPrompt from "../data/strawberry-ice-cream-close-up.json";
import everyCameraAnglePrompt from "../data/every-camera-angle";
import communitySheetPrompt from "../data/community-sheet-prompt";

const router: IRouter = Router();
const attachedAssetsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../../../attached_assets");
const writeBuckets = new Map<string, { count: number; resetAt: number }>();
router.use((req, res, next) => {
  if (req.method === "GET") return next();
  const userId = getAuthenticatedUserId(req);
  if (!userId) return next();
  const now = Date.now(), bucket = writeBuckets.get(userId);
  if (!bucket || bucket.resetAt <= now) writeBuckets.set(userId, { count: 1, resetAt: now + 60_000 });
  else if (++bucket.count > 30) { res.status(429).json({ error: "Too many Prompt Studio changes. Try again shortly." }); return; }
  next();
});
const categories = ["realistic", "cartoon", "cinematic", "modeling", "disney", "games", "thumbnails", "made-by-fezi"] as const;
// Manual prompts stay private drafts until the creator has uploaded a picture.
const publicPromptFilter = sql<boolean>`(${promptStudioPromptsTable.builtIn} <> 'false' OR EXISTS (
  SELECT 1 FROM ${promptStudioImagesTable} owner_image
  WHERE owner_image.prompt_id = ${promptStudioPromptsTable.id}
    AND owner_image.owner_user_id = ${promptStudioPromptsTable.ownerUserId}
 ))`;
async function hasCreatorImage(promptId: string, creatorId: string | null) {
  if (!creatorId) return false;
  const [image] = await db.select({ id: promptStudioImagesTable.id }).from(promptStudioImagesTable)
    .where(and(eq(promptStudioImagesTable.promptId, promptId), eq(promptStudioImagesTable.ownerUserId, creatorId))).limit(1);
  return Boolean(image);
}
const libraryAuthor = { publicId: "library", displayName: "Persian Dark Horse Prompt Library", avatarId: "" };
const FEZI_NEWSPAPER_PROMPT_ID = "fezi-reading-newspaper-206-burning";
const COSPLAY_PROMPT_ID = "pink-devil-cosplayer-with-cat";
const STRAWBERRY_ICE_CREAM_PROMPT_ID = "strawberry-ice-cream-close-up";
const WATER_PORTRAIT_PROMPT_ID = "water-caustics-close-up-portrait";
const PERSIAN_DARK_HORSE_LIVE_PROMPT_ID = "persian-dark-horse-is-live-thumbnail";
const EVERY_CAMERA_ANGLE_PROMPT_ID = "every-camera-angle";
const TWELVE_PANEL_EVERY_ANGLE_PROMPT_ID = "twelve-panel-version-of-every-angle";
const TWELVE_PANEL_V2_PROMPT_ID = "twelve-panel-every-angle-v2";
const NINE_PANEL_EVERY_ANGLE_PROMPT_ID = "nine-panel-every-angle-prompt";
const COMMUNITY_SHEET_PROMPT_ID = "community-sheet-prompt";
const TWELVE_MEN_HAIR_STYLE_PROMPT_ID = "12-men-hair-style";
const TWELVE_WOMEN_HAIR_STYLE_PROMPT_ID = "12-women-hair-style";
const TWELVE_WOMEN_HAIR_STYLE_V1_PROMPT_ID = "12-women-hair-style-v1";
// The recently added reference sheet predates Community auto-announcements.
const pendingCuratedAnnouncements = new Set([EVERY_CAMERA_ANGLE_PROMPT_ID]);
const FEATURED_PROMPT_IDS = [WATER_PORTRAIT_PROMPT_ID, FEZI_NEWSPAPER_PROMPT_ID, COSPLAY_PROMPT_ID, STRAWBERRY_ICE_CREAM_PROMPT_ID] as const;
const featuredPromptIds = new Set<string>(FEATURED_PROMPT_IDS);
const FEZI_NEWSPAPER_IMAGES = [
  { id: "fezi-reading-newspaper-206-burning-1", file: "file_0000000024f48210825c1c974cfbd8a2_1790239958449.png" },
  { id: "fezi-reading-newspaper-206-burning-2", file: "WPu-SgvNFNuucuE_vHaXpWb5jbU-B_RjEsaQTjap0G8UzKoktA_1790240082069.png" },
  { id: "fezi-reading-newspaper-206-burning-3", file: "file_00000000f7f082109ac26432993728c0_1790240082079.png" },
  { id: "fezi-reading-newspaper-206-burning-4", file: "1788917678703_1790240082098.png" },
] as const;
const presets = [
  { id: "emerald-noir-editorial", title: "Emerald Noir Editorial", description: "A cinematic late-70s / early-80s high-fashion portrait with emerald felt, pearls, scarlet heels, harsh overhead light, and authentic film texture.", category: "cinematic", promptText: `A young Caucasian woman reclines languidly across the rich emerald felt of a vintage pool table, her body stretched out diagonally with an effortless yet commanding grace. Dressed in a fitted nude-toned bodysuit that contours each curve with sleek minimalism, she props herself up on one elbow while her other hand grazes her glossy parted lips, a gesture both playful and seductively inviting. Her legs bend upward behind her, accentuated by striking scarlet stiletto heels that catch the overhead lighting with a vivid, almost liquid gleam, creating a sharp, vibrant contrast against the deep green surface beneath her.

Around her neck coils a classic string of pearls, shimmering softly with old-Hollywood sophistication, while large rings and subtle fine jewelry glint gently in the focused light, weaving an aura of indulgent luxury around her. Her loose, voluminous waves are partially pulled back, the soft texture catching hints of the stark illumination, complementing smoky eye makeup and sculpted cheekbones that frame her relaxed yet intense expression.

Three harsh overhead lamps cast pools of dramatic light that spotlight the woman and the pool table, the scene framed by deep shadows swallowing the rest of the room into near-total darkness. The high-contrast lighting sculpts her silhouette into sharp relief against the saturated colors, the atmosphere thick with noir seduction and editorial glamour that feels both cinematic and dangerously intimate.

Captured at a slightly elevated, mid-shot vantage using a classic 50mm focal length on 35mm film stock, this composition reveals textured analog grain and gate weave, tactile with the velvet felt's weave and the gleam of patent leather heels—invoking the mood and style of a neo-noir 1980s fashion campaign. —late-70s / early-80s cinematic photograph, authentic film grain.` },
  { id: "crimson-silk-noir-editorial", title: "Crimson Silk Noir", description: "An adult fashion editorial with red silk, black bedding, dramatic side light, and a dark studio atmosphere.", category: "cinematic", promptText: `A sultry editorial photograph of a woman in red silk lingerie on all fours on a minimalist bed with black silk sheets. She arches her back gracefully, looking over her shoulder at the camera with a seductive expression. Her hair falls naturally over one shoulder. Dramatic side lighting creates strong shadows and highlights, emphasizing body curves and fabric texture. Shot with 85mm lens, f/2.2. Moody color grading with deep reds and blacks. The composition is artistic yet provocative, inspired by high-end adult fashion editorials. Studio setting with dark, mysterious atmosphere.` },
  { id: "monochrome-stool-lingerie", title: "Monochrome Stool Lingerie", description: "A high-contrast black-and-white lingerie editorial built around a dynamic stool pose, stockings, hard studio light, and a minimalist backdrop.", category: "modeling", promptText: `Black-and-white editorial photograph of an adult woman in a dynamic pose on a stool, wearing elegant black lingerie with stockings in a minimalist studio setting. Use the attached reference image for the pose, stool composition, body positioning, and dramatic shadow direction while preserving the subject's identity only as requested. High-contrast monochrome lighting, a clean gray-to-white studio backdrop, sculptural shadows falling across the floor and wall, confident fashion-editorial expression, refined lingerie styling, crisp fabric and stocking texture, elegant elongated lines, cinematic composition, tactile film grain, professional studio photography, artistic and non-explicit adult fashion editorial.` },
  {
    id: COSPLAY_PROMPT_ID,
    title: "Afternoon Cosplay with a Curious Cat",
    description: "A warm vertical portrait with pastel-pink hair, small devil horns, a fluffy white cat, and late-afternoon window light.",
    category: "realistic",
    promptText: JSON.stringify(pinkDevilCosplayPrompt),
  },
  {
    id: STRAWBERRY_ICE_CREAM_PROMPT_ID,
    title: "Strawberry Ice Cream Close-Up",
    description: "A photorealistic summer close-up portrait with glossy pink lips, melting strawberry ice cream, and a turquoise pool backdrop.",
    category: "realistic",
    promptText: strawberryIceCreamPrompt,
  },
  {
    id: WATER_PORTRAIT_PROMPT_ID,
    title: "Water Caustics Close-Up Portrait",
    description: "A dreamy, photorealistic close-up portrait emerging from clear water, with rippling light, droplets, and cinematic detail.",
    category: "realistic",
    promptText: "extreme close-up portrait of a beautiful young woman's face emerging from water, serene expression with eyes gently closed, slightly parted glossy lips, delicate nose, water droplets and thin streams cascading over flawless skin, realistic water refraction and caustics, crystal clear water bubbles and ripples around the face, soft cinematic lighting with subtle highlights and rim light, hyper-detailed skin texture, pores, wet sheen, photorealistic, 8k, ultra-realistic, sharp focus, depth of field, moody dreamy atmosphere, shot on 85mm lens, professional photography --ar 2:3 --v 6 --q 2 --stylize 250",
  },
] as const;

function publicId(userId: string) { return createHash("sha256").update(`fezi-public:${userId}`).digest("hex").slice(0, 24); }
function isPreparedGalleryPrompt(prompt: typeof promptStudioPromptsTable.$inferSelect) {
  return prompt.builtIn === "true" || prompt.builtIn === "library";
}
async function author(userId: string | null | undefined) {
  if (!userId) return { publicId: "fezi", displayName: "Persian Dark Horse", avatarId: "" };
  const [p] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
  let displayName = p?.displayName?.trim() || "";
  let avatarId = p?.avatarId || "";
  if (!displayName || avatarId === "account-photo" || avatarId === "") {
    try {
      const clerkUser = await clerkClient.users.getUser(userId);
      if (!displayName) displayName = clerkUser.username?.trim() || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
      if (avatarId === "account-photo" || avatarId === "") avatarId = accountPhotoUrl(clerkUser) ?? "";
    } catch { /* profile remains anonymous if Clerk is unavailable */ }
  }
  return { publicId: publicId(userId), displayName: displayName || "Persian Dark Horse Creator", avatarId };
}
async function ensurePresets() {
  const newspaperPromptText = (await readFile(
    resolve(attachedAssetsDirectory, "Pasted-Create-a-highly-realistic-staged-editorial-photograph-i_1790239769924.txt"),
    "utf8",
  )).trim();
  const twelvePanelPromptText = (await readFile(
    resolve(attachedAssetsDirectory, "Pasted--12-PANEL-ZONE-BOARD-V1-PROMPT-Purpose-camera-angle-cat_1790533256579.txt"),
    "utf8",
  )).trim();
  const twelvePanelV2PromptText = (await readFile(
    resolve(attachedAssetsDirectory, "Pasted-Purpose-camera-angle-catalogue-one-person-one-location-_1790533485259.txt"),
    "utf8",
  )).trim();
  const ninePanelPromptText = (await readFile(
    resolve(attachedAssetsDirectory, "Pasted-Purpose-camera-angle-catalogue-one-person-one-location-_1790533627674.txt"),
    "utf8",
  )).trim();
  const hairstylePromptSource = (await readFile(
    resolve(attachedAssetsDirectory, "Pasted-Locks-any-beard-stubble-or-moustache-pixel-identical-ac_1790534689950.txt"),
    "utf8",
  )).trim();
  const hairstylesStart = hairstylePromptSource.indexOf("## The 12 Hairstyles");
  const hairstylesEnd = hairstylePromptSource.indexOf("## Photographic Specs", hairstylesStart);
  if (hairstylesStart < 0 || hairstylesEnd < 0) throw new Error("The 12 men hair style prompt is missing a hairstyles or photographic specs section.");
  // The user's numbered hairstyle list takes precedence over differing labels in the attached detailed prompt.
  const twelveMenHairStylePromptText = `${hairstylePromptSource.slice(0, hairstylesStart)}## The 12 Hairstyles

1. Spiky crop, faded sides
2. French crop, blunt fringe
3. Tousled wavy
4. Man bun, faded sides
5. Buzz cut, sharp lineup
6. Side-part slick-back
7. Messy French
8. Slick back, glossy
9. Spiky volume top
10. Tapered mullet
11. Short curly crop
12. Hollywood waves

Optional alternate style: Pixie cut. Substitute it for one of the twelve numbered hairstyles only if requested; do not add a thirteenth panel.

${hairstylePromptSource.slice(hairstylesEnd)}`;
  const womenHairstylePromptSource = (await readFile(
    resolve(attachedAssetsDirectory, "Pasted-Locks-makeup-and-skin-identical-across-all-12-use-for-f_1790535114811.txt"),
    "utf8",
  )).trim();
  if (!womenHairstylePromptSource.includes("5. Curtain bangs, medium length —") ||
      !womenHairstylePromptSource.includes("12. Side-swept Hollywood waves —")) {
    throw new Error("The 12 women Hair style prompt is missing its expected hairstyle labels.");
  }
  const twelveWomenHairStylePromptText = womenHairstylePromptSource
    .replace("5. Curtain bangs, medium length —", "5. Curtain bangs —")
    .replace("12. Side-swept Hollywood waves —", "12. Hollywood waves —");
  const seedPresets = [
    ...presets,
    {
      id: FEZI_NEWSPAPER_PROMPT_ID,
      title: "Fezi reading newspaper when 206 burning",
      description: "A staged editorial portrait of a man reading a newspaper beside a burning Peugeot 206.",
      category: "made-by-fezi",
      promptText: newspaperPromptText,
    },
    {
      id: PERSIAN_DARK_HORSE_LIVE_PROMPT_ID,
      title: "Persian Dark Horse is Live",
      description: "An epic AI launch thumbnail with a green-coated supervillain and a blue-green energy explosion.",
      category: "thumbnails",
      promptText: "Create a dramatic 16:9 YouTube thumbnail using the attached portrait as the identity reference for the central character. Preserve his recognizable facial features, glasses, dark hair, and facial hair, but restyle him as a charismatic supervillain wearing an elegant vivid green coat, with polished hair and a confident, mischievous villainous smile. Show him in a powerful close-up, leaning toward and clicking a large glowing launch/publish button in the foreground. Depict the instant an immense AI is unleashed upon the world: a colossal surreal artificial-intelligence presence emerging behind him amid an overwhelming nuclear-scale explosion of blue-green light, blazing energy rings, dramatic shockwaves, sparks, smoke, and futuristic digital structures. The mood should feel epic, apocalyptic, surreal, and high-impact, like an AI bomb detonating across the world, while keeping the scene visually clear and suitable for a compelling thumbnail. Use the first attached image as inspiration for a sleek luminous AI emblem or visual motif integrated into the energy spectacle, not as the main subject. Strong cinematic contrast, vivid electric cyan and emerald highlights, sharp subject separation, expressive face, dynamic composition, polished professional thumbnail art. Render the exact visible headline text prominently and legibly: “Persian Dark Horse is Live”. Preserve the wording, capitalization, and punctuation exactly; do not translate, alter, or omit it. --ar 3:2",
    },
    {
      id: EVERY_CAMERA_ANGLE_PROMPT_ID,
      title: "Every Camera Angle",
      description: "Nine camera angles of the same person in one concrete hall. Upload your own source portrait as Image 1; the gallery picture is an angle reference.",
      category: "made-by-fezi",
      promptText: everyCameraAnglePrompt,
    },
    {
      id: TWELVE_PANEL_EVERY_ANGLE_PROMPT_ID,
      title: "12 panel version of every angle",
      description: "Twelve camera angles of the same person in one concrete hall. Upload your own source portrait as Image 1; the gallery picture is an angle reference.",
      category: "made-by-fezi",
      promptText: twelvePanelPromptText,
    },
    {
      id: TWELVE_PANEL_V2_PROMPT_ID,
      title: "12 Panel Every angle v2",
      description: "A 12-panel camera-angle catalogue of one person in a concrete hall. Upload your own source portrait as Image 1; the gallery picture is an angle reference.",
      category: "made-by-fezi",
      promptText: twelvePanelV2PromptText,
    },
    {
      id: NINE_PANEL_EVERY_ANGLE_PROMPT_ID,
      title: "9panel Every angle Prompt",
      description: "Nine camera angles of one person in a concrete hall. Upload your own source portrait as Image 1; the gallery pictures are angle references.",
      category: "made-by-fezi",
      promptText: ninePanelPromptText,
    },
    {
      id: COMMUNITY_SHEET_PROMPT_ID,
      title: "Community sheet Prompt",
      description: "An eight-section AI video character continuity sheet. Replace the name and upload your own character reference; the gallery picture is an example.",
      category: "made-by-fezi",
      promptText: communitySheetPrompt,
    },
    {
      id: TWELVE_MEN_HAIR_STYLE_PROMPT_ID,
      title: "12 men hair style",
      description: "A twelve-panel men's hairstyle lookbook. Upload your own source portrait; the gallery picture is an example, not the identity reference.",
      category: "made-by-fezi",
      promptText: twelveMenHairStylePromptText,
    },
    {
      id: TWELVE_WOMEN_HAIR_STYLE_PROMPT_ID,
      title: "12 women Hair style",
      description: "A twelve-panel women's hairstyle lookbook. Upload your own source portrait; the gallery picture is an example, not the identity reference.",
      category: "made-by-fezi",
      promptText: twelveWomenHairStylePromptText,
    },
    {
      id: TWELVE_WOMEN_HAIR_STYLE_V1_PROMPT_ID,
      title: "12 women Hair style v1",
      description: "A twelve-panel women's hairstyle lookbook with a second example. Upload your own source portrait; the gallery picture is not the identity reference.",
      category: "made-by-fezi",
      promptText: twelveWomenHairStylePromptText,
    },
  ];
  for (const p of seedPresets) {
    const inserted = await db.insert(promptStudioPromptsTable).values({ ...p, ownerUserId: null, builtIn: "true" })
      .onConflictDoNothing().returning({ id: promptStudioPromptsTable.id });
    if (inserted.length) pendingCuratedAnnouncements.add(p.id);
  }
  // Existing curated prompts are normally insert-only; apply this requested text edit to the already-published entry.
  await db.update(promptStudioPromptsTable).set({ promptText: twelveMenHairStylePromptText })
    .where(and(
      eq(promptStudioPromptsTable.id, TWELVE_MEN_HAIR_STYLE_PROMPT_ID),
      eq(promptStudioPromptsTable.builtIn, "true"),
      isNull(promptStudioPromptsTable.ownerUserId),
      sql`${promptStudioPromptsTable.promptText} <> ${twelveMenHairStylePromptText}`,
    ));
  for (let start = 0; start < promptLibrary.length; start += 50) {
    await db.insert(promptStudioPromptsTable).values(
      promptLibrary.slice(start, start + 50).map(p => ({
        ...p, description: "", ownerUserId: null, builtIn: "library",
      })),
    ).onConflictDoNothing();
  }

  const seedTime = Date.now();
  for (const { promptId, images } of [
    { promptId: FEZI_NEWSPAPER_PROMPT_ID, images: [...FEZI_NEWSPAPER_IMAGES].reverse() },
    { promptId: WATER_PORTRAIT_PROMPT_ID, images: [{ id: "water-caustics-close-up-portrait-1", file: "1768656275607_87e767e1-d708-4908-9f89-4a27d3ad45c4_1790299702263.jpg" }] },
    { promptId: PERSIAN_DARK_HORSE_LIVE_PROMPT_ID, images: [{ id: "persian-dark-horse-is-live-thumbnail-1", file: "file_000000008320821090178ac6606c3105_1790472331417.png" }] },
    { promptId: EVERY_CAMERA_ANGLE_PROMPT_ID, images: [{ id: "every-camera-angle-reference-1", file: "IMG_20260927_213156_1790532707252.jpg" }] },
    { promptId: TWELVE_PANEL_EVERY_ANGLE_PROMPT_ID, images: [{ id: "twelve-panel-every-angle-reference-1", file: "IMG_20260927_213217_1790533166376.jpg" }] },
    { promptId: TWELVE_PANEL_V2_PROMPT_ID, images: [{ id: "twelve-panel-every-angle-v2-reference-1", file: "IMG_20260927_213236_1790533421459.jpg" }] },
    { promptId: NINE_PANEL_EVERY_ANGLE_PROMPT_ID, images: [
      { id: "nine-panel-every-angle-reference-male", file: "IMG_20260927_213236_1790533640909.jpg" },
      { id: "nine-panel-every-angle-reference-blonde", file: "IMG_20260927_213304_1790533588286.jpg" },
    ] },
    { promptId: COMMUNITY_SHEET_PROMPT_ID, images: [
      { id: "community-sheet-example-1", file: "IMG_20260927_213500_1790534409703.jpg" },
      { id: "community-sheet-example-2", file: "IMG_20260927_213336_1790534440421.jpg" },
      { id: "community-sheet-example-3", file: "IMG_20260927_213359_1790534458605.jpg" },
      { id: "community-sheet-example-4", file: "IMG_20260927_213417_1790534498095.jpg" },
      { id: "community-sheet-example-5", file: "IMG_20260927_213439_1790534515712.jpg" },
    ] },
    { promptId: TWELVE_MEN_HAIR_STYLE_PROMPT_ID, images: [{ id: "twelve-men-hair-style-example-1", file: "IMG_20260927_213011_1790534984192.jpg" }] },
    { promptId: TWELVE_WOMEN_HAIR_STYLE_PROMPT_ID, images: [{ id: "twelve-women-hair-style-example-1", file: "IMG_20260927_213139_1790535256318.jpg" }] },
    { promptId: TWELVE_WOMEN_HAIR_STYLE_V1_PROMPT_ID, images: [
      { id: "twelve-women-hair-style-v1-example-1", file: "IMG_20260927_213029_1790535273256.jpg" },
      { id: "twelve-women-hair-style-v1-example-2", file: "IMG_20260927_213042_1790535461000.jpg" },
    ] },
  ]) {
    const existingSeedImages = await db.select({ id: promptStudioImagesTable.id })
      .from(promptStudioImagesTable)
      .where(and(
        eq(promptStudioImagesTable.promptId, promptId),
        isNull(promptStudioImagesTable.ownerUserId),
      ));
    const existingSeedImageIds = new Set(existingSeedImages.map(image => image.id));
    for (const [index, image] of images.entries()) {
      if (existingSeedImageIds.has(image.id)) continue;
      const bytes = await readFile(resolve(attachedAssetsDirectory, image.file));
      const { objectKey } = await savePromptStudioImage(bytes, image.id);
      await db.insert(promptStudioImagesTable).values({
        id: image.id,
        promptId,
        ownerUserId: null,
        objectKey,
        mimeType: "image/webp",
        createdAt: new Date(seedTime + index * 1000),
      }).onConflictDoNothing();
    }
  }
  for (const promptId of pendingCuratedAnnouncements) {
    await announceCuratedGalleryPrompt(promptId);
    pendingCuratedAnnouncements.delete(promptId);
  }
}
let presetsReady: Promise<void> | undefined;
export function initializePresets() {
  if (!presetsReady) presetsReady = ensurePresets().catch(error => {
    presetsReady = undefined;
    throw error;
  });
  return presetsReady;
}
function summary(
  p: typeof promptStudioPromptsTable.$inferSelect,
  images = 0,
  comments = 0,
  a?: Awaited<ReturnType<typeof author>>,
  coverImageUrl?: string,
  averageRating = 0,
  ratingCount = 0,
) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    promptText: isPreparedGalleryPrompt(p) ? "" : p.promptText,
    category: p.category,
    author: p.builtIn === "library" ? libraryAuthor : a ?? { publicId: "fezi", displayName: "Persian Dark Horse", avatarId: "" },
    imageCount: images,
    commentCount: comments,
    coverImageUrl,
    averageRating,
    ratingCount,
    featured: featuredPromptIds.has(p.id),
    createdAt: p.createdAt.toISOString(),
  };
}
async function profileSummaries(prompts: typeof promptStudioPromptsTable.$inferSelect[]) {
  if (!prompts.length) return [];
  const ids = prompts.map(p => p.id);
  const [images, comments, ratings] = await Promise.all([
    db.select({ id: promptStudioImagesTable.id, promptId: promptStudioImagesTable.promptId })
      .from(promptStudioImagesTable).where(inArray(promptStudioImagesTable.promptId, ids))
      .orderBy(desc(promptStudioImagesTable.createdAt)),
    db.select({ promptId: promptStudioCommentsTable.promptId, count: sql<number>`count(*)` })
      .from(promptStudioCommentsTable).where(inArray(promptStudioCommentsTable.promptId, ids))
      .groupBy(promptStudioCommentsTable.promptId),
    db.select({
      promptId: promptStudioRatingsTable.promptId,
      average: sql<number>`round(avg(${promptStudioRatingsTable.rating}), 1)::float`,
      count: sql<number>`count(*)`,
    }).from(promptStudioRatingsTable)
      .where(inArray(promptStudioRatingsTable.promptId, ids))
      .groupBy(promptStudioRatingsTable.promptId),
  ]);
  const imageCounts = new Map<string, number>();
  const covers = new Map<string, string>();
  for (const image of images) {
    imageCounts.set(image.promptId, (imageCounts.get(image.promptId) || 0) + 1);
    if (!covers.has(image.promptId)) covers.set(image.promptId, `/api/prompt-studio/images/${image.id}`);
  }
  const commentCounts = new Map(comments.map(c => [c.promptId, Number(c.count)]));
  const ratingStats = new Map(ratings.map(r => [r.promptId, {
    average: Number(r.average),
    count: Number(r.count),
  }]));
  const owners = new Map(await Promise.all(
    [...new Set(prompts.map(p => p.ownerUserId).filter((id): id is string => Boolean(id)))]
      .map(async id => [id, await author(id)] as const),
  ));
  return prompts.map(p => summary(p, imageCounts.get(p.id) || 0, commentCounts.get(p.id) || 0,
    p.ownerUserId ? owners.get(p.ownerUserId) : undefined, covers.get(p.id),
    ratingStats.get(p.id)?.average || 0, ratingStats.get(p.id)?.count || 0));
}
async function imageUrl(id: string) { return `/api/prompt-studio/images/${id}`; }

router.get("/prompt-studio/prompts", async (req, res) => {
  try {
    await initializePresets();
    const category = typeof req.query.category === "string" ? req.query.category : "";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const filters: SQL[] = [publicPromptFilter];
    if (category === "modeling") {
      filters.push(or(
        eq(promptStudioPromptsTable.category, category),
        inArray(promptStudioPromptsTable.id, [EVERY_CAMERA_ANGLE_PROMPT_ID, TWELVE_PANEL_EVERY_ANGLE_PROMPT_ID]),
      )!);
    } else if (category && categories.includes(category as never)) {
      filters.push(eq(promptStudioPromptsTable.category, category));
    }
    if (search) filters.push(or(ilike(promptStudioPromptsTable.title, `%${search}%`), ilike(promptStudioPromptsTable.promptText, `%${search}%`))!);
    const where = filters.length ? and(...filters) : undefined;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";
    const outerPromptId = sql.raw('"prompt_studio_prompts"."id"');
    const imageCount = sql<number>`(select count(*) from ${promptStudioImagesTable} where ${promptStudioImagesTable.promptId} = ${outerPromptId})`;
    const commentCount = sql<number>`(select count(*) from ${promptStudioCommentsTable} where ${promptStudioCommentsTable.promptId} = ${outerPromptId})`;
    const activity = sql<number>`(${imageCount} + ${commentCount})`;
    const averageRating = sql<number>`coalesce((select round(avg(${promptStudioRatingsTable.rating}), 1)::float from ${promptStudioRatingsTable} where ${promptStudioRatingsTable.promptId} = ${outerPromptId}), 0)`;
    const ratingCount = sql<number>`(select count(*) from ${promptStudioRatingsTable} where ${promptStudioRatingsTable.promptId} = ${outerPromptId})`;
    const featuredIds = sql`array[${sql.join(FEATURED_PROMPT_IDS.map(id => sql`${id}`), sql`, `)}]::text[]`;
    const featuredOrder = sql<number>`coalesce(array_position(${featuredIds}, ${promptStudioPromptsTable.id}), ${FEATURED_PROMPT_IDS.length + 1})`;
    const relevance = sql<number>`case
      when ${promptStudioPromptsTable.title} ilike ${search} then 5
      when ${promptStudioPromptsTable.title} ilike ${`${search}%`} then 4
      when ${promptStudioPromptsTable.title} ilike ${`%${search}%`} then 3
      when ${promptStudioPromptsTable.promptText} ilike ${`${search}%`} then 2
      when ${promptStudioPromptsTable.promptText} ilike ${`%${search}%`} then 1
      else 0
    end`;
    const coverId = sql<string | null>`(select ${promptStudioImagesTable.id} from ${promptStudioImagesTable} where ${promptStudioImagesTable.promptId} = ${outerPromptId} order by ${promptStudioImagesTable.createdAt} desc limit 1)`;
    const pinFeatured = sort === "trending" || (sort === "relevant" && !search);
    const [rows, [totalRow]] = await Promise.all([
      db.select({
        prompt: promptStudioPromptsTable,
        images: imageCount,
        comments: commentCount,
        averageRating,
        ratingCount,
        coverId,
      })
        .from(promptStudioPromptsTable).where(where)
        .orderBy(
          ...(pinFeatured ? [asc(featuredOrder)] : []),
          ...(sort === "top-rated"
            ? [asc(sql<number>`case
                when ${promptStudioPromptsTable.id} = ${TWELVE_PANEL_EVERY_ANGLE_PROMPT_ID} then 0
                when ${promptStudioPromptsTable.id} = ${EVERY_CAMERA_ANGLE_PROMPT_ID} then 1
                else 2 end`)]
            : []),
          sort === "top-rated" ? desc(averageRating)
            : sort === "popular" ? desc(imageCount)
              : sort === "relevant" && search ? desc(relevance)
                : sort === "newest" ? desc(promptStudioPromptsTable.createdAt)
                  : desc(activity),
          ...(sort === "top-rated" ? [desc(ratingCount)]
            : sort === "popular" || sort === "relevant" ? [desc(activity)]
              : []),
          desc(promptStudioPromptsTable.createdAt), desc(promptStudioPromptsTable.id))
        .limit(limit).offset(offset),
      db.select({ total: sql<number>`count(*)` }).from(promptStudioPromptsTable).where(where),
    ]);
    const owners = new Map(await Promise.all(
      [...new Set(rows.map(row => row.prompt.ownerUserId).filter((id): id is string => Boolean(id)))]
        .map(async id => [id, await author(id)] as const),
    ));
    res.json({
      prompts: rows.map(row => summary(row.prompt, Number(row.images), Number(row.comments),
        row.prompt.ownerUserId ? owners.get(row.prompt.ownerUserId) : undefined,
        row.coverId ? `/api/prompt-studio/images/${row.coverId}` : undefined,
        Number(row.averageRating), Number(row.ratingCount))),
      total: Number(totalRow?.total || 0),
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    req.log.error({
      errorName: error instanceof Error ? error.name : "unknown",
      errorCode: error && typeof error === "object" && "code" in error ? String(error.code) : undefined,
      causeCode: cause && typeof cause === "object" && "code" in cause ? String(cause.code) : undefined,
    }, "Unable to load Prompt Studio");
    res.status(500).json({ error: "Unable to load Prompt Studio." });
  }
});

router.get("/prompt-studio/prompts/:id", async (req, res) => {
  await initializePresets();
  const [p] = await db.select().from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, String(req.params.id))).limit(1);
  if (!p) { res.status(404).json({ error: "Prompt not found." }); return; }
  const [imgs, comments] = await Promise.all([
    db.select().from(promptStudioImagesTable).where(eq(promptStudioImagesTable.promptId, p.id)).orderBy(desc(promptStudioImagesTable.createdAt)),
    db.select().from(promptStudioCommentsTable).where(eq(promptStudioCommentsTable.promptId, p.id)).orderBy(desc(promptStudioCommentsTable.createdAt)),
  ]);
  const viewer = getAuthenticatedUserId(req);
  if (p.builtIn === "false" && viewer !== p.ownerUserId && !imgs.some(image => image.ownerUserId === p.ownerUserId)) {
    res.status(404).json({ error: "Prompt not found." }); return;
  }
  const outerPromptId = sql.raw('"prompt_studio_prompts"."id"');
  const averageRating = sql<number>`coalesce((select round(avg(${promptStudioRatingsTable.rating}), 1)::float from ${promptStudioRatingsTable} where ${promptStudioRatingsTable.promptId} = ${outerPromptId}), 0)`;
  const ratingCount = sql<number>`(select count(*) from ${promptStudioRatingsTable} where ${promptStudioRatingsTable.promptId} = ${outerPromptId})`;
  const viewerRating = viewer
    ? sql<number | null>`(select ${promptStudioRatingsTable.rating} from ${promptStudioRatingsTable} where ${promptStudioRatingsTable.promptId} = ${outerPromptId} and ${promptStudioRatingsTable.ownerUserId} = ${viewer} limit 1)`
    : sql<number | null>`null`;
  const [ratingStats] = await db.select({ averageRating, ratingCount, viewerRating })
    .from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, p.id)).limit(1);
  res.json({
    prompt: {
      ...summary(
        p,
        imgs.length,
        comments.length,
        await author(p.ownerUserId),
        imgs[0] ? await imageUrl(imgs[0].id) : undefined,
        Number(ratingStats?.averageRating || 0),
        Number(ratingStats?.ratingCount || 0),
      ),
      viewerOwns: Boolean(viewer && viewer === p.ownerUserId),
      viewerRating: ratingStats?.viewerRating == null ? null : Number(ratingStats.viewerRating),
      images: await Promise.all(imgs.map(async i => ({
        id: i.id,
        url: await imageUrl(i.id),
        author: await author(i.ownerUserId),
        createdAt: i.createdAt.toISOString(),
      }))),
      comments: await Promise.all(comments.map(async c => ({
        id: c.id,
        body: c.body,
        author: await author(c.ownerUserId),
        createdAt: c.createdAt.toISOString(),
        canDelete: viewer === c.ownerUserId,
      }))),
    },
  });
});

router.post("/prompt-studio/prompts/:id/unlock", requireAuth, async (req, res): Promise<void> => {
  const parsed = UnlockPromptStudioPromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Action must be copy or use.", code: "INVALID_PROMPT_STUDIO_ACTION" });
    return;
  }
  const promptId = String(req.params.id);
  const [prompt] = await db.select().from(promptStudioPromptsTable)
    .where(eq(promptStudioPromptsTable.id, promptId)).limit(1);
  if (!prompt) {
    res.status(404).json({ error: "Prompt not found.", code: "PROMPT_NOT_FOUND" });
    return;
  }

  const userId = getAuthenticatedUserId(req)!;
  if (prompt.builtIn === "false" && userId !== prompt.ownerUserId && !(await hasCreatorImage(prompt.id, prompt.ownerUserId))) {
    res.status(404).json({ error: "Prompt not found.", code: "PROMPT_NOT_FOUND" });
    return;
  }
  // Existing paid unlock records remain intact for history; no wallet, quota,
  // or ledger operation is needed to copy or use any gallery prompt now.
  res.json({ promptText: prompt.promptText, creditsUsed: 0 });
});

router.put("/prompt-studio/prompts/:id/rating", requireAuth, async (req, res) => {
  const parsed = RatePromptStudioPromptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Rating must be an integer from 1 to 5." });
    return;
  }
  const promptId = String(req.params.id);
  const [prompt] = await db.select({ id: promptStudioPromptsTable.id })
    .from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, promptId)).limit(1);
  if (!prompt) {
    res.status(404).json({ error: "Prompt not found." });
    return;
  }
  const [target] = await db.select({ builtIn: promptStudioPromptsTable.builtIn, ownerUserId: promptStudioPromptsTable.ownerUserId })
    .from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, promptId)).limit(1);
  if (target?.builtIn === "false" && getAuthenticatedUserId(req) !== target.ownerUserId && !(await hasCreatorImage(promptId, target.ownerUserId))) {
    res.status(404).json({ error: "Prompt not found." }); return;
  }
  const ownerUserId = getAuthenticatedUserId(req)!;
  const now = new Date();
  await db.insert(promptStudioRatingsTable).values({
    id: randomUUID(),
    promptId: prompt.id,
    ownerUserId,
    rating: parsed.data.rating,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: [promptStudioRatingsTable.promptId, promptStudioRatingsTable.ownerUserId],
    set: { rating: parsed.data.rating, updatedAt: now },
  });
  const [stats] = await db.select({
    averageRating: sql<number>`coalesce(round(avg(${promptStudioRatingsTable.rating}), 1)::float, 0)`,
    ratingCount: sql<number>`count(*)`,
  }).from(promptStudioRatingsTable).where(eq(promptStudioRatingsTable.promptId, prompt.id));
  res.json({
    rating: parsed.data.rating,
    averageRating: Number(stats?.averageRating || 0),
    ratingCount: Number(stats?.ratingCount || 0),
  });
});

router.post("/prompt-studio/prompts", requireAuth, async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const promptText = typeof req.body?.promptText === "string" ? req.body.promptText.trim() : "";
  const category = req.body?.category;
  if (title.length < 1 || title.length > 140 || promptText.length < 3 || promptText.length > 3000 || !categories.includes(category)) { res.status(400).json({ error: "Invalid prompt fields." }); return; }
  await ensureProfile(getAuthenticatedUserId(req)!, true);
  const [p] = await db.insert(promptStudioPromptsTable).values({ id: randomUUID(), ownerUserId: getAuthenticatedUserId(req)!, title, description: description.slice(0, 1000), promptText, category }).returning();
  res.status(201).json({ prompt: summary(p, 0, 0, await author(p.ownerUserId)) });
});

router.post("/prompt-studio/prompts/:id/images", requireAuth, async (req, res) => {
  const [p] = await db.select().from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, String(req.params.id))).limit(1);
  const body = Buffer.isBuffer(req.body) ? req.body : null;
  if (!p || !body || !["image/jpeg", "image/png", "image/webp"].includes(req.headers["content-type"]?.split(";")[0] || "") || body.length > 8 * 1024 * 1024) { res.status(400).json({ error: "A valid image (max 8MB) is required." }); return; }
  try {
    const ownerAddingImage = p.ownerUserId === getAuthenticatedUserId(req) && p.builtIn === "false";
    const { id, objectKey: key } = await savePromptStudioImage(body);
    let img;
    try {
      [img] = await db.insert(promptStudioImagesTable).values({ id, promptId: p.id, ownerUserId: getAuthenticatedUserId(req)!, objectKey: key }).returning();
    } catch (error) {
      await deletePromptStudioObject(key);
      throw error;
    }
    let communityPostError = false;
    if (ownerAddingImage) {
      try { await announceGalleryPrompt(p.id, img.ownerUserId!); }
      catch { communityPostError = true; }
    }
    res.status(201).json({
      image: { id: img.id, url: `/api/prompt-studio/images/${img.id}`, author: await author(img.ownerUserId), createdAt: img.createdAt.toISOString() },
      communityPostError,
    });
  } catch { res.status(413).json({ error: "Image could not be processed or stored." }); }
});

router.post("/prompt-studio/prompts/:id/community-post", requireAuth, async (req, res) => {
  const promptId = String(req.params.id), actor = getAuthenticatedUserId(req)!;
  try {
    const postId = await announceGalleryPrompt(promptId, actor);
    res.json({ postId, url: `/community/post/${encodeURIComponent(postId)}` });
  } catch (error) {
    const status = error instanceof Error && "status" in error && typeof error.status === "number" ? error.status : 503;
    res.status(status).json({ error: status === 503 ? "Community post is temporarily unavailable. Please retry." : (error as Error).message });
  }
});

router.get("/prompt-studio/images/:id", async (req, res) => {
  const [img] = await db.select().from(promptStudioImagesTable).where(eq(promptStudioImagesTable.id, String(req.params.id))).limit(1);
  if (!img) { res.status(404).end(); return; }
  const bucket = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucket) { res.status(503).end(); return; }
  try { const [data] = await objectStorageClient.bucket(bucket).file(img.objectKey).download(); res.type("image/webp").set("Cache-Control", "public, max-age=31536000, immutable").send(data); } catch { res.status(404).end(); }
});

router.post("/prompt-studio/prompts/:id/comments", requireAuth, async (req, res) => {
  const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
  if (body.length < 1 || body.length > 1000) { res.status(400).json({ error: "Comment must be 1–1,000 characters." }); return; }
  const [p] = await db.select().from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, String(req.params.id))).limit(1);
  if (!p) { res.status(404).json({ error: "Prompt not found." }); return; }
  if (p.builtIn === "false" && getAuthenticatedUserId(req) !== p.ownerUserId && !(await hasCreatorImage(p.id, p.ownerUserId))) {
    res.status(404).json({ error: "Prompt not found." }); return;
  }
  const [c] = await db.insert(promptStudioCommentsTable).values({ id: randomUUID(), promptId: p.id, ownerUserId: getAuthenticatedUserId(req)!, body }).returning();
  res.status(201).json({ comment: { id: c.id, body: c.body, author: await author(c.ownerUserId), createdAt: c.createdAt.toISOString() } });
});
router.delete("/prompt-studio/comments/:id", requireAuth, async (req, res) => {
  const [c] = await db.select().from(promptStudioCommentsTable).where(eq(promptStudioCommentsTable.id, String(req.params.id))).limit(1);
  if (!c) { res.status(404).json({ error: "Comment not found." }); return; }
  if (c.ownerUserId !== getAuthenticatedUserId(req)) { res.status(403).json({ error: "Not your comment." }); return; }
  await db.delete(promptStudioCommentsTable).where(eq(promptStudioCommentsTable.id, c.id)); res.status(204).end();
});
router.delete("/prompt-studio/prompts/:id", requireAuth, async (req, res) => {
  const [p] = await db.select().from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, String(req.params.id))).limit(1);
  if (!p) { res.status(404).json({ error: "Prompt not found." }); return; }
  if (p.builtIn === "true") { res.status(403).json({ error: "Built-in prompts cannot be deleted." }); return; }
  if (p.ownerUserId !== getAuthenticatedUserId(req)) { res.status(403).json({ error: "Not your prompt." }); return; }
  const announcement = await communityQuery("SELECT id FROM community_posts WHERE kind='prompt' AND source_url=$1", [promptCommunityUrl(p.id)]);
  if (announcement[0]) await removePost(announcement[0].id, true);
  const removedAnnouncement = await communityQuery("SELECT id FROM community_posts WHERE kind='prompt_removed' AND source_url=$1", [promptCommunityUrl(p.id)]);
  if (removedAnnouncement[0]) await removePost(removedAnnouncement[0].id, true);
  const images = await db.select().from(promptStudioImagesTable).where(eq(promptStudioImagesTable.promptId, p.id));
  for (const image of images) await deletePromptStudioObject(image.objectKey);
  await db.delete(promptStudioCommentsTable).where(eq(promptStudioCommentsTable.promptId, p.id));
  await db.delete(promptStudioImagesTable).where(eq(promptStudioImagesTable.promptId, p.id));
  await db.delete(promptStudioRatingsTable).where(eq(promptStudioRatingsTable.promptId, p.id));
  await db.delete(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.id, p.id));
  res.status(204).end();
});
router.delete("/prompt-studio/prompts/:promptId/images/:imageId", requireAuth, async (req, res) => {
  const [image] = await db.select().from(promptStudioImagesTable).where(eq(promptStudioImagesTable.id, String(req.params.imageId))).limit(1);
  if (!image || image.promptId !== String(req.params.promptId)) { res.status(404).json({ error: "Image not found." }); return; }
  if (image.ownerUserId !== getAuthenticatedUserId(req)) { res.status(403).json({ error: "Not your image." }); return; }
  await deletePromptStudioObject(image.objectKey);
  await db.delete(promptStudioImagesTable).where(eq(promptStudioImagesTable.id, image.id));
  const [p] = await db.select({ ownerUserId: promptStudioPromptsTable.ownerUserId }).from(promptStudioPromptsTable)
    .where(eq(promptStudioPromptsTable.id, image.promptId)).limit(1);
  const [remainingOwnerImage] = p?.ownerUserId ? await db.select({ id: promptStudioImagesTable.id }).from(promptStudioImagesTable)
    .where(and(eq(promptStudioImagesTable.promptId, image.promptId), eq(promptStudioImagesTable.ownerUserId, p.ownerUserId))).limit(1) : [];
  if (p?.ownerUserId && !remainingOwnerImage) {
    const announcement = await communityQuery("SELECT id FROM community_posts WHERE kind='prompt' AND source_url=$1", [promptCommunityUrl(image.promptId)]);
    if (announcement[0]) await removePost(announcement[0].id);
  }
  res.status(204).end();
});

router.get("/prompt-studio/profiles/:publicId", async (req, res) => {
  const requested = String(req.params.publicId);
  await initializePresets();
  if (requested === "fezi") {
    const prompts = await db.select().from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.builtIn, "true"));
    return res.json({ profile: { publicId: "fezi", displayName: "Persian Dark Horse", avatarId: "" }, prompts: await profileSummaries(prompts) });
  }
  if (requested === "library") {
    const prompts = await db.select().from(promptStudioPromptsTable).where(eq(promptStudioPromptsTable.builtIn, "library"));
    return res.json({ profile: libraryAuthor, prompts: await profileSummaries(prompts) });
  }
  const [promptOwners, imageOwners, commentOwners] = await Promise.all([
    db.select({ userId: promptStudioPromptsTable.ownerUserId }).from(promptStudioPromptsTable).where(sql`${promptStudioPromptsTable.ownerUserId} is not null`),
    db.select({ userId: promptStudioImagesTable.ownerUserId }).from(promptStudioImagesTable).where(sql`${promptStudioImagesTable.ownerUserId} is not null`),
    db.select({ userId: promptStudioCommentsTable.ownerUserId }).from(promptStudioCommentsTable),
  ]);
  const userId = [...promptOwners, ...imageOwners, ...commentOwners].map(x => x.userId!).find(x => publicId(x) === requested);
  if (!userId) return res.status(404).json({ error: "Profile not found." });
  const prompts = await db.select().from(promptStudioPromptsTable).where(
    getAuthenticatedUserId(req) === userId
      ? eq(promptStudioPromptsTable.ownerUserId, userId)
      : and(eq(promptStudioPromptsTable.ownerUserId, userId), publicPromptFilter),
  );
  return res.json({ profile: await author(userId), prompts: await profileSummaries(prompts) });
});
export default router;