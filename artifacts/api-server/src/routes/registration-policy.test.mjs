import assert from "node:assert/strict";
import test from "node:test";
import { registrationUsernamePattern, safeRegistrationCapabilities } from "./registration-policy.ts";

const enabled = {
  sign_up: { mode: "public" },
  attributes: {
    username: { enabled: true },
    password: { enabled: true },
    email_address: { required: false },
  },
  social: {
    oauth_google: { enabled: true, authenticatable: true },
    oauth_apple: { enabled: false, authenticatable: true },
  },
};

test("username-only signup fails closed when policy cannot be proven", () => {
  assert.equal(safeRegistrationCapabilities().usernameOnly, false);
  assert.equal(safeRegistrationCapabilities({ ...enabled, attributes: { ...enabled.attributes, email_address: { required: true } } }).usernameOnly, false);
  assert.equal(safeRegistrationCapabilities({ ...enabled, attributes: { ...enabled.attributes, username: { enabled: false } } }).usernameOnly, false);
  assert.equal(safeRegistrationCapabilities({ ...enabled, sign_up: { mode: "restricted" } }).usernameOnly, false);
  assert.equal(safeRegistrationCapabilities({ ...enabled, attributes: { ...enabled.attributes, first_name: { required: true } } }).usernameOnly, true);
  assert.equal(safeRegistrationCapabilities({ ...enabled, attributes: { ...enabled.attributes, last_name: { required: true } } }).usernameOnly, false);
  assert.equal(safeRegistrationCapabilities(enabled).usernameOnly, true);
});

test("only configured authenticatable social providers are advertised", () => {
  assert.deepEqual(safeRegistrationCapabilities(enabled).socialProviders, ["oauth_google"]);
});

test("username shape allows case-insensitive names and rejects invalid input", () => {
  assert.equal(registrationUsernamePattern.test("Alex_123"), true);
  assert.equal(registrationUsernamePattern.test("A B"), false);
  assert.equal(registrationUsernamePattern.test("abc"), false);
  assert.equal(registrationUsernamePattern.test("x".repeat(21)), false);
});