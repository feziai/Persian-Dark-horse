import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";

const output = new URL("../../.local/plan-access-tests.mjs", import.meta.url);
const schemaOutput = new URL("../../.local/plan-access-schema-tests.mjs", import.meta.url);
const testStubs = new URL("./api-credit-test-stubs.mjs", import.meta.url).pathname;

await build({
  entryPoints: [new URL("../routes/fezi-data.ts", import.meta.url).pathname],
  outfile: output.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  external: ["pino"],
  banner: { js: "import { createRequire as testRequire } from 'node:module'; const require = testRequire(import.meta.url);" },
  plugins: [{
    name: "plan-access-test-dependencies",
    setup(buildContext) {
      buildContext.onResolve({
        filter: /^(?:@workspace\/db|drizzle-orm|@clerk\/express|\.\.\/middlewares\/auth|\.\.\/lib\/promptStudioStorage)$/,
      }, () => ({ path: testStubs }));
      buildContext.onResolve({ filter: /^\.\.\/lib\/(?:user-email|admin-email)$/ }, () => ({ path: "email", namespace: "mock" }));
      buildContext.onLoad({ filter: /.*/, namespace: "mock" }, () => ({
        contents: "export const queueAdminEmail = async () => {}; export const queuePurchaseEmail = async () => {}; export const queueTicketStatusEmail = async () => {};",
        loader: "js",
      }));
    },
  }],
  logLevel: "silent",
});

await build({
  entryPoints: [new URL("../../../../lib/api-zod/src/index.ts", import.meta.url).pathname],
  outfile: schemaOutput.pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});

const { default: feziRouter } = await import(output.href);
const { ListPlansResponse } = await import(schemaOutput.href);

function request(server, method, path) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname: "127.0.0.1", port: address.port, method, path }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let body;
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on("error", reject);
    req.end();
  });
}

test("paid and lifetime plans expose complete, contract-valid access and credit policy", async (t) => {
  const app = express();
  app.use("/api", feziRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const response = await request(server, "GET", "/api/plans");
  assert.equal(response.status, 200);
  const plans = ListPlansResponse.parse(response.body);
  const paidAndLifetime = plans.filter((plan) => plan.price > 0 && (plan.cadence === "month" || plan.cadence === "lifetime"));
  assert.ok(paidAndLifetime.length > 0, "the catalog includes paid monthly or lifetime plans");
  assert.ok(paidAndLifetime.some((plan) => plan.cadence === "lifetime"), "the catalog includes a lifetime plan");

  for (const plan of paidAndLifetime) {
    assert.ok(plan.agentIds.length > 0, `${plan.id} lists built-in Agents`);
    assert.ok(plan.appIds.length > 0, `${plan.id} lists workspace tools`);
    assert.ok(plan.modelIds.length > 0, `${plan.id} lists exact model routes`);
    assert.ok(plan.customAgentLimit > 0, `${plan.id} has a custom-Agent limit`);
    assert.ok(plan.credits > 0, `${plan.id} includes Credits`);
    assert.ok(plan.featureDetails.length > 0, `${plan.id} includes server-derived details`);
    assert.ok(plan.featureDetails.includes(`${plan.credits.toLocaleString()} included credits`), `${plan.id} summary matches its credit grant`);
    assert.ok(plan.featureDetails.includes(`${plan.customAgentLimit} custom Agent slots`), `${plan.id} summary matches its custom-Agent limit`);
    assert.ok(plan.featureDetails.includes(`${plan.appIds.length} workspace apps`), `${plan.id} summary matches its app IDs`);
    assert.ok(plan.featureDetails.includes(`${plan.agentIds.length} built-in Agents`), `${plan.id} summary matches its Agent IDs`);
    assert.ok(
      plan.featureDetails.includes(plan.cadence === "lifetime" ? "Lifetime access" : "30-day access from payment approval"),
      `${plan.id} summary matches its access duration`,
    );
    assert.deepEqual(plan.creditPolicy, {
      grantTrigger: "payment_approval",
      activePaidPlanBalance: "add",
      noActivePaidPlanBalance: "replace",
      automaticRefresh: false,
    }, `${plan.id} exposes the server's actual credit policy`);
  }
});

test("the plan contract rejects missing or unknown Agent, app, and model identifiers", () => {
  const validPlan = {
    id: "test",
    name: "Test",
    nameFa: "Test",
    price: 1,
    cadence: "month",
    credits: 100,
    description: "Test plan",
    featured: false,
    appIds: ["research"],
    modelIds: ["openrouter/free"],
    agentIds: ["monicah"],
    customAgentLimit: 1,
    featureDetails: ["Test feature"],
    creditPolicy: {
      grantTrigger: "payment_approval",
      activePaidPlanBalance: "add",
      noActivePaidPlanBalance: "replace",
      automaticRefresh: false,
    },
  };

  for (const field of ["agentIds", "appIds", "modelIds"]) {
    const missingIdentifier = { ...validPlan, [field]: [] };
    const unknownIdentifier = { ...validPlan, [field]: ["unknown-id"] };
    assert.equal(ListPlansResponse.safeParse([missingIdentifier]).success, false, `${field} cannot be empty`);
    assert.equal(ListPlansResponse.safeParse([unknownIdentifier]).success, false, `${field} rejects unknown identifiers`);
  }

  const missingPolicy = { ...validPlan };
  delete missingPolicy.creditPolicy;
  assert.equal(ListPlansResponse.safeParse([missingPolicy]).success, false, "credit policy is required");
});