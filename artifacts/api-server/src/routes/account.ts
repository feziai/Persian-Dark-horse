import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { randomInt, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { db, accountActivityTable, accountPaymentsTable, createdFilesTable, userMemoriesTable, userProfilesTable } from "@workspace/db";
import { getAuthenticatedUserId, requireAuth } from "../middlewares/auth";
import { ensureProfile as syncCommunityProfile } from "../lib/community";
import { queueAdminEmail } from "../lib/admin-email";
import { queueWelcome } from "../lib/user-email";
import { logger } from "../lib/logger";
import { initialProfileDefaults } from "../lib/profile-defaults";

const router: IRouter = Router();

const profileFields = [
  "displayName",
  "avatarId",
  "bio",
  "maritalStatus",
  "lifeStage",
  "occupation",
  "valuesText",
  "interestsText",
  "customInstructions",
  "interactionStyle",
  "language",
  "theme",
  "accent",
  "sidebarCollapsed",
  "notificationsEnabled",
  "voiceEnabled",
] as const;

type ProfileField = typeof profileFields[number];
type ProfileInput = Partial<Record<ProfileField, string | boolean | null>>;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function randomProfileUsername(attempt: number) {
  const suffix = attempt < 10 ? randomInt(10_000, 100_000) : randomInt(100_000, 10_000_000);
  return `PDHusernumber${suffix}`;
}

function randomOriginalHorseId() {
  return `original-horse-${String(randomInt(1, 11)).padStart(2, "0")}`;
}

function profileResponse(profile: typeof userProfilesTable.$inferSelect) {
  return {
    username: profile.username,
    displayName: profile.displayName,
    avatarId: profile.avatarId,
    bio: profile.bio,
    maritalStatus: profile.maritalStatus,
    lifeStage: profile.lifeStage,
    occupation: profile.occupation,
    valuesText: profile.valuesText,
    interestsText: profile.interestsText,
    customInstructions: profile.customInstructions,
    interactionStyle: profile.interactionStyle,
    personalization: {
      language: profile.language,
      theme: profile.theme,
      accent: profile.accent,
      sidebarCollapsed: profile.sidebarCollapsed === "true",
      notificationsEnabled: profile.notificationsEnabled !== "false",
      voiceEnabled: profile.voiceEnabled !== "false",
    },
  };
}

async function ensureProfile(userId: string) {
  const [existing] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
  if (existing) {
    // An empty legacy avatar can be an explicit account-photo preference.
    return existing.username ? existing : assignUsername(userId);
  }

  // Fetch the authenticated user's identity from Clerk, never from the browser request.
  const clerkUser = await clerkClient.users.getUser(userId);
  const defaults = initialProfileDefaults(clerkUser);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = attempt === 0 && defaults.username ? defaults.username : randomProfileUsername(attempt);
    const avatarId = defaults.avatarId ?? randomOriginalHorseId();
    let created: typeof userProfilesTable.$inferSelect | undefined;
    try {
      [created] = await db.insert(userProfilesTable)
        .values({ userId, username, avatarId, displayName: defaults.displayName })
        .onConflictDoNothing()
        .returning();
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    if (created) {
      // Persist the user ID before the welcome outbox verifies account age and email later.
      await queueWelcome(userId);
      try {
        const age = Date.now() - clerkUser.createdAt;
        if (age >= 0 && age < 30 * 60_000) {
          await queueAdminEmail(
            `signup:${userId}`,
            "ثبت‌نام جدید در Persian Dark Horse",
            `یک کاربر جدید ثبت‌نام کرد.\nشناسه کاربر: ${userId}\nزمان: ${new Date().toISOString()}`,
          );
        }
      } catch (error) {
        logger.warn({ userId, errorType: error instanceof Error ? error.name : "unknown" }, "Signup alert lookup unavailable");
      }
      await refreshCommunityAvatar(userId);
      return created;
    }
    const [concurrent] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
    if (concurrent) {
      return concurrent.username ? concurrent : assignUsername(userId);
    }
  }
  throw new Error("Could not assign a unique account username");
}

async function refreshCommunityAvatar(userId: string) {
  try {
    await syncCommunityProfile(userId);
  } catch (error) {
    logger.warn({ userId, errorType: error instanceof Error ? error.name : "unknown" }, "Community avatar refresh unavailable");
  }
}

async function assignUsername(userId: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const username = randomProfileUsername(attempt);
    try {
      const [updated] = await db.update(userProfilesTable)
        .set({ username, updatedAt: new Date() })
        .where(and(
          eq(userProfilesTable.userId, userId),
          or(eq(userProfilesTable.username, ""), isNull(userProfilesTable.username)),
        ))
        .returning();
      if (updated) return updated;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
    const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, userId)).limit(1);
    if (!profile) throw new Error("Could not load account profile");
    if (profile.username) return profile;
  }
  throw new Error("Could not assign a unique account username");
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && error.code === "23505") return true;
  return "cause" in error && isUniqueViolation(error.cause);
}

router.use((req, res, next) => {
  if (req.path === "/account" || req.path.startsWith("/account/")) {
    return requireAuth(req, res, next);
  }
  return next();
});

