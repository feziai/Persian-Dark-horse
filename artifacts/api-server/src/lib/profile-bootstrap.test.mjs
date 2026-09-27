import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const output = new URL("../../.local/profile-bootstrap-tests.mjs", import.meta.url);
const profiles = new Map();
const routes = new Map();
let clerkUser;
let clerkLookups = 0;
globalThis.__profileTest = { profiles, routes, get clerkUser() { clerkLookups++; return clerkUser; } };

await build({
  entryPoints: [new URL("../routes/account.ts", import.meta.url).pathname],
  outfile: output.pathname,
  platform: "node",
  format: "esm",
  bundle: true,
  logLevel: "silent",
  plugins: [{
    name: "profile-dependencies",
    setup(context) {
      for (const [filter, path] of [
        [/^express$/, "express"], [/^drizzle-orm$/, "drizzle"],
        [/^@workspace\/db$/, "db"], [/^@clerk\/express$/, "clerk"],
        [/^(\.\.\/middlewares\/auth)$/, "auth"],
        [/^(\.\.\/lib\/community)$/, "community"],
        [/^(\.\.\/lib\/admin-email)$/, "admin"],
        [/^(\.\.\/lib\/user-email)$/, "welcome"],
        [/^(\.\.\/lib\/logger)$/, "logger"],
      ]) context.onResolve({ filter }, () => ({ path, namespace: "stub" }));
      context.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
        loader: "js",
        contents: ({
          express: `export function Router() { return {
            use() {}, get(path, fn) { globalThis.__profileTest.routes.set(path, fn); },
            patch() {}, post() {}, delete() {},
          }; }`,
          drizzle: `export const eq = (field, value) => ({ field, value });
            export const and = (...conditions) => conditions; export const or = and;
            export const isNull = (field) => ({ field, value: null }); export const desc = x => x;`,
          db: `const t = { userId: "userId", username: "username", avatarId: "avatarId",
            createdAt: "createdAt", updatedAt: "updatedAt" };
            export const userProfilesTable = t;
            export const accountActivityTable = t; export const accountPaymentsTable = t;
            export const createdFilesTable = t; export const userMemoriesTable = t;
            export const db = {
              select() { return { from(table) {
                return { where(condition) { return { limit() {
                  return Promise.resolve(table === t && condition?.field === "userId"
                    ? [globalThis.__profileTest.profiles.get(condition.value)].filter(Boolean) : []);
                }, orderBy() { return { limit() { return Promise.resolve([]); } }; } }; } };
              } }; },
              insert() { return { values(value) { return { onConflictDoNothing() {
                return { returning() {
                  if (globalThis.__profileTest.profiles.has(value.userId)) return Promise.resolve([]);
                  if ([...globalThis.__profileTest.profiles.values()].some(p =>
                    p.username?.toLowerCase() === value.username?.toLowerCase())) return Promise.resolve([]);
                  const row = { ...value, bio: "", maritalStatus: "", lifeStage: "", occupation: "",
                    valuesText: "", interestsText: "", customInstructions: "", interactionStyle: "",
                    language: "en", theme: "system", accent: "", sidebarCollapsed: "false",
                    notificationsEnabled: "true", voiceEnabled: "true" };
                  globalThis.__profileTest.profiles.set(value.userId, row);
                  return Promise.resolve([row]);
                } };
              } }; } }; },
            };`,
          clerk: `export const clerkClient = { users: { async getUser() { return globalThis.__profileTest.clerkUser; } } };`,
          auth: `export const getAuthenticatedUserId = req => req.userId; export const requireAuth = (_req,_res,next) => next();`,
          community: `export async function ensureProfile() {}`,
          admin: `export async function queueAdminEmail() {}`,
          welcome: `export async function queueWelcome() {}`,
          logger: `export const logger = { warn() {} };`,
        })[path],
      }));
    },
  }],
});
await import(output.href);

async function load(id) {
  let result;
  await routes.get("/account")({ userId: id }, { json(value) { result = value; } });
  return result.profile;
}

test("first load adopts authenticated social identity; a later load never replaces chosen fields", async () => {
  clerkUser = { username: "SocialRider", firstName: "Sam", lastName: "Rider", hasImage: true,
    imageUrl: "https://img.clerk.com/photo", createdAt: Date.now() - 60_000 };
  const profile = await load("new");
  assert.equal(profile.username, "SocialRider");
  assert.equal(profile.displayName, "Sam Rider");
  assert.equal(profile.avatarId, "account-photo");
  const before = clerkLookups;
  profiles.set("new", { ...profiles.get("new"), username: "MyOwnName", displayName: "Custom name", avatarId: "lion" });
  assert.deepEqual(
    (({ username, displayName, avatarId }) => ({ username, displayName, avatarId }))(await load("new")),
    { username: "MyOwnName", displayName: "Custom name", avatarId: "lion" },
  );
  assert.equal(clerkLookups, before);
  profiles.set("legacy", { ...profiles.get("new"), userId: "legacy", avatarId: "" });
  assert.equal((await load("legacy")).avatarId, "");
});

test("case-insensitive local username collision falls back to a generated unique username", async () => {
  profiles.set("taken", { userId: "taken", username: "SocialRider", avatarId: "lion", displayName: "Chosen" });
  clerkUser = { username: "socialrider", hasImage: false, createdAt: Date.now() - 60_000 };
  const profile = await load("second");
  assert.match(profile.username, /^PDHusernumber\d+$/);
  assert.match(profile.avatarId, /^original-horse-(0[1-9]|10)$/);
});