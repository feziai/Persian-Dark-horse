import assert from "node:assert/strict";
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";

const adminUsername = "api-credit-test-admin";
const adminPassword = "api-credit-test-password";
const userId = "api-credit-boundary-user";
process.env.ADMIN_USERNAME = adminUsername;
process.env.ADMIN_PASSWORD = adminPassword;
process.env.OPENROUTER_API_KEY = "test-only";

const output = new URL("../../.local/api-credit-boundary-tests.mjs", import.meta.url);
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
    name: "api-credit-boundary-test-dependencies",
    setup(buildContext) {
      buildContext.onResolve({
        filter: /^(?:@workspace\/db|drizzle-orm|@clerk\/express|\.\.\/middlewares\/auth|\.\.\/lib\/promptStudioStorage)$/,
      }, () => ({ path: testStubs }));
      buildContext.onResolve({ filter: /^\.\.\/lib\/user-email$/ }, () => ({ path: "user-email-test", namespace: "test" }));
      buildContext.onResolve({ filter: /^\.\.\/lib\/admin-email$/ }, () => ({ path: "admin-email-test", namespace: "test" }));
      buildContext.onLoad({ filter: /.*/, namespace: "test" }, ({ path }) => ({
        contents: path === "admin-email-test" ? "export const queueAdminEmail = async () => {};" : `export const queuePurchaseEmail = async (id, userId, status) => {
          (globalThis.__purchaseEmails ??= []).push({ id, userId, status });
        };
        export const queueTicketStatusEmail = async () => {};`,
        loader: "js",
      }));
    },
  }],
  logLevel: "silent",
});

const { default: feziRouter } = await import(output.href);
const database = globalThis.__feziApiCreditTestDb;
const requestLogs = [];

