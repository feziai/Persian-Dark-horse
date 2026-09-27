import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";

const output = new URL("../../.local/prompt-studio-free-tests.mjs", import.meta.url);
const stubs = new URL("../lib/api-credit-test-stubs.mjs", import.meta.url).pathname;
await build({
  entryPoints: [new URL("./prompt-studio.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["pino"],
  banner: { js: "import { createRequire as testRequire } from 'node:module'; const require = testRequire(import.meta.url);" },
  plugins: [{
    name: "prompt-studio-free-dependencies",
    setup(context) {
      context.onResolve({ filter: /api-credit-test-stubs\.mjs$/, namespace: "stub" }, () => ({ path: stubs, namespace: "file" }));
      context.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "stub" }));
      context.onResolve({ filter: /^drizzle-orm$/ }, () => ({ path: "drizzle", namespace: "stub" }));
      context.onResolve({ filter: /^\.\.\/lib\/community$/ }, () => ({ path: "community", namespace: "stub" }));
      context.onResolve({ filter: /^\.\.\/lib\/profile-defaults$/ }, () => ({ path: "profile", namespace: "stub" }));
      context.onResolve({ filter: /^\.\.\/lib\/promptStudioStorage$/ }, () => ({ path: "storage", namespace: "stub" }));
      context.onResolve({ filter: /^(?:@clerk\/express|\.\.\/middlewares\/auth)$/ }, () => ({ path: stubs }));
      context.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
        contents: path === "db"
          ? `export * from ${JSON.stringify(stubs)};
             export const promptStudioCommentsTable = { id: { __tableName: "prompt_studio_comments", __columnName: "id" } };
             export const promptStudioRatingsTable = { id: { __tableName: "prompt_studio_ratings", __columnName: "id" } };`
          : path === "drizzle"
            ? `export * from ${JSON.stringify(stubs)}; export const asc = (column) => ({ direction: "asc", column }); export const ilike = () => ({});`
            : path === "community"
              ? "export const announceCuratedGalleryPrompt = async () => {}; export const announceGalleryPrompt = async () => {}; export const ensureProfile = async () => {}; export const promptCommunityUrl = () => ''; export const query = async () => {}; export const removePost = async () => {};"
              : path === "profile"
                ? "export const accountPhotoUrl = () => null;"
                : `export { objectStorageClient } from ${JSON.stringify(stubs)};
                   export const deletePromptStudioObject = async () => {};
                   export const savePromptStudioImage = async () => ({});`,
        loader: "js",
      }));
    },
  }],
  logLevel: "silent",
});

const { default: router } = await import(output.href);
const database = globalThis.__feziApiCreditTestDb;

test("prepared prompt copy and use cost zero with no Credits or wallet", async (t) => {
  database.reset();
  database.seed("account_credits", { userId: "free-user", credits: 0 });
  database.seed("prompt_studio_prompts", { id: "prepared", builtIn: "library", promptText: "Real prepared prompt text" });
  database.seed("prompt_studio_prompts", { id: "another-prepared", builtIn: "true", promptText: "Another real prompt" });
  database.seed("prompt_studio_prompts", { id: "private", builtIn: "false", ownerUserId: "another-user", promptText: "Private draft" });
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/prompt-studio/prompts`;
  const unlock = async (id, action, user = "free-user") => {
    const response = await fetch(`${url}/${id}/unlock`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(user ? { "x-test-user-id": user } : {}) },
      body: JSON.stringify({ action }),
    });
    return { status: response.status, body: await response.json() };
  };
  for (const action of ["copy", "use", "copy"]) {
    assert.deepEqual(await unlock("prepared", action), {
      status: 200, body: { promptText: "Real prepared prompt text", creditsUsed: 0 },
    });
  }
  assert.deepEqual(await unlock("another-prepared", "use", "no-wallet"), {
    status: 200, body: { promptText: "Another real prompt", creditsUsed: 0 },
  });
  assert.equal(database.rows("account_credits").length, 1);
  assert.equal(database.rows("account_credits")[0].credits, 0);
  assert.equal((await unlock("prepared", "copy", "")).status, 401);
  assert.equal((await unlock("private", "use")).status, 404);
  assert.equal((await unlock("prepared", "invalid")).status, 400);
});