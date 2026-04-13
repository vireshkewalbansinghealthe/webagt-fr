/**
 * worker/src/routes/admin.ts
 *
 * Admin-only API routes. Every handler is gated behind an adminMiddleware
 * that checks `c.var.userRole === "admin"` (set by authMiddleware from the
 * JWT `metadata.role` claim — configure this in the Clerk dashboard by
 * setting publicMetadata.role = "admin" for admin users).
 *
 * Endpoints:
 *  GET  /api/admin/stats                          Platform-wide stats
 *  GET  /api/admin/users                          Paginated user list (Clerk API)
 *  GET  /api/admin/users/:userId                  Single user detail + projects
 *  PATCH /api/admin/users/:userId/credits         Override a user's credits
 *  DELETE /api/admin/users/:userId/projects/:pid  Remove any project as admin
 */

import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Env, AppVariables } from "../types";
import { computeUserAnalytics } from "../services/analytics-engine";
import { getBillingConfig, DEFAULT_PRICING_FORMULA } from "./billing";

const adminRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// Admin guard middleware
// ---------------------------------------------------------------------------

/**
 * Check if a user is an admin.
 * First checks the JWT `metadata.role` claim (only present if a custom Clerk
 * JWT template includes it). Falls back to a Clerk API lookup so it works
 * with the default session token that doesn't embed publicMetadata.
 */
async function isAdminUser(userId: string, jwtRole: string | undefined, secretKey: string): Promise<boolean> {
  if (jwtRole === "admin") return true;
  if (!secretKey) return false;
  try {
    const res = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!res.ok) return false;
    const user = await res.json() as { public_metadata?: { role?: string } };
    return user.public_metadata?.role === "admin";
  } catch {
    return false;
  }
}

const adminMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const secretKey = c.env.CLERK_SECRET_KEY ?? "";
  const admin = await isAdminUser(c.var.userId, c.var.userRole, secretKey);
  if (!admin) {
    return c.json({ error: "Forbidden — admin only", code: "FORBIDDEN" }, 403);
  }
  await next();
});

adminRoutes.use("*", adminMiddleware);

// ---------------------------------------------------------------------------
// Clerk API helper
// ---------------------------------------------------------------------------

async function clerkFetch<T>(
  secretKey: string,
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clerk API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// GET /api/admin/stats
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/stats", async (c) => {
  const secretKey = c.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return c.json({ error: "CLERK_SECRET_KEY not configured" }, 500);
  }

  // Fetch in parallel: user count, recent users, KV project keys
  const [userCount, recentUsers, projectList] = await Promise.allSettled([
    clerkFetch<{ total_count: number }>(secretKey, "/users/count"),
    clerkFetch<ClerkUser[]>(secretKey, "/users?limit=5&order_by=-created_at"),
    c.env.METADATA.list({ prefix: "project:", limit: 1000 }),
  ]);

  const totalUsers =
    userCount.status === "fulfilled" ? userCount.value.total_count : null;
  const latestUsers =
    recentUsers.status === "fulfilled" ? recentUsers.value : [];
  const totalProjects =
    projectList.status === "fulfilled" ? projectList.value.keys.length : null;

  // Count pro users: list KV keys with prefix "credits:" and find those with plan=pro
  // We'll return what we have; a deeper count requires iterating all credits keys.

  return c.json({
    totalUsers,
    totalProjects,
    latestUsers: latestUsers.map(clerkUserToSummary),
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/users", async (c) => {
  const secretKey = c.env.CLERK_SECRET_KEY;
  if (!secretKey) return c.json({ error: "CLERK_SECRET_KEY not configured" }, 500);

  const limit = Math.min(Number(c.req.query("limit") ?? "20"), 100);
  const offset = Number(c.req.query("offset") ?? "0");
  const query = c.req.query("q") ?? "";

  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    order_by: "-created_at",
    ...(query ? { query } : {}),
  });

  const [users, countResult] = await Promise.all([
    clerkFetch<ClerkUser[]>(secretKey, `/users?${qs}`),
    clerkFetch<{ total_count: number }>(secretKey, `/users/count${query ? `?query=${encodeURIComponent(query)}` : ""}`),
  ]);

  // For each user fetch their project count from KV
  const projectCounts = await Promise.allSettled(
    users.map(async (u) => {
      const ids = await c.env.METADATA.get<string[]>(`user-projects:${u.id}`, "json");
      return { userId: u.id, count: ids?.length ?? 0 };
    })
  );

  const countMap: Record<string, number> = {};
  for (const r of projectCounts) {
    if (r.status === "fulfilled") countMap[r.value.userId] = r.value.count;
  }

  return c.json({
    users: users.map((u) => ({ ...clerkUserToSummary(u), projectCount: countMap[u.id] ?? 0 })),
    totalCount: countResult.total_count,
    limit,
    offset,
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users/:userId
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/users/:userId", async (c) => {
  const secretKey = c.env.CLERK_SECRET_KEY;
  if (!secretKey) return c.json({ error: "CLERK_SECRET_KEY not configured" }, 500);

  const { userId } = c.req.param();

  const [clerkUser, projectIds, creditsRaw] = await Promise.all([
    clerkFetch<ClerkUser>(secretKey, `/users/${userId}`),
    c.env.METADATA.get<string[]>(`user-projects:${userId}`, "json"),
    c.env.METADATA.get(`credits:${userId}`, "text"),
  ]);

  // Fetch project metadata for each project
  const projects = await Promise.all(
    (projectIds ?? []).map(async (pid) => {
      const proj = await c.env.METADATA.get<{ id: string; name: string; updatedAt: string; type?: string }>(
        `project:${pid}`,
        "json"
      );
      return proj ?? { id: pid, name: "Unknown", updatedAt: "" };
    })
  );

  let credits: Record<string, unknown> | null = null;
  try {
    credits = creditsRaw ? JSON.parse(creditsRaw) : null;
  } catch {
    // ignore
  }

  return c.json({
    user: clerkUserToSummary(clerkUser),
    projects: projects.filter(Boolean),
    credits,
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/users/:userId/analytics
// Compute usage analytics for a specific user as admin
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/users/:userId/analytics", async (c) => {
  const { userId } = c.req.param();
  const analytics = await computeUserAnalytics(userId, c.env);
  return c.json(analytics);
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:userId
// Update user metadata in Clerk (name, role, plan)
// ---------------------------------------------------------------------------

adminRoutes.patch("/api/admin/users/:userId", async (c) => {
  const secretKey = c.env.CLERK_SECRET_KEY;
  if (!secretKey) return c.json({ error: "CLERK_SECRET_KEY not configured" }, 500);

  const { userId } = c.req.param();
  const body = await c.req.json<{
    firstName?: string;
    lastName?: string;
    role?: string;
    plan?: string;
  }>();

  // Update Clerk
  const clerkPayload: any = {};
  if (body.firstName !== undefined) clerkPayload.first_name = body.firstName;
  if (body.lastName !== undefined) clerkPayload.last_name = body.lastName;
  
  const publicMetadata: any = {};
  if (body.role !== undefined) publicMetadata.role = body.role;
  if (body.plan !== undefined) publicMetadata.plan = body.plan;
  
  if (Object.keys(publicMetadata).length > 0) {
    clerkPayload.public_metadata = publicMetadata;
  }

  const updatedClerkUser = await clerkFetch<ClerkUser>(secretKey, `/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(clerkPayload),
  });

  // If plan was changed, also update KV credits to stay in sync
  if (body.plan !== undefined) {
    const existing = await c.env.METADATA.get<Record<string, unknown>>(`credits:${userId}`, "json");
    const updatedCredits = {
      ...(existing ?? {}),
      plan: body.plan,
      updatedAt: new Date().toISOString(),
    };
    await c.env.METADATA.put(`credits:${userId}`, JSON.stringify(updatedCredits));
  }

  return c.json({
    success: true,
    user: clerkUserToSummary(updatedClerkUser),
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/users/:userId/credits
// Override a user's credit balance (e.g. grant extra credits or reset)
// ---------------------------------------------------------------------------

adminRoutes.patch("/api/admin/users/:userId/credits", async (c) => {
  const { userId } = c.req.param();
  const body = await c.req.json<{ remaining?: number; total?: number; plan?: string }>();

  const existing = await c.env.METADATA.get<Record<string, unknown>>(
    `credits:${userId}`,
    "json"
  );

  const updated = {
    ...(existing ?? {}),
    ...(body.remaining !== undefined ? { remaining: body.remaining } : {}),
    ...(body.total !== undefined ? { total: body.total } : {}),
    ...(body.plan !== undefined ? { plan: body.plan } : {}),
    updatedAt: new Date().toISOString(),
  };

  await c.env.METADATA.put(`credits:${userId}`, JSON.stringify(updated));

  return c.json({ success: true, credits: updated });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/users/:userId/projects/:projectId
// ---------------------------------------------------------------------------

adminRoutes.delete("/api/admin/users/:userId/projects/:projectId", async (c) => {
  const { userId, projectId } = c.req.param();

  await Promise.all([
    c.env.METADATA.delete(`project:${projectId}`),
    c.env.METADATA.delete(`chat:${projectId}`),
    // Remove from user project list
    (async () => {
      const ids = await c.env.METADATA.get<string[]>(`user-projects:${userId}`, "json");
      if (ids) {
        await c.env.METADATA.put(
          `user-projects:${userId}`,
          JSON.stringify(ids.filter((id) => id !== projectId))
        );
      }
    })(),
  ]);

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/admin/provider-balances
// Queries each configured LLM provider for their current credit/balance info.
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/provider-balances", async (c) => {
  const results = await Promise.allSettled([
    checkAnthropicBalance(c.env.ANTHROPIC_API_KEY, c.env.ANTHROPIC_ADMIN_KEY),
    checkDeepSeekBalance(c.env.DEEPSEEK_API_KEY),
  ]);

  const [anthropic, deepseek] = results.map((r) =>
    r.status === "fulfilled" ? r.value : { available: false, error: (r.reason as Error)?.message ?? "Unknown error" }
  );

  return c.json({ anthropic, deepseek });
});

interface ProviderBalance {
  available: boolean;
  balance?: string;
  currency?: string;
  extra?: Record<string, unknown>;
  error?: string;
  dashboardUrl: string;
}

// ---------------------------------------------------------------------------
// Anthropic token pricing (per 1M tokens, USD)
// ---------------------------------------------------------------------------
const ANTHROPIC_PRICING: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-opus-4-6":           { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-opus-4-20250514":    { input: 15.00, output: 75.00, cacheWrite: 18.75, cacheRead: 1.50 },
  "claude-sonnet-4-6":         { input:  3.00, output: 15.00, cacheWrite:  3.75, cacheRead: 0.30 },
  "claude-sonnet-4-5-20250929":{ input:  3.00, output: 15.00, cacheWrite:  3.75, cacheRead: 0.30 },
  "claude-sonnet-4-20250514":  { input:  3.00, output: 15.00, cacheWrite:  3.75, cacheRead: 0.30 },
  "claude-haiku-4-5-20251001": { input:  0.80, output:  4.00, cacheWrite:  1.00, cacheRead: 0.08 },
  "claude-haiku-4-20250307":   { input:  0.80, output:  4.00, cacheWrite:  1.00, cacheRead: 0.08 },
};

function anthropicTokenCost(model: string, result: AnthropicUsageResult): number {
  // Fuzzy match: find the pricing key that is a prefix of (or matches) the model name
  const key = Object.keys(ANTHROPIC_PRICING).find(
    (k) => model === k || model.startsWith(k) || k.startsWith(model.split("-").slice(0, 3).join("-"))
  );
  const p = key ? ANTHROPIC_PRICING[key] : { input: 3.00, output: 15.00, cacheWrite: 3.75, cacheRead: 0.30 };
  const M = 1_000_000;
  return (
    (result.uncached_input_tokens / M) * p.input +
    (result.output_tokens / M) * p.output +
    ((result.cache_creation?.ephemeral_5m_input_tokens ?? 0) / M) * p.cacheWrite +
    ((result.cache_creation?.ephemeral_1h_input_tokens ?? 0) / M) * p.cacheWrite +
    (result.cache_read_input_tokens / M) * p.cacheRead
  );
}

interface AnthropicUsageResult {
  model: string;
  uncached_input_tokens: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
  cache_read_input_tokens: number;
  output_tokens: number;
}

interface AnthropicUsagePage {
  data: { results: AnthropicUsageResult[] }[];
  has_more: boolean;
  next_page?: string;
}

async function checkAnthropicBalance(apiKey: string | undefined, adminKey: string | undefined): Promise<ProviderBalance> {
  const base = { dashboardUrl: "https://console.anthropic.com/settings/billing" };
  if (!apiKey) return { ...base, available: false, error: "API key not configured" };

  // If an Admin API key is configured, use the Usage API and calculate costs from tokens
  if (adminKey) {
    try {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

      const byModel: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number; cost: number }> = {};
      let cursor: string | undefined;

      // Paginate through all results for the month
      for (let page = 0; page < 20; page++) {
        const qs = new URLSearchParams({
          starting_at: startOfMonth.toISOString().slice(0, 19) + "Z",
          ending_at: endOfDay.toISOString().slice(0, 19) + "Z",
          bucket_width: "1d",
          "group_by[]": "model",
          ...(cursor ? { page: cursor } : {}),
        });

        const res = await fetch(`https://api.anthropic.com/v1/organizations/usage_report/messages?${qs}`, {
          headers: { "x-api-key": adminKey, "anthropic-version": "2023-06-01" },
        });

        if (!res.ok) {
          const body = await res.json() as { error?: { message?: string } };
          console.warn("[admin] Anthropic Usage API error:", body.error?.message);
          break;
        }

        const data = await res.json() as AnthropicUsagePage;

        for (const bucket of data.data) {
          for (const r of bucket.results) {
            const m = r.model ?? "unknown";
            if (!byModel[m]) byModel[m] = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 };
            byModel[m].input += r.uncached_input_tokens;
            byModel[m].output += r.output_tokens;
            byModel[m].cacheWrite += (r.cache_creation?.ephemeral_5m_input_tokens ?? 0) + (r.cache_creation?.ephemeral_1h_input_tokens ?? 0);
            byModel[m].cacheRead += r.cache_read_input_tokens;
            byModel[m].cost += anthropicTokenCost(m, r);
          }
        }

        if (!data.has_more || !data.next_page) break;
        cursor = data.next_page;
      }

      const totalCost = Object.values(byModel).reduce((s, v) => s + v.cost, 0);
      const totalInput = Object.values(byModel).reduce((s, v) => s + v.input, 0);
      const totalOutput = Object.values(byModel).reduce((s, v) => s + v.output, 0);

      // Friendly model name mapping
      const modelDisplay: Record<string, { cost: number; input: number; output: number }> = {};
      for (const [model, stats] of Object.entries(byModel)) {
        const shortName = model
          .replace("claude-", "")
          .replace("-20250514", "")
          .replace("-20251001", "")
          .replace("-20250929", "");
        if (!modelDisplay[shortName]) modelDisplay[shortName] = { cost: 0, input: 0, output: 0 };
        modelDisplay[shortName].cost += stats.cost;
        modelDisplay[shortName].input += stats.input;
        modelDisplay[shortName].output += stats.output;
      }

      return {
        ...base,
        available: true,
        balance: `$${totalCost.toFixed(2)} spent this month`,
        extra: {
          inputTokens: totalInput,
          outputTokens: totalOutput,
          costUsd: totalCost,
          byModel: modelDisplay,
          period: `${startOfMonth.toISOString().slice(0, 10)} – ${now.toISOString().slice(0, 10)}`,
        },
      };
    } catch (e) {
      console.warn("[admin] Anthropic Admin API fetch failed:", (e as Error).message);
    }
  }

  // No admin key — just validate the regular key is working
  try {
    const res = await fetch("https://api.anthropic.com/v1/models", {
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    });
    if (res.ok) {
      return { ...base, available: true, balance: "Key valid — add ANTHROPIC_ADMIN_KEY for spend data" };
    }
    const body = await res.json() as { error?: { message?: string } };
    return { ...base, available: false, error: body.error?.message ?? `HTTP ${res.status}` };
  } catch (e) {
    return { ...base, available: false, error: (e as Error).message };
  }
}

async function checkDeepSeekBalance(apiKey: string | undefined): Promise<ProviderBalance> {
  const base = { dashboardUrl: "https://platform.deepseek.com/usage" };
  if (!apiKey) return { ...base, available: false, error: "API key not configured" };
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (!res.ok) {
      const body = await res.json() as { message?: string };
      return { ...base, available: false, error: body.message ?? `HTTP ${res.status}` };
    }
    const data = await res.json() as {
      is_available?: boolean;
      balance_infos?: { currency: string; total_balance: string; granted_balance: string; topped_up_balance: string }[];
    };
    const info = data.balance_infos?.[0];
    return {
      ...base,
      available: data.is_available ?? true,
      balance: info ? `${info.currency} ${parseFloat(info.total_balance).toFixed(4)}` : "Unknown",
      currency: info?.currency,
      extra: info
        ? { granted: info.granted_balance, toppedup: info.topped_up_balance }
        : undefined,
    };
  } catch (e) {
    return { ...base, available: false, error: (e as Error).message };
  }
}


// ---------------------------------------------------------------------------
// Clerk user shape + mapping helper
// ---------------------------------------------------------------------------

interface ClerkEmailAddress {
  email_address: string;
  verification?: { status: string };
}

interface ClerkUser {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses: ClerkEmailAddress[];
  image_url?: string;
  created_at: number; // unix ms
  last_active_at?: number | null;
  last_sign_in_at?: number | null;
  public_metadata?: Record<string, unknown>;
}

function clerkUserToSummary(u: ClerkUser) {
  const primaryEmail =
    u.email_addresses.find((e) => e.verification?.status === "verified")?.email_address ??
    u.email_addresses[0]?.email_address ??
    "";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || primaryEmail.split("@")[0];
  return {
    id: u.id,
    name,
    email: primaryEmail,
    imageUrl: u.image_url,
    role: (u.public_metadata?.role as string | undefined) ?? "user",
    plan: (u.public_metadata?.plan as string | undefined) ?? "free",
    createdAt: new Date(u.created_at).toISOString(),
    lastSignInAt: u.last_sign_in_at ? new Date(u.last_sign_in_at).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/admin/projects/:projectId/logs — Fetch _AppLog for any project (admin bypass)
// ---------------------------------------------------------------------------
adminRoutes.get("/api/admin/projects/:projectId/logs", async (c) => {
  const projectId = c.req.param("projectId");
  const level = c.req.query("level");
  const limit = Math.min(Number(c.req.query("limit") || 200), 500);

  const project = await c.env.METADATA.get<{ databaseUrl?: string; databaseToken?: string }>(
    `project:${projectId}`,
    "json"
  );
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Try Turso DB first
  if (project.databaseUrl && project.databaseToken) {
    try {
      const { createClient } = await import("@libsql/client/web");
      const db = createClient({ url: project.databaseUrl, authToken: project.databaseToken });
      await db.execute("CREATE TABLE IF NOT EXISTS [_AppLog] (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL DEFAULT 'info', source TEXT, message TEXT NOT NULL, detail TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)");

      const where = level ? `WHERE level = '${level.replace(/'/g, "")}'` : "";
      const result = await db.execute(`SELECT * FROM _AppLog ${where} ORDER BY id DESC LIMIT ${limit}`);
      const logs = result.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        result.columns.forEach((col, i) => { obj[col] = (row as any)[i]; });
        return obj;
      });

      return c.json({ logs, total: logs.length, projectId, source: "turso" });
    } catch (e: any) {
      // Fall through to KV fallback
    }
  }

  // Fallback: read from KV
  try {
    const kvLogs = await c.env.METADATA.get<Array<{ level: string; source: string; message: string; detail?: string; createdAt: string }>>(`logs:${projectId}`, "json") || [];
    const filtered = level ? kvLogs.filter((l) => l.level === level) : kvLogs;
    const limited = filtered.slice(-limit).reverse();
    return c.json({ logs: limited, total: limited.length, projectId, source: "kv-fallback", noDatabase: !project.databaseUrl });
  } catch (e: any) {
    return c.json({ error: "Failed to read logs", detail: e.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/admin/users/:userId/projects — List projects for a user (for log lookup)
// ---------------------------------------------------------------------------
adminRoutes.get("/api/admin/users/:userId/projects", async (c) => {
  const userId = c.req.param("userId");
  const list = await c.env.METADATA.list({ prefix: `project:` });
  const projects: { id: string; name: string; type?: string; hasTurso: boolean }[] = [];

  for (const key of list.keys) {
    const p = await c.env.METADATA.get<{
      id: string;
      name: string;
      userId: string;
      type?: string;
      databaseUrl?: string;
    }>(key.name, "json");
    if (p && p.userId === userId) {
      projects.push({
        id: p.id,
        name: p.name,
        type: p.type,
        hasTurso: !!p.databaseUrl,
      });
    }
  }

  return c.json({ projects });
});

// ---------------------------------------------------------------------------
// GET /api/admin/projects/:projectId/chat — Chat history for a project (admin)
// ---------------------------------------------------------------------------
adminRoutes.get("/api/admin/projects/:projectId/chat", async (c) => {
  const projectId = c.req.param("projectId");
  const raw = await c.env.METADATA.get(`chat:${projectId}`, "json") as { messages?: unknown[] } | null;
  return c.json({ messages: raw?.messages ?? [] });
});

// ---------------------------------------------------------------------------
// GET /api/admin/fly/machines
// List all Fly.io machines for the chat app
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/fly/machines", async (c) => {
  const token = c.env.FLY_API_TOKEN;
  const app = c.env.FLY_APP_NAME || "webagt-chat";

  if (!token) {
    return c.json({ error: "FLY_API_TOKEN not configured" }, 500);
  }

  const authHeader = token.startsWith("FlyV1") ? token : `Bearer ${token}`;
  const res = await fetch(`https://api.machines.dev/v1/apps/${app}/machines`, {
    headers: { Authorization: authHeader },
  });

  if (!res.ok) {
    const text = await res.text();
    return c.json({ error: `Fly.io API error ${res.status}: ${text}` }, 502);
  }

  const machines = await res.json();
  return c.json({ machines, app });
});

// ---------------------------------------------------------------------------
// GET /api/admin/fly/logs
// Fetch recent log lines from Fly.io (polling endpoint — called every 3s)
// Returns NDJSON parsed to JSON array; optionally filter by instance/region.
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/fly/logs", async (c) => {
  const token = c.env.FLY_API_TOKEN;
  const app = c.env.FLY_APP_NAME || "webagt-chat";

  if (!token) {
    return c.json({ error: "FLY_API_TOKEN not configured" }, 500);
  }

  const region = c.req.query("region") || "";
  const instance = c.req.query("instance") || "";

  const params = new URLSearchParams();
  if (region) params.set("region", region);
  if (instance) params.set("instance", instance);
  const qs = params.toString();
  const url = `https://api.fly.io/api/v1/apps/${app}/logs${qs ? `?${qs}` : ""}`;
  const authHeader = token.startsWith("FlyV1") ? token : `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: authHeader },
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return c.json({ error: "Request to Fly.io timed out" }, 504);
  }

  if (!res.ok) {
    const text = await res.text();
    return c.json({ error: `Fly.io API error ${res.status}: ${text}` }, 502);
  }

  const text = await res.text();

  let logs: any[];
  try {
    const parsed = JSON.parse(text);
    logs = Array.isArray(parsed?.data) ? parsed.data : [];
  } catch {
    logs = text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  }

  return c.json({ logs, app });
});

// ---------------------------------------------------------------------------
// GET /api/admin/credits/report
// Aggregate all user credit balances from KV for the consumption dashboard
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/credits/report", async (c) => {
  const secretKey = c.env.CLERK_SECRET_KEY;
  const keys = await c.env.METADATA.list({ prefix: "credits:", limit: 1000 });

  const entries = await Promise.all(
    keys.keys.map(async (key) => {
      const data = await c.env.METADATA.get<{
        remaining?: number;
        total?: number;
        plan?: string;
        updatedAt?: string;
        apiSpendUsd?: number;
      }>(key.name, "json");
      if (!data) return null;
      return {
        userId: key.name.replace("credits:", ""),
        remaining: data.remaining ?? 0,
        total: data.total ?? 0,
        plan: data.plan ?? "free",
        updatedAt: data.updatedAt,
        apiSpendUsd: data.apiSpendUsd ?? 0,
        email: "",
      };
    })
  );

  const credits = entries.filter(Boolean) as {
    userId: string;
    remaining: number;
    total: number;
    plan: string;
    updatedAt?: string;
    apiSpendUsd: number;
    email: string;
  }[];

  if (secretKey) {
    const userIds = credits
      .map((c) => c.userId)
      .filter((id) => id.startsWith("user_"));

    if (userIds.length > 0) {
      try {
        const qs = userIds.map((id) => `user_id=${id}`).join("&");
        const users = await clerkFetch<ClerkUser[]>(secretKey, `/users?${qs}&limit=100`);
        const emailMap = new Map<string, string>();
        for (const u of users) {
          const email = u.email_addresses?.find((e: any) => e.id === u.primary_email_address_id)?.email_address
            || u.email_addresses?.[0]?.email_address
            || "";
          emailMap.set(u.id, email);
        }
        for (const entry of credits) {
          entry.email = emailMap.get(entry.userId) || entry.userId;
        }
      } catch {
        // Fall back to userId if Clerk lookup fails
      }
    }
  }

  const totalAllocated = credits.reduce((s, c) => s + c.total, 0);
  const totalRemaining = credits.reduce((s, c) => s + c.remaining, 0);
  const totalConsumed = totalAllocated - totalRemaining;

  return c.json({
    credits,
    summary: {
      users: credits.length,
      totalAllocated,
      totalRemaining,
      totalConsumed,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/admin/billing-config — Get billing config from KV
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/billing-config", adminMiddleware, async (c) => {
  const config = await getBillingConfig(c.env);
  return c.json(config);
});

// ---------------------------------------------------------------------------
// PUT /api/admin/billing-config — Save billing config to KV
// ---------------------------------------------------------------------------

adminRoutes.put("/api/admin/billing-config", adminMiddleware, async (c) => {
  const body = await c.req.json();
  await c.env.METADATA.put("billing_config", JSON.stringify(body));
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// POST /api/admin/promo-codes — Create a promo/invitation code
// ---------------------------------------------------------------------------

adminRoutes.post("/api/admin/promo-codes", adminMiddleware, async (c) => {
  const body = await c.req.json<{
    code?: string;
    credits: number;
    maxUses?: number;
    expiresAt?: string;
    label?: string;
  }>();

  if (!body.credits || body.credits < 1) {
    return c.json({ error: "credits must be >= 1" }, 400);
  }

  // Auto-generate a 6-char code if not provided
  const code = (body.code || generateCode()).trim().toUpperCase();
  const kvKey = `promo:${code}`;

  const existing = await c.env.METADATA.get(kvKey);
  if (existing) {
    return c.json({ error: `Code "${code}" already exists` }, 409);
  }

  const promo = {
    credits: body.credits,
    maxUses: body.maxUses ?? 1,
    usedBy: [] as string[],
    createdAt: new Date().toISOString(),
    expiresAt: body.expiresAt || undefined,
    label: body.label || undefined,
  };

  await c.env.METADATA.put(kvKey, JSON.stringify(promo));
  console.log(`[admin] Created promo code "${code}" — ${promo.credits} credits, max ${promo.maxUses} uses`);

  return c.json({ code, ...promo });
});

// ---------------------------------------------------------------------------
// GET /api/admin/promo-codes — List all promo codes
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/promo-codes", adminMiddleware, async (c) => {
  const list = await c.env.METADATA.list({ prefix: "promo:" });
  const codes: Array<{ code: string; credits: number; maxUses: number; used: number; createdAt: string; expiresAt?: string; label?: string }> = [];

  for (const key of list.keys) {
    const promo = await c.env.METADATA.get<{ credits: number; maxUses: number; usedBy: string[]; createdAt: string; expiresAt?: string; label?: string }>(key.name, "json");
    if (promo) {
      codes.push({
        code: key.name.replace("promo:", ""),
        credits: promo.credits,
        maxUses: promo.maxUses,
        used: promo.usedBy.length,
        createdAt: promo.createdAt,
        expiresAt: promo.expiresAt,
        label: promo.label,
      });
    }
  }

  return c.json({ codes });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/promo-codes/:code — Delete a promo code
// ---------------------------------------------------------------------------

adminRoutes.delete("/api/admin/promo-codes/:code", adminMiddleware, async (c) => {
  const code = c.req.param("code").toUpperCase();
  await c.env.METADATA.delete(`promo:${code}`);
  return c.json({ ok: true, deleted: code });
});

// ---------------------------------------------------------------------------
// POST /api/admin/invites — Create invite, store code, send email
// ---------------------------------------------------------------------------

interface InviteRecord {
  email: string;
  code: string;
  credits: number;
  sentAt: string;
  sentBy: string;
  redeemed: boolean;
  message?: string;
}

adminRoutes.post("/api/admin/invites", adminMiddleware, async (c) => {
  const body = await c.req.json<{
    email: string;
    credits: number;
    message?: string;
  }>();

  if (!body.email || !body.email.includes("@")) {
    return c.json({ error: "A valid email address is required" }, 400);
  }
  if (!body.credits || body.credits < 1) {
    return c.json({ error: "credits must be >= 1" }, 400);
  }

  const code = generateCode();
  const kvKey = `promo:${code}`;

  const promo = {
    credits: body.credits,
    maxUses: 1,
    usedBy: [] as string[],
    createdAt: new Date().toISOString(),
    label: `Invite for ${body.email}`,
  };

  await c.env.METADATA.put(kvKey, JSON.stringify(promo));

  const invite: InviteRecord = {
    email: body.email,
    code,
    credits: body.credits,
    sentAt: new Date().toISOString(),
    sentBy: c.var.userId,
    redeemed: false,
    message: body.message,
  };

  const existingInvites = await c.env.METADATA.get<InviteRecord[]>("admin_invites", "json") ?? [];
  existingInvites.unshift(invite);
  await c.env.METADATA.put("admin_invites", JSON.stringify(existingInvites));

  const resendKey = c.env.RESEND_API_KEY;
  const fromEmail = c.env.PLATFORM_EMAIL_FROM || "WebAGT <noreply@webagt.ai>";
  let emailSent = false;
  let emailError: string | undefined;

  if (resendKey) {
    try {
      const frontendUrl = c.env.FRONTEND_URL || "https://www.webagt.ai";
      const html = buildInviteEmailHtml({
        code,
        credits: body.credits,
        signupUrl: `${frontendUrl}/sign-up`,
        message: body.message,
      });

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: body.email,
          subject: `You've been invited to WebAGT — ${body.credits} free credits inside`,
          html,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        emailError = `Resend ${res.status}: ${errText}`;
        console.error(`[admin/invite] Email failed:`, emailError);
      } else {
        emailSent = true;
      }
    } catch (err: any) {
      emailError = err.message;
      console.error(`[admin/invite] Email error:`, err);
    }
  } else {
    emailError = "RESEND_API_KEY not configured";
  }

  console.log(`[admin] Invite sent to ${body.email} — code: ${code}, ${body.credits} credits, emailSent: ${emailSent}`);

  return c.json({ code, credits: body.credits, email: body.email, emailSent, emailError });
});

// ---------------------------------------------------------------------------
// GET /api/admin/invites — List all sent invitations
// ---------------------------------------------------------------------------

adminRoutes.get("/api/admin/invites", adminMiddleware, async (c) => {
  const invites = await c.env.METADATA.get<InviteRecord[]>("admin_invites", "json") ?? [];

  for (const inv of invites) {
    const promo = await c.env.METADATA.get<{ usedBy: string[] }>(`promo:${inv.code}`, "json");
    inv.redeemed = (promo?.usedBy?.length ?? 0) > 0;
  }

  return c.json({ invites });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function buildInviteEmailHtml(opts: {
  code: string;
  credits: number;
  signupUrl: string;
  message?: string;
}): string {
  const { code, credits, signupUrl, message } = opts;

  const messageBlock = message
    ? `<p style="margin:0 0 24px;font-size:14px;color:#999999;line-height:1.7;font-style:italic;border-left:3px solid #333;padding-left:16px;">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#050505;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:48px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0a0a0a;border-radius:16px;border:1px solid #1a1a1a;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:36px 40px 28px;border-bottom:1px solid #1a1a1a;">
              <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">WebAGT</span>
            </td>
          </tr>
          <!-- Hero -->
          <tr>
            <td style="padding:40px 40px 0;">
              <h1 style="margin:0 0 8px;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;letter-spacing:-0.5px;">
                You're invited
              </h1>
              <p style="margin:0 0 28px;font-size:16px;color:#888888;line-height:1.6;">
                Someone thinks you'd love building with AI. Here are <strong style="color:#ffffff;">${credits} free credits</strong> to get started.
              </p>
              ${messageBlock}
            </td>
          </tr>
          <!-- Code card -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px;border:1px solid #222;">
                <tr>
                  <td style="padding:28px 32px;text-align:center;">
                    <p style="margin:0 0 8px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:3px;font-weight:600;">Your invite code</p>
                    <p style="margin:0;font-size:36px;font-weight:800;color:#ffffff;letter-spacing:6px;font-family:'Courier New',monospace;">${code}</p>
                    <p style="margin:12px 0 0;font-size:13px;color:#555;">Worth <strong style="color:#60a5fa;">${credits} credits</strong> — enter it after signing up</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CTA -->
          <tr>
            <td style="padding:0 40px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:10px;background:linear-gradient(135deg,#2563eb,#0ea5e9);">
                          <a href="${signupUrl}" style="display:inline-block;padding:16px 40px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
                            Create Your Account
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <p style="margin:20px 0 0;font-size:13px;color:#555;text-align:center;line-height:1.6;">
                Sign up, then enter the code <strong style="color:#aaa;">${code}</strong> in the credits section.
              </p>
            </td>
          </tr>
          <!-- What is WebAGT -->
          <tr>
            <td style="padding:0 40px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #1a1a1a;">
                <tr>
                  <td style="padding:28px 0 0;">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:1px;">What is WebAGT?</p>
                    <p style="margin:0;font-size:14px;color:#666;line-height:1.7;">
                      An AI-powered platform that builds complete websites and webshops in minutes. Just describe what you want, and our AI creates production-ready code with live preview, one-click deployment, and built-in payments.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1a1a1a;background:#080808;">
              <p style="margin:0;font-size:11px;color:#444444;line-height:1.6;">
                You received this because someone invited you to try WebAGT. If this wasn't meant for you, feel free to ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { adminRoutes };