router.get("/account", async (req, res) => {
  const userId = getAuthenticatedUserId(req)!;
  const profile = await ensureProfile(userId);
  const [activity, files, purchases, memories] = await Promise.all([
    db.select().from(accountActivityTable).where(eq(accountActivityTable.userId, userId)).orderBy(desc(accountActivityTable.createdAt)).limit(30),
    db.select().from(createdFilesTable).where(eq(createdFilesTable.userId, userId)).orderBy(desc(createdFilesTable.createdAt)).limit(30),
    db.select().from(accountPaymentsTable).where(eq(accountPaymentsTable.userId, userId)).orderBy(desc(accountPaymentsTable.createdAt)).limit(30),
    db.select().from(userMemoriesTable).where(eq(userMemoriesTable.userId, userId)).orderBy(desc(userMemoriesTable.updatedAt)).limit(50),
  ]);
  res.json({ profile: profileResponse(profile), activity, files, purchases, memories });
});

router.patch("/account/profile", async (req, res) => {
  const userId = getAuthenticatedUserId(req)!;
  const body = (req.body ?? {}) as ProfileInput & { username?: unknown };
  const updates: Partial<typeof userProfilesTable.$inferInsert> = {};
  if ("username" in body) {
    if (typeof body.username !== "string" || body.username.length < 4 || body.username.length > 20 || !/^[A-Za-z0-9_]+$/.test(body.username)) {
      res.status(400).json({ error: "invalid_username", message: "Username must be 4–20 characters and contain only ASCII letters, digits, and underscores." });
      return;
    }
    updates.username = body.username;
  }
  const textLimits: Record<string, number> = {
    displayName: 120,
    avatarId: 80,
    bio: 1000,
    maritalStatus: 80,
    lifeStage: 120,
    occupation: 160,
    valuesText: 1200,
    interestsText: 1200,
    customInstructions: 4000,
    interactionStyle: 600,
    language: 2,
    theme: 20,
    accent: 40,
  };

  for (const field of profileFields) {
    if (!(field in body)) continue;
    const value = body[field];
    if (field === "sidebarCollapsed" || field === "notificationsEnabled" || field === "voiceEnabled") {
      if (typeof value === "boolean") updates[field] = value ? "true" : "false";
      continue;
    }
    updates[field] = cleanText(value, textLimits[field] ?? 200);
  }

  updates.updatedAt = new Date();
  await ensureProfile(userId);
  let profile: typeof userProfilesTable.$inferSelect | undefined;
  try {
    [profile] = await db.update(userProfilesTable).set(updates).where(eq(userProfilesTable.userId, userId)).returning();
  } catch (error) {
    if (!("username" in body) || !isUniqueViolation(error)) throw error;
    res.status(409).json({ error: "username_taken", message: "That username is already in use. Please choose another." });
    return;
  }
  await db.insert(accountActivityTable).values({
    id: randomUUID(),
    userId,
    type: "profile",
    label: "Profile updated",
    detail: "Account preferences were updated.",
  });
  if ("avatarId" in updates || "displayName" in updates) {
    try {
      await syncCommunityProfile(userId);
    } catch (error) {
      req.log.warn({ userId, errorType: error instanceof Error ? error.name : "unknown" }, "Community profile refresh unavailable");
    }
  }
  res.json({ profile: profileResponse(profile) });
});

router.post("/account/memories", async (req, res) => {
  const userId = getAuthenticatedUserId(req)!;
  const content = cleanText(req.body?.content, 2000);
  if (content.length < 3) {
    res.status(400).json({ error: "Memory text must be at least 3 characters." });
    return;
  }
  const [memory] = await db.insert(userMemoriesTable).values({
    id: randomUUID(),
    userId,
    content,
    source: typeof req.body?.source === "string" ? req.body.source.trim().slice(0, 40) || "chat" : "chat",
  }).returning();
  await db.insert(accountActivityTable).values({
    id: randomUUID(),
    userId,
    type: "memory",
    label: "Memory added",
    detail: "A user-provided memory was added.",
  });
  res.status(201).json({ memory });
});

router.patch("/account/memories/:id", async (req, res) => {
  const userId = getAuthenticatedUserId(req)!;
  const content = cleanText(req.body?.content, 2000);
  if (content.length < 3) {
    res.status(400).json({ error: "Memory text must be at least 3 characters." });
    return;
  }
  const [memory] = await db.update(userMemoriesTable)
    .set({ content, updatedAt: new Date() })
    .where(and(eq(userMemoriesTable.id, req.params.id), eq(userMemoriesTable.userId, userId)))
    .returning();
  if (!memory) {
    res.status(404).json({ error: "Memory not found." });
    return;
  }
  res.json({ memory });
});

router.delete("/account/memories/:id", async (req, res) => {
  const userId = getAuthenticatedUserId(req)!;
  const deleted = await db.delete(userMemoriesTable)
    .where(and(eq(userMemoriesTable.id, req.params.id), eq(userMemoriesTable.userId, userId)))
    .returning({ id: userMemoriesTable.id });
  if (!deleted.length) {
    res.status(404).json({ error: "Memory not found." });
    return;
  }
  res.status(204).end();
});

router.delete("/account/profile", async (req, res) => {
  const userId = getAuthenticatedUserId(req)!;
  await db.update(userProfilesTable).set({
    displayName: "",
    bio: "",
    maritalStatus: "",
    lifeStage: "",
    occupation: "",
    valuesText: "",
    interestsText: "",
    customInstructions: "",
    interactionStyle: "",
    updatedAt: new Date(),
  }).where(eq(userProfilesTable.userId, userId));
  await db.insert(accountActivityTable).values({
    id: randomUUID(),
    userId,
    type: "profile",
    label: "Personalization cleared",
    detail: "Optional profile details were removed.",
  });
  res.status(204).end();
});

export default router;