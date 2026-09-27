import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";

const output = new URL("../../.local/profile-defaults-tests.mjs", import.meta.url);
await build({
  entryPoints: [new URL("./profile-defaults.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const { accountPhotoUrl, initialProfileDefaults } = await import(output.href);

test("verified social photo and name become defaults, without persisting an external URL", () => {
  const user = {
    hasImage: false,
    imageUrl: "https://img.clerk.com/placeholder",
    username: "Real_Rider",
    externalAccounts: [{ firstName: "Sam", lastName: "Rider", imageUrl: "https://lh3.googleusercontent.com/photo" }],
  };
  assert.equal(accountPhotoUrl(user), "https://lh3.googleusercontent.com/photo");
  assert.deepEqual(initialProfileDefaults(user), {
    displayName: "Sam Rider",
    avatarId: "account-photo",
    username: "Real_Rider",
  });
});

test("Clerk user-provided photo takes precedence; no photo means original horse is assigned by caller", () => {
  assert.equal(accountPhotoUrl({
    hasImage: true, imageUrl: "https://img.clerk.com/real",
    externalAccounts: [{ imageUrl: "https://example.com/other" }],
  }), "https://img.clerk.com/real");
  assert.deepEqual(initialProfileDefaults({ hasImage: false, imageUrl: "https://img.clerk.com/placeholder" }), {
    displayName: "", avatarId: undefined, username: undefined,
  });
});

test("invalid Clerk usernames are not adopted; names are bounded", () => {
  const defaults = initialProfileDefaults({ firstName: "A".repeat(130), username: "bad name!" });
  assert.equal(defaults.username, undefined);
  assert.equal(defaults.displayName.length, 120);
  assert.equal(initialProfileDefaults({ username: "SocialRider", firstName: "Maria", lastName: "Horse" }).displayName, "Maria Horse");
});