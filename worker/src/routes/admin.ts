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
    checkOpenAIBalance(c.env.OPENAI_API_KEY),
    checkDeepSeekBalance(c.env.DEEPSEEK_API_KEY),
    checkGoogleBalance(c.env.GOOGLE_AI_API_KEY),
  ]);

  const [anthropic, openai, deepseek, google] = results.map((r) =>
    r.status === "fulfilled" ? r.value : { available: false, error: (r.reason as Error)?.message ?? "Unknown error" }
  );

  return c.json({ anthropic, openai, deepseek, google });
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
          note: "Remaining balance not available via API — check console",
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

async function checkOpenAIBalance(apiKey: string | undefined): Promise<ProviderBalance> {
  const base = { dashboardUrl: "https://platform.openai.com/settings/organization/billing/overview" };
  if (!apiKey) return { ...base, available: false, error: "API key not configured" };
  try {
    // Trial / prepaid balance endpoint (works for prepaid credits accounts)
    const res = await fetch("https://api.openai.com/dashboard/billing/credit_grants", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.ok) {
      const data = await res.json() as {
        total_granted?: number;
        total_used?: number;
        total_available?: number;
      };
      const available = data.total_available;
      return {
        ...base,
        available: true,
        balance: available !== undefined ? `$${available.toFixed(2)}` : "Check console",
        extra: {
          granted: data.total_granted,
          used: data.total_used,
          remaining: data.total_available,
        },
      };
    }
    // For pay-as-you-go accounts this endpoint returns 404 — key is still valid
    if (res.status === 404) {
      return { ...base, available: true, balance: "Pay-as-you-go (check console)" };
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

async function checkGoogleBalance(apiKey: string | undefined): Promise<ProviderBalance> {
  const base = { dashboardUrl: "https://console.cloud.google.com/billing" };
  if (!apiKey) return { ...base, available: false, error: "API key not configured" };
  // Google AI Studio / Gemini has no REST balance endpoint.
  // Validate the key by calling the models list.
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}&pageSize=1`
    );
    if (res.ok) return { ...base, available: true, balance: "Check Google Cloud console" };
    const body = await res.json() as { error?: { message?: string } };
    return { ...base, available: false, error: body.error?.message ?? `HTTP ${res.status}` };
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

export { adminRoutes };