function request(server, method, path, {
  body,
  cookie,
  authorization,
  accept,
  origin,
  host,
  accessControlRequestMethod,
  accessControlRequestHeaders,
} = {}) {
  const address = server.address();
  const payload = body === undefined ? undefined : JSON.stringify(body);
  const headers = {
    "x-test-user-id": userId,
    ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
    ...(accept ? { accept } : {}),
    ...(cookie ? { cookie } : {}),
    ...(authorization ? { authorization } : {}),
    ...(origin ? { origin } : {}),
    ...(host ? { host } : {}),
    ...(accessControlRequestMethod ? { "access-control-request-method": accessControlRequestMethod } : {}),
    ...(accessControlRequestHeaders ? { "access-control-request-headers": accessControlRequestHeaders } : {}),
  };

  return new Promise((resolve, reject) => {
    const req = httpRequest({
      hostname: "127.0.0.1",
      port: address.port,
      method,
      path,
      headers,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let responseBody = null;
        if (text) {
          try {
            responseBody = JSON.parse(text);
          } catch {
            responseBody = text;
          }
        }
        resolve({ status: res.statusCode, headers: res.headers, body: responseBody });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function makeApi(app, router = feziRouter) {
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = { info() {}, warn(...args) { requestLogs.push(args); }, error(...args) { requestLogs.push(args); }, debug() {} };
    next();
  });
  app.use("/api", router);
  return app;
}

test("API Credit purchases and usage stay separate from subscriptions and workspace Credits", async (t) => {
  database.reset();
  database.seed("custom_agents", {
    id: "custom_credit_boundary",
    ownerId: userId,
    name: "Credit Boundary Agent",
    slug: "credit-boundary-agent",
    description: "A test Agent for API Credit boundary checks.",
    category: "General",
    tags: ["test", "credits"],
    systemInstructions: "Give a useful answer.",
    developerInstructions: "",
    knowledgeText: "",
    model: "openrouter/free",
    connectedModels: [],
    capabilities: ["chat"],
    tools: [],
    apiEnabled: true,
    status: "active",
    usageCount: 0,
  });

  const app = makeApi(express());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));

  const getStatus = () => request(server, "GET", "/api/payments/status");
  const submitApiPurchase = (apiScope, txId, agentId) => request(server, "POST", "/api/payments/txid", {
    body: {
      apiCreditPackId: apiScope === "site" ? "api-credits-starter-10-fezi-30" : "api-credits-starter-10",
      apiScope,
      ...(agentId ? { agentId } : {}),
      currency: "bnb",
      txId,
    },
  });
  const statusBefore = await getStatus();
  assert.equal(statusBefore.status, 200);
  const workspaceCreditsBefore = statusBefore.body.credits;

  const login = await request(server, "POST", "/api/admin/login", {
    body: { username: adminUsername, password: adminPassword },
  });
  assert.equal(login.status, 200, "the test administrator can authenticate");
  const adminCookie = Array.isArray(login.headers["set-cookie"])
    ? login.headers["set-cookie"][0].split(";")[0]
    : login.headers["set-cookie"]?.split(";")[0];
  assert.ok(adminCookie, "the administrator session cookie is returned");

  const siteSubmission = await submitApiPurchase("site", "api-site-boundary-tx");
  assert.equal(siteSubmission.status, 202);
  assert.equal(siteSubmission.body.status, "pending");
  assert.equal(globalThis.__purchaseEmails.filter((event) => event.id === siteSubmission.body.payment.id && event.status === "pending").length, 1);
  const siteApproval = await request(server, "POST", `/api/admin/payments/${siteSubmission.body.payment.id}/approve`, { cookie: adminCookie });
  assert.equal(siteApproval.status, 200);
  assert.equal(globalThis.__purchaseEmails.filter((event) => event.id === siteSubmission.body.payment.id && event.status === "approved").length, 1);
  assert.equal(siteApproval.body.status, "approved");
  assert.equal(siteApproval.body.apiScope, "site");
  assert.equal(siteApproval.body.apiCredits, 500);
  assert.equal(database.rows("account_subscriptions").length, 0, "site API approval does not create a subscription row");
  const siteKey = await request(server, "POST", "/api/agent-keys", { body: { agentId: "site" } });
  assert.equal(siteKey.status, 201);
  const siteAuth = `Bearer ${siteKey.body.key}`;
  assert.equal((await request(server, "POST", "/api/agent/v1/chat", {
    body: { message: "Cannot spend Site Credits as Agent Credits." }, authorization: siteAuth,
  })).status, 401);
  assert.equal((await request(server, "POST", "/api/custom-agents/custom_credit_boundary/chat", {
    body: { message: "Cannot spend Site Credits as custom Agent Credits." }, authorization: siteAuth,
  })).status, 401);

  const rejectedSubmission = await submitApiPurchase("site", "api-rejected-boundary-tx");
  assert.equal(rejectedSubmission.status, 202);
  const rejected = await request(server, "POST", `/api/admin/payments/${rejectedSubmission.body.payment.id}/reject`, { cookie: adminCookie });
  assert.equal(rejected.status, 200);
  assert.deepEqual(
    globalThis.__purchaseEmails.filter((event) => event.id === rejectedSubmission.body.payment.id).map((event) => event.status),
    ["pending", "rejected"],
  );

  let status = await getStatus();
  assert.equal(status.body.hasPaidAccess, false);
  assert.equal(status.body.subscription, null);
  assert.equal(status.body.credits, workspaceCreditsBefore);
  assert.equal(status.body.apiCredits, 500);

  const blockedBuiltInKey = await request(server, "POST", "/api/agent-keys", { body: { agentId: "arta" } });
  assert.equal(blockedBuiltInKey.status, 402, "site-wide API Credits cannot issue a per-Agent key");

  const agentSubmission = await submitApiPurchase("agent", "api-agent-boundary-tx", "arta");
  assert.equal(agentSubmission.status, 202);
  const agentApproval = await request(server, "POST", `/api/admin/payments/${agentSubmission.body.payment.id}/approve`, { cookie: adminCookie });
  assert.equal(agentApproval.status, 200);
  assert.equal(globalThis.__purchaseEmails.filter((event) => event.id === agentSubmission.body.payment.id && event.status === "approved").length, 1);
  assert.equal(agentApproval.body.apiScope, "agent");
  assert.equal(agentApproval.body.agentId, "arta");
  status = await getStatus();
  assert.deepEqual(status.body.apiCreditsByAgent, { arta: 500 }, "the Agent pack credits only Arta");
  assert.equal(status.body.apiCredits, 500, "an Agent pack does not add site-wide API Credits");
  assert.equal(status.body.credits, workspaceCreditsBefore);

  const builtInKey = await request(server, "POST", "/api/agent-keys", { body: { agentId: "arta" } });
  assert.equal(builtInKey.status, 201);
  const agentAuthorization = `Bearer ${builtInKey.body.key}`;

  const originalFetch = globalThis.fetch;
  let providerFails = false;
  let providerCalls = 0;
  globalThis.fetch = async (url) => {
    providerCalls += 1;
    if (providerFails) return new Response("provider unavailable", { status: 503 });
    const message = "The test provider returned a complete answer while preserving the Agent's role and requested context.";
    if (String(url).includes("generativelanguage.googleapis.com")) {
      return Response.json({ candidates: [{ content: { parts: [{ text: message }] } }] });
    }
    if (String(url).includes("ollama.com")) {
      return Response.json({ message: { content: message } });
    }
    return Response.json({ choices: [{ message: { content: message } }] });
  };

  try {
    const apiReply = await request(server, "POST", "/api/agent/v1/chat", {
      body: { message: "Give a useful test answer." },
      authorization: agentAuthorization,
    });
    assert.equal(apiReply.status, 200, JSON.stringify({ body: apiReply.body, logs: requestLogs }));
    assert.equal(typeof apiReply.body.messageId, "string", "successful API replies match the response contract");
    assert.ok(apiReply.body.creditsUsed > 0);
    status = await getStatus();
    const afterApiReply = status.body.apiCreditsByAgent.arta;
    assert.equal(afterApiReply, 500 - apiReply.body.creditsUsed);
    assert.equal(status.body.apiCredits, 500, "per-Agent API use does not spend site-wide API Credits");
    assert.equal(status.body.credits, workspaceCreditsBefore, "API use does not spend workspace Credits");

    const mcpReply = await request(server, "POST", "/api/mcp", {
      body: {
        jsonrpc: "2.0",
        id: "mcp-success",
        method: "tools/call",
        params: { name: "fezi_agent_chat", arguments: { message: "Give a useful MCP test answer." } },
      },
      accept: "application/json, text/event-stream",
      authorization: agentAuthorization,
    });
    assert.equal(mcpReply.status, 401, "Agent-scoped keys cannot access private Site API MCP tools");
    status = await getStatus();
    assert.equal(status.body.apiCreditsByAgent.arta, afterApiReply, "a key rejected by Site MCP spends no Agent API Credits");
    assert.equal(status.body.apiCredits, 500);
    assert.equal(status.body.credits, workspaceCreditsBefore);

    const customKeyBlocked = await request(server, "POST", "/api/custom-agents/custom_credit_boundary/api-keys", {
      body: { name: "Boundary test key" },
    });
    assert.equal(customKeyBlocked.status, 402, "site-wide API Credits cannot issue a Custom Agent key");

    const artaCreditsBeforeCustomPurchase = status.body.apiCreditsByAgent.arta;
    const customSubmission = await submitApiPurchase("agent", "api-custom-boundary-tx", "custom_credit_boundary");
    assert.equal(customSubmission.status, 202);
    const customApproval = await request(server, "POST", `/api/admin/payments/${customSubmission.body.payment.id}/approve`, { cookie: adminCookie });
    assert.equal(customApproval.status, 200);
    assert.equal(globalThis.__purchaseEmails.filter((event) => event.id === customSubmission.body.payment.id && event.status === "approved").length, 1);
    assert.equal(customApproval.body.apiScope, "agent");
    status = await getStatus();
    assert.deepEqual(status.body.apiCreditsByAgent, {
      arta: artaCreditsBeforeCustomPurchase,
      custom_credit_boundary: 500,
    }, "the Custom Agent pack changes only that Agent's balance");
    assert.equal(status.body.apiCredits, 500);
    assert.equal(status.body.credits, workspaceCreditsBefore);

    const customKey = await request(server, "POST", "/api/custom-agents/custom_credit_boundary/api-keys", {
      body: { name: "Boundary test key" },
    });
    assert.equal(customKey.status, 201);
    const customReply = await request(server, "POST", "/api/custom-agents/custom_credit_boundary/chat", {
      body: { message: "Give a useful Custom Agent test answer." },
      authorization: `Bearer ${customKey.body.apiKey}`,
    });
    assert.equal(customReply.status, 200);
    assert.ok(customReply.body.creditsUsed > 0);
    status = await getStatus();
    const afterCustomReply = status.body.apiCreditsByAgent.custom_credit_boundary;
    assert.equal(afterCustomReply, 500 - customReply.body.creditsUsed);
    assert.equal(status.body.apiCredits, 500);
    assert.equal(status.body.credits, workspaceCreditsBefore);
    assert.equal(database.rows("account_subscriptions").length, 0);

    const agentBalanceBeforeFailures = status.body.apiCreditsByAgent.arta;
    const customBalanceBeforeFailure = status.body.apiCreditsByAgent.custom_credit_boundary;
    providerFails = true;

    const failedApi = await request(server, "POST", "/api/agent/v1/chat", {
      body: { message: "This request should fail without a charge." },
      authorization: agentAuthorization,
    });
    assert.equal(failedApi.status, 503);

    const failedMcp = await request(server, "POST", "/api/mcp", {
      body: {
        jsonrpc: "2.0",
        id: "mcp-failure",
        method: "tools/call",
        params: { name: "fezi_agent_chat", arguments: { message: "This MCP request should fail without a charge." } },
      },
      accept: "application/json, text/event-stream",
      authorization: agentAuthorization,
    });
    assert.equal(failedMcp.status, 401, "Agent-scoped keys cannot invoke Site MCP generation");
    status = await getStatus();
    assert.equal(status.body.apiCreditsByAgent.arta, agentBalanceBeforeFailures);

    const failedCustom = await request(server, "POST", "/api/custom-agents/custom_credit_boundary/chat", {
      body: { message: "This Custom Agent request should fail without a charge." },
      authorization: `Bearer ${customKey.body.apiKey}`,
    });
    assert.equal(failedCustom.status, 503);

    status = await getStatus();
    assert.equal(status.body.apiCreditsByAgent.arta, agentBalanceBeforeFailures);
    assert.equal(status.body.apiCreditsByAgent.custom_credit_boundary, customBalanceBeforeFailure);
    assert.equal(status.body.apiCredits, 500);
    assert.equal(status.body.credits, workspaceCreditsBefore);
    assert.equal(status.body.hasPaidAccess, false);
    assert.equal(status.body.subscription, null);
    assert.equal(database.rows("site_api_credits")[0].credits, 500,
      "Agent and custom consumption did not debit (or reload) the separate persisted Site wallet");
    const reloadedCatalog = await request(server, "GET", "/api/access/catalog");
    assert.equal(reloadedCatalog.body.api.site.credits, 500);
    const { default: restartedRouter } = await import(`${output.href}?site-wallet-reload=${Date.now()}`);
    const restartedServer = makeApi(express(), restartedRouter).listen(0, "127.0.0.1");
    await once(restartedServer, "listening");
    try {
      assert.equal((await request(restartedServer, "GET", "/api/payments/status")).body.apiCredits, 500,
        "Site balance survives a fresh router module (new in-memory workspace cache)");
      assert.equal((await request(restartedServer, "GET", "/api/access/catalog")).body.api.site.credits, 500);
      assert.equal((await request(restartedServer, "POST", "/api/site/v1/chat", {
        body: { message: "Test scoped key persistence", agentId: "custom_not_owned" }, authorization: siteAuth,
      })).status, 403, "the hashed Site key remains valid across reload");
    } finally {
      await new Promise((resolve) => restartedServer.close(resolve));
    }
    assert.ok(providerCalls > 0, "provider responses were stubbed through the HTTP routes");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google verification gates both key issuance routes and Site keys remain scoped to the Site API", async (t) => {
  database.reset();
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/models")) return new Response(JSON.stringify({
      data: [
        { id: "test/connected-chat", name: "Connected chat", architecture: { output_modalities: ["text"] } },
        { id: "test/image-only", name: "Image only", architecture: { output_modalities: ["image"] } },
      ],
    }), { status: 200 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "A real routed test reply" } }] }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = previousFetch; delete globalThis.__testGoogleVerified; delete globalThis.__testGoogleLookupError; });
  database.seed("custom_agents", { id: "custom_google_test", ownerId: userId, apiEnabled: true, status: "active" });
  const { default: isolatedRouter } = await import(`${output.href}?google-scope-fixture=${Date.now()}`);
  const server = makeApi(express(), isolatedRouter).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));

  globalThis.__testGoogleVerified = false;
  assert.deepEqual((await request(server, "GET", "/api/api-access/status")).body, { googleVerified: false });
  for (const route of ["/api/agent-keys", "/api/custom-agents/custom_google_test/api-keys"]) {
    const denied = await request(server, "POST", route, { body: { agentId: "site" } });
    assert.equal(denied.status, 403);
    assert.equal(denied.body.code, "GOOGLE_VERIFICATION_REQUIRED");
  }
  assert.equal(database.rows("custom_agent_api_keys").length, 0);

  globalThis.__testGoogleLookupError = true;
  assert.equal((await request(server, "GET", "/api/api-access/status")).status, 503);
  for (const route of ["/api/agent-keys", "/api/custom-agents/custom_google_test/api-keys"]) {
    assert.equal((await request(server, "POST", route, { body: { agentId: "site" } })).status, 503);
  }
  globalThis.__testGoogleLookupError = false;
  globalThis.__testGoogleVerified = true;
  assert.deepEqual((await request(server, "GET", "/api/api-access/status")).body, { googleVerified: true });
  const catalog = await request(server, "GET", "/api/access/catalog");
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.api.site.endpoint, "/api/site/v1/chat");
  assert.equal(catalog.body.api.site.packs[0].price, catalog.body.api.agents.find((agent) => agent.agentId === "fezi").packs[0].price);
  const quote = await request(server, "POST", "/api/payments/quote", {
    body: { apiScope: "site", apiCreditPackId: catalog.body.api.site.packs[0].id, currency: "bnb" },
  });
  assert.equal(quote.status, 200);
  assert.equal(quote.body.amount, "13.00");
  assert.equal((await request(server, "POST", "/api/payments/quote", {
    body: { apiScope: "site", apiCreditPackId: "api-credits-starter-10", currency: "bnb" },
  })).status, 400, "old site offers cannot be purchased again");
  const issued = await request(server, "POST", "/api/agent-keys", { body: { agentId: "site" } });
  assert.equal(issued.status, 201);
  assert.equal(issued.body.endpoint, "/api/site/v1/chat");
  assert.equal(database.rows("custom_agent_api_keys")[0].agentId, "site");
  assert.notEqual(database.rows("custom_agent_api_keys")[0].keyHash, issued.body.key);
  assert.equal((await request(server, "POST", "/api/agent/v1/chat", {
    authorization: `Bearer ${issued.body.key}`, body: { message: "Scope isolation" },
  })).status, 401);
  const auth = `Bearer ${issued.body.key}`;
  const models = await request(server, "GET", "/api/site/v1/models", { authorization: auth });
  assert.equal(models.status, 200);
  assert.ok(models.body.models.some((item) => item.id === "test/connected-chat"));
  assert.ok(!models.body.models.some((item) => item.id === "test/image-only"));
  const empty = await request(server, "POST", "/api/site/v1/chat", {
    authorization: auth, body: { message: "Hello" },
  });
  assert.equal(empty.status, 402);
  database.seed("site_api_credits", { ownerId: userId, credits: 100 });
  const unauthorized = await request(server, "POST", "/api/site/v1/chat", {
    authorization: auth, body: { message: "Hello", agentId: "custom_not_mine" },
  });
  assert.equal(unauthorized.status, 403);
  const before = database.rows("site_api_credits")[0].credits;
  const chat = await request(server, "POST", "/api/site/v1/chat", {
    authorization: auth, body: { message: "Hello", model: "test/connected-chat" },
  });
  assert.equal(chat.status, 200);
  assert.equal(chat.body.model, "test/connected-chat");
  assert.equal(database.rows("site_api_credits")[0].credits, before - chat.body.creditsUsed);
  assert.equal((await request(server, "POST", "/api/site/v1/chat", {
    authorization: auth, body: { message: "Hello", model: "not-a-real-model" },
  })).status, 400);

  const mcpAccept = "application/json, text/event-stream";
  const initialized = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    body: {
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    },
  });
  assert.equal(initialized.status, 200);
  assert.equal(initialized.body.result.protocolVersion, "2025-03-26");
  assert.deepEqual(initialized.body.result.capabilities, { tools: { listChanged: false } });
  const externalOrigin = "https://mcp-client.example";
  const externalInitialization = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    origin: externalOrigin,
    body: { jsonrpc: "2.0", id: "external-init", method: "initialize", params: { protocolVersion: "2025-03-26" } },
  });
  assert.equal(externalInitialization.status, 200);
  assert.equal(externalInitialization.headers["access-control-allow-origin"], externalOrigin);
  assert.equal(externalInitialization.headers["access-control-allow-credentials"], undefined);
  const externalPreflight = await request(server, "OPTIONS", "/api/mcp", {
    origin: externalOrigin,
    accessControlRequestMethod: "POST",
    accessControlRequestHeaders: "authorization,content-type,accept",
  });
  assert.equal(externalPreflight.status, 204);
  assert.equal(externalPreflight.headers["access-control-allow-origin"], externalOrigin);
  assert.match(externalPreflight.headers["access-control-allow-headers"], /authorization/i);
  assert.match(externalPreflight.headers["access-control-allow-headers"], /accept/i);
  assert.equal(externalPreflight.headers["access-control-allow-credentials"], undefined);
  const cookieOnlyMcpCall = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    origin: externalOrigin,
    cookie: "clerk_session=ambient-cookie",
    body: { jsonrpc: "2.0", id: "cookie-only", method: "tools/list" },
  });
  assert.equal(cookieOnlyMcpCall.status, 401);
  assert.equal(cookieOnlyMcpCall.headers["access-control-allow-origin"], externalOrigin);
  const malformedOrigin = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    origin: "https://mcp-client.example/path",
    body: { jsonrpc: "2.0", id: "bad-origin", method: "initialize" },
  });
  assert.equal(malformedOrigin.status, 403);
  const untrustedHost = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    origin: externalOrigin,
    host: "untrusted.invalid",
    body: { jsonrpc: "2.0", id: "bad-host", method: "initialize" },
  });
  assert.equal(untrustedHost.status, 403);
  assert.equal((await request(server, "POST", "/api/mcp", {
    accept: mcpAccept, body: { jsonrpc: "2.0", method: "notifications/initialized" },
  })).status, 202);
  const initializedWithId = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    body: { jsonrpc: "2.0", id: "invalid-notification", method: "notifications/initialized" },
  });
  assert.equal(initializedWithId.status, 400);
  assert.equal(initializedWithId.body.error.code, -32600);
  const ping = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept, body: { jsonrpc: "2.0", id: "ping", method: "ping" },
  });
  assert.deepEqual(ping.body.result, {});

  const creditsBeforeUnauthenticatedCall = database.rows("site_api_credits")[0].credits;
  const unauthorizedMcpCall = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    body: { jsonrpc: "2.0", id: "private", method: "tools/call", params: { name: "fezi_site_chat", arguments: { message: "must not charge" } } },
  });
  assert.equal(unauthorizedMcpCall.status, 401);
  assert.equal(database.rows("site_api_credits")[0].credits, creditsBeforeUnauthenticatedCall);

  const listedTools = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    authorization: auth,
    body: { jsonrpc: "2.0", id: "tools", method: "tools/list" },
  });
  assert.deepEqual(listedTools.body.result.tools.map((tool) => tool.name), ["fezi_site_models", "fezi_site_chat"]);
  const listedModels = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    authorization: auth,
    body: { jsonrpc: "2.0", id: "models", method: "tools/call", params: { name: "fezi_site_models", arguments: {} } },
  });
  assert.equal(listedModels.status, 200);
  assert.ok(listedModels.body.result.structuredContent.models.some((item) => item.id === "test/connected-chat"));
  assert.ok(!listedModels.body.result.structuredContent.models.some((item) => item.id === "test/image-only"));

  const creditsBeforeInvalidArguments = database.rows("site_api_credits")[0].credits;
  const invalidToolCalls = [
    { name: "fezi_unknown_tool", arguments: {} },
    { name: "fezi_site_chat", arguments: { message: "do not use default", agentId: 17 } },
    { name: "fezi_site_chat", arguments: { message: "do not use default", model: 17 } },
    { name: "fezi_site_chat", arguments: { message: "do not use default", unexpected: true } },
    { name: "fezi_site_chat", arguments: { message: "do not use default" }, unexpected: true },
  ];
  for (const [index, toolParams] of invalidToolCalls.entries()) {
    const invalidCall = await request(server, "POST", "/api/mcp", {
      accept: mcpAccept,
      authorization: auth,
      body: { jsonrpc: "2.0", id: `invalid-${index}`, method: "tools/call", params: toolParams },
    });
    assert.equal(invalidCall.body.error.code, -32602);
  }
  assert.equal(database.rows("site_api_credits")[0].credits, creditsBeforeInvalidArguments);

  // One direct catalog request and one MCP catalog request have already succeeded.
  // The per-key limit is shared across both transports, so these exhaust its window.
  for (let index = 0; index < 17; index += 1) {
    assert.equal((await request(server, "GET", "/api/site/v1/models", { authorization: auth })).status, 200);
  }
  const finalAllowedMcpCatalogCall = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    authorization: auth,
    body: { jsonrpc: "2.0", id: "final-catalog", method: "tools/call", params: { name: "fezi_site_models" } },
  });
  assert.equal(finalAllowedMcpCatalogCall.body.result.isError, undefined);
  const limitedDirectCatalogCall = await request(server, "GET", "/api/site/v1/models", { authorization: auth });
  assert.equal(limitedDirectCatalogCall.status, 429);
  const limitedMcpCatalogCall = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    authorization: auth,
    body: { jsonrpc: "2.0", id: "limited-catalog", method: "tools/call", params: { name: "fezi_site_models" } },
  });
  assert.equal(limitedMcpCatalogCall.body.result.isError, true);
  assert.equal(limitedMcpCatalogCall.body.result.structuredContent.status, 429);

  const creditsBeforeWrongScope = database.rows("site_api_credits")[0].credits;
  const wrongScope = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    authorization: auth,
    body: { jsonrpc: "2.0", id: "scope", method: "tools/call", params: { name: "fezi_site_chat", arguments: { message: "must not charge", agentId: "custom_not_mine" } } },
  });
  assert.equal(wrongScope.body.result.isError, true);
  assert.equal(wrongScope.body.result.structuredContent.status, 403);
  assert.equal(database.rows("site_api_credits")[0].credits, creditsBeforeWrongScope);

  const creditsBeforeMcpChat = database.rows("site_api_credits")[0].credits;
  const mcpChat = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    authorization: auth,
    body: {
      jsonrpc: "2.0", id: "chat", method: "tools/call",
      params: { name: "fezi_site_chat", arguments: { message: "MCP authorized forwarding", model: "test/connected-chat" } },
    },
  });
  assert.equal(mcpChat.status, 200);
  assert.equal(mcpChat.body.result.structuredContent.model, "test/connected-chat");
  assert.ok(mcpChat.body.result.content[0].text.length > 0);
  assert.equal(database.rows("site_api_credits")[0].credits, creditsBeforeMcpChat - mcpChat.body.result.structuredContent.creditsUsed);

  const siteKeyRow = database.rows("custom_agent_api_keys").find((row) => row.agentId === "site");
  siteKeyRow.revokedAt = new Date();
  const revokedKey = await request(server, "POST", "/api/mcp", {
    accept: mcpAccept,
    authorization: auth,
    body: { jsonrpc: "2.0", id: "revoked", method: "tools/list" },
  });
  assert.equal(revokedKey.status, 401);
});