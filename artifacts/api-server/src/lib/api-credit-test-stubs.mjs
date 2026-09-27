const tableNames = [
  "account_activity",
  "account_credits",
  "account_payments",
  "redeem_code_orders",
  "payment_consumptions",
  "account_referrals",
  "referral_purchase_rewards",
  "admin_codes",
  "admin_code_redemptions",
  "prompt_studio_images",
  "prompt_studio_prompts",
  "account_subscriptions",
  "agent_site_subscriptions",
  "chat_conversations",
  "chat_messages",
  "created_files",
  "custom_agent_api_keys",
  "custom_agents",
  "projects",
  "reward_task_claims",
  "reward_tasks",
  "site_settings",
  "site_api_credits",
  "support_tickets",
  "user_memories",
  "user_profiles",
];

function createTable(name) {
  return new Proxy({ __tableName: name }, {
    get(target, property) {
      if (property === "__tableName") return target.__tableName;
      if (property === "then") return undefined;
      return { __tableName: name, __columnName: String(property) };
    },
  });
}

const tables = Object.fromEntries(tableNames.map((name) => [name, createTable(name)]));

function columnInfo(column) {
  return {
    table: column?.__tableName,
    name: column?.__columnName,
  };
}

function conditionMatches(row, condition) {
  if (!condition) return true;
  if (condition.kind === "and") return condition.conditions.every((item) => conditionMatches(row, item));
  if (condition.kind === "or") return condition.conditions.some((item) => conditionMatches(row, item));
  if (condition.kind === "sql" && condition.strings.join("").includes("lower(trim(")) {
    const value = String(row[columnInfo(condition.values[0]).name]).trim().toLowerCase();
    return (condition.strings.join("").includes("regexp_replace") ? value.replace(/^0x/, "") : value) === condition.values[1];
  }
  if (condition.kind === "sql" && condition.strings.join("").includes(">=")) return row.credits >= condition.values.at(-1);
  const value = row[condition.column.name];
  if (condition.kind === "eq") return value === condition.value;
  if (condition.kind === "is-null") return value == null;
  if (condition.kind === "in-array") return condition.values.includes(value);
  return true;
}

function project(row, fields) {
  if (!fields) return row;
  return Object.fromEntries(Object.entries(fields).map(([key, column]) => {
    const info = columnInfo(column);
    return [key, info.name ? row[info.name] : row[key]];
  }));
}

function defaultsFor(tableName, values) {
  if (tableName === "chat_conversations") {
    return { title: "New chat", createdAt: new Date(), updatedAt: new Date(), ...values };
  }
  if (tableName === "chat_messages") {
    return { createdAt: new Date(), metadata: {}, ...values };
  }
  if (tableName === "account_credits") {
    return {
      credits: 1000,
      creditsLimit: 1000,
      chats: 0,
      freeImagesToday: 0,
      freeVideosToday: 0,
      freeVideoUsageByTool: {},
      ...values,
    };
  }
  if (tableName === "custom_agent_api_keys") {
    return { createdAt: new Date(), revokedAt: null, lastUsedAt: null, ...values };
  }
  if (tableName === "custom_agents") {
    return { usageCount: 0, ...values };
  }
  return values;
}

function makeBuilder(kind, initialTable, fields, execute) {
  const state = {
    kind,
    table: initialTable,
    fields,
    condition: undefined,
    maxRows: undefined,
    order: [],
    values: undefined,
    updates: undefined,
    returningFields: undefined,
    conflict: undefined,
  };

  const builder = {
    from(table) {
      state.table = table;
      return builder;
    },
    where(condition) {
      state.condition = condition;
      return builder;
    },
    limit(value) {
      state.maxRows = value;
      return builder;
    },
    orderBy(...values) {
      state.order = values;
      return builder;
    },
    innerJoin() {
      return builder;
    },
    values(value) {
      state.values = value;
      return builder;
    },
    set(value) {
      state.updates = value;
      return builder;
    },
    onConflictDoNothing() {
      state.conflict = { kind: "nothing" };
      return builder;
    },
    onConflictDoUpdate(value) {
      state.conflict = { kind: "update", ...value };
      return builder;
    },
    returning(value) {
      state.returningFields = value;
      return builder;
    },
    then(resolve, reject) {
      return Promise.resolve(execute(state)).then(resolve, reject);
    },
  };

  return builder;
}

function createDatabaseHarness() {
  const rowsByTable = new Map(tableNames.map((name) => [name, []]));

  function rowsFor(tableName) {
    return rowsByTable.get(tableName) ?? [];
  }

  function execute(state) {
    const tableName = state.table?.__tableName;
    if (!tableName) throw new Error("Test database query did not select a table.");
    const tableRows = rowsFor(tableName);

    if (state.kind === "select") {
      let selected = tableRows.filter((row) => conditionMatches(row, state.condition));
      for (const order of state.order) {
        const info = columnInfo(order?.column ?? order);
        if (!info.name) continue;
        selected = [...selected].sort((left, right) => {
          const comparison = String(left[info.name] ?? "").localeCompare(String(right[info.name] ?? ""));
          return order?.direction === "desc" ? -comparison : comparison;
        });
      }
      if (state.maxRows !== undefined) selected = selected.slice(0, state.maxRows);
      return selected.map((row) => project(row, state.fields));
    }

    if (state.kind === "insert") {
      const incoming = Array.isArray(state.values) ? state.values : [state.values];
      const inserted = [];
      for (const raw of incoming.filter(Boolean)) {
        const values = defaultsFor(tableName, { ...raw });
        const conflictTarget = state.conflict?.target;
        const conflictColumns = (Array.isArray(conflictTarget) ? conflictTarget : [conflictTarget])
          .map((column) => columnInfo(column).name)
          .filter(Boolean);
        const uniqueColumns = conflictColumns.length ? conflictColumns : ["id", "userId", "referredUserId"];
        const existing = state.conflict
          ? tableRows.find((row) => uniqueColumns.some((key) => values[key] !== undefined && row[key] === values[key]))
          : undefined;
        if (existing && state.conflict?.kind === "nothing") continue;
        if (existing && state.conflict?.kind === "update") {
          for (const [key, value] of Object.entries(state.conflict.set)) {
            existing[key] = value?.kind === "sql" && typeof value.values?.at(-1) === "number"
              ? (existing[key] ?? 0) + value.values.at(-1)
              : value;
          }
          inserted.push(existing);
          continue;
        }
        tableRows.push(values);
        inserted.push(values);
      }
      return inserted.map((row) => project(row, state.returningFields));
    }

    if (state.kind === "update") {
      const changed = tableRows.filter((row) => conditionMatches(row, state.condition));
      for (const row of changed) {
        for (const [key, value] of Object.entries(state.updates)) {
          row[key] = (tableName === "site_api_credits" || tableName === "account_credits") && key === "credits"
            && value?.kind === "sql" && value.strings?.join("").includes(" - ")
            ? row.credits - value.values.at(-1) : value;
        }
      }
      return changed.map((row) => project(row, state.returningFields));
    }

    if (state.kind === "delete") {
      const removed = tableRows.filter((row) => conditionMatches(row, state.condition));
      rowsByTable.set(tableName, tableRows.filter((row) => !removed.includes(row)));
      return removed;
    }

    throw new Error(`Unsupported test database operation: ${state.kind}`);
  }

  const database = {
    async execute() { return []; },
    select(fields) {
      return makeBuilder("select", undefined, fields, execute);
    },
    insert(table) {
      return makeBuilder("insert", table, undefined, execute);
    },
    update(table) {
      return makeBuilder("update", table, undefined, execute);
    },
    delete(table) {
      return makeBuilder("delete", table, undefined, execute);
    },
    async transaction(callback) {
      return callback(database);
    },
  };

  return {
    db: database,
    rows: rowsFor,
    seed(tableName, row) {
      rowsFor(tableName).push({ ...row });
    },
    reset() {
      for (const name of tableNames) rowsByTable.set(name, []);
    },
  };
}

const harness = globalThis.__feziApiCreditTestDb ??= createDatabaseHarness();

export const db = harness.db;
export const accountActivityTable = tables.account_activity;
export const accountCreditsTable = tables.account_credits;
export const accountPaymentsTable = tables.account_payments;
export const redeemCodeOrdersTable = tables.redeem_code_orders;
export const paymentConsumptionsTable = tables.payment_consumptions;
export const accountReferralsTable = tables.account_referrals;
export const referralPurchaseRewardsTable = tables.referral_purchase_rewards;
export const adminCodesTable = tables.admin_codes;
export const adminCodeRedemptionsTable = tables.admin_code_redemptions;
export const promptStudioImagesTable = tables.prompt_studio_images;
export const promptStudioPromptsTable = tables.prompt_studio_prompts;
export const accountSubscriptionsTable = tables.account_subscriptions;
export const agentSiteSubscriptionsTable = tables.agent_site_subscriptions;
export const chatConversationsTable = tables.chat_conversations;
export const chatMessagesTable = tables.chat_messages;
export const createdFilesTable = tables.created_files;
export const customAgentApiKeysTable = tables.custom_agent_api_keys;
export const customAgentsTable = tables.custom_agents;
export const projectsTable = tables.projects;
export const rewardTaskClaimsTable = tables.reward_task_claims;
export const rewardTasksTable = tables.reward_tasks;
export const siteSettingsTable = tables.site_settings;
export const siteApiCreditsTable = tables.site_api_credits;
export const supportTicketsTable = tables.support_tickets;
export const userMemoriesTable = tables.user_memories;
export const userProfilesTable = tables.user_profiles;

export const and = (...conditions) => ({ kind: "and", conditions });
export const or = (...conditions) => ({ kind: "or", conditions });
export const eq = (column, value) => ({ kind: "eq", column: columnInfo(column), value });
export const isNull = (column) => ({ kind: "is-null", column: columnInfo(column) });
export const inArray = (column, values) => ({ kind: "in-array", column: columnInfo(column), values });
export const desc = (column) => ({ direction: "desc", column });
export const sql = (strings, ...values) => ({ kind: "sql", strings: [...strings], values });

export function getAuthenticatedUserId(req) {
  const userId = req.headers["x-test-user-id"];
  return typeof userId === "string" && userId.length ? userId : undefined;
}

export function requireAuth(req, res, next) {
  if (!getAuthenticatedUserId(req)) {
    res.status(401).json({ error: "Authentication is required." });
    return;
  }
  next();
}

export const clerkClient = { users: { getUser: async () => {
  if (globalThis.__testGoogleLookupError) throw new Error("Clerk unavailable");
  return { externalAccounts: globalThis.__testGoogleVerified !== false
    ? [{ provider: "google", verification: { status: "verified" } }]
    : [] };
} } };
export async function publishGeneratedPromptImage() {
  throw new Error("Image storage is not part of API Credit boundary tests.");
}
export const objectStorageClient = {
  bucket() { throw new Error("Chat media storage must be explicitly mocked by media tests."); },
};
