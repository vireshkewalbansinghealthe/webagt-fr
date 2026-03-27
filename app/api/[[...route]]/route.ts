/**
 * app/api/[[...route]]/route.ts
 *
 * Vercel entry point for the Hono worker backend.
 * Catches all /api/* requests and delegates them to the Hono app,
 * using Upstash Redis adapters instead of Cloudflare KV/R2 bindings.
 *
 * Environment variables required (add to Vercel project settings):
 *   KV_REST_API_URL         — Upstash Redis REST URL (from Vercel KV or Upstash)
 *   KV_REST_API_TOKEN       — Upstash Redis REST token
 *   CLERK_ISSUER            — Clerk JWT issuer URL
 *   CLERK_JWKS_URL          — Clerk JWKS endpoint
 *   CLERK_WEBHOOK_SECRET    — Svix signing secret for Clerk billing webhooks
 *   ANTHROPIC_API_KEY       — Anthropic Claude API key
 *   OPENAI_API_KEY          — OpenAI API key
 *   GOOGLE_AI_API_KEY       — Google Gemini API key
 *   DEEPSEEK_API_KEY        — DeepSeek API key
 *   FRONTEND_URL            — Production frontend URL (e.g. https://yourapp.vercel.app)
 *   PUBLIC_WORKER_URL       — Same as FRONTEND_URL/api (e.g. https://yourapp.vercel.app)
 *   TURSO_API_TOKEN         — (optional) Turso API token
 *   TURSO_API_URL           — (optional) Turso API URL
 *   TURSO_ORG_SLUG          — (optional) Turso organisation slug
 *   STRIPE_SECRET_KEY       — (optional) Stripe secret key
 *   RESEND_API_KEY          — (optional) Resend API key
 *
 * Used by: Vercel serverless runtime (Next.js App Router catch-all)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { Redis } from "@upstash/redis";
import { RedisKVAdapter } from "../../../worker/src/adapters/kv-redis";
import { RedisR2Adapter } from "../../../worker/src/adapters/r2-redis";
import { authMiddleware } from "../../../worker/src/middleware/auth";
import { rateLimitMiddleware } from "../../../worker/src/middleware/rate-limit";
import { projectRoutes } from "../../../worker/src/routes/projects";
import { chatRoutes } from "../../../worker/src/routes/chat";
import { versionRoutes } from "../../../worker/src/routes/versions";
import { creditRoutes } from "../../../worker/src/routes/credits";
import { billingRoutes } from "../../../worker/src/routes/billing";
import { exportRoutes } from "../../../worker/src/routes/export";
import { analyticsRoutes } from "../../../worker/src/routes/analytics";
import { webhookRoutes } from "../../../worker/src/routes/webhooks";
import { stripeRoutes } from "../../../worker/src/routes/stripe";
import type { Env, AppVariables } from "../../../worker/src/types";

// ---------------------------------------------------------------------------
// Initialise Redis adapters once at module level (reused across requests)
// ---------------------------------------------------------------------------

const redis = new Redis({
  url: process.env.KV_REST_API_URL ?? "",
  token: process.env.KV_REST_API_TOKEN ?? "",
});

const kvAdapter = new RedisKVAdapter(redis);
const r2Adapter = new RedisR2Adapter(redis);

// ---------------------------------------------------------------------------
// Build the Hono app
// ---------------------------------------------------------------------------

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * Inject Vercel environment variables into the Hono context as bindings.
 * This replaces the Cloudflare runtime's automatic binding injection.
 */
app.use("*", async (c, next) => {
  const env = c.env as unknown as Record<string, unknown>;
  env.METADATA = kvAdapter;
  env.FILES = r2Adapter;
  env.CLERK_ISSUER = process.env.CLERK_ISSUER ?? "";
  env.CLERK_JWKS_URL = process.env.CLERK_JWKS_URL ?? "";
  env.CLERK_WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET ?? "";
  env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";
  env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
  env.GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? "";
  env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY ?? "";
  env.TURSO_API_TOKEN = process.env.TURSO_API_TOKEN ?? "";
  env.TURSO_API_URL = process.env.TURSO_API_URL ?? "";
  env.TURSO_ORG_SLUG = process.env.TURSO_ORG_SLUG ?? "";
  env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
  env.STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
  env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  env.STRIPE_SECRET_KEY_TEST = process.env.STRIPE_SECRET_KEY_TEST ?? "";
  env.STRIPE_PUBLISHABLE_KEY_TEST = process.env.STRIPE_PUBLISHABLE_KEY_TEST ?? "";
  env.STRIPE_WEBHOOK_SECRET_TEST = process.env.STRIPE_WEBHOOK_SECRET_TEST ?? "";
  env.STRIPE_SECRET_KEY_LIVE = process.env.STRIPE_SECRET_KEY_LIVE ?? "";
  env.STRIPE_PUBLISHABLE_KEY_LIVE = process.env.STRIPE_PUBLISHABLE_KEY_LIVE ?? "";
  env.STRIPE_WEBHOOK_SECRET_LIVE = process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? "";
  env.STRIPE_CLIENT_ID = process.env.STRIPE_CLIENT_ID ?? "";
  env.PLATFORM_COMMISSION_PERCENT = process.env.PLATFORM_COMMISSION_PERCENT ?? "";
  env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
  env.PLATFORM_EMAIL_FROM = process.env.PLATFORM_EMAIL_FROM ?? "";
  env.PLATFORM_REPLY_TO_FALLBACK = process.env.PLATFORM_REPLY_TO_FALLBACK ?? "";
  env.FRONTEND_URL = process.env.FRONTEND_URL ?? process.env.NEXT_PUBLIC_WORKER_URL ?? "";
  env.PUBLIC_WORKER_URL = process.env.PUBLIC_WORKER_URL ?? process.env.NEXT_PUBLIC_WORKER_URL ?? "";
  env.COOLIFY_API_KEY = process.env.COOLIFY_API_KEY ?? "";
  env.COOLIFY_URL = process.env.COOLIFY_URL ?? "";
  env.DEPLOYMENT_GITHUB_TOKEN = process.env.DEPLOYMENT_GITHUB_TOKEN ?? "";
  env.DEPLOYMENT_REPO = process.env.DEPLOYMENT_REPO ?? "";
  return next();
});

/**
 * CORS — mirrors the logic in worker/src/index.ts.
 */
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const frontendUrl = c.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const allowedOrigins = [frontendUrl, "http://localhost:3000"];
  let actualOrigin = allowedOrigins.includes(origin ?? "") ? origin : undefined;

  if (
    origin &&
    (origin.endsWith(".csb.app") ||
      origin.endsWith(".codesandbox.io") ||
      origin.endsWith(".dock.4esh.nl"))
  ) {
    actualOrigin = origin;
  }

  const middleware = cors({
    origin: actualOrigin || frontendUrl,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
    credentials: true,
  });
  return middleware(c, next);
});

// ---------------------------------------------------------------------------
// Public routes (no auth)
// ---------------------------------------------------------------------------

app.get("/api/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() })
);

/**
 * Clerk Billing webhook — accessible at /api/webhooks/clerk-billing
 * (Cloudflare worker exposes this at /webhooks/clerk-billing — configure
 *  your Clerk dashboard to use the /api/webhooks/clerk-billing URL for Vercel).
 */
app.route("/api/webhooks/clerk-billing", webhookRoutes);

// ---------------------------------------------------------------------------
// Protected routes — require valid Clerk JWT
// ---------------------------------------------------------------------------

app.use("/api/*", async (c, next) => {
  if (
    c.req.path === "/api/stripe/checkout_sessions" ||
    c.req.path === "/api/stripe/webhook" ||
    c.req.path.match(/\/api\/projects\/.*\/public-files/)
  ) {
    return next();
  }
  return authMiddleware(c, next);
});

app.use("/api/*", rateLimitMiddleware);

app.route("/api/projects", projectRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/projects/:id/versions", versionRoutes);
app.route("/api/credits", creditRoutes);
app.route("/api/billing", billingRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/projects/:id/export", exportRoutes);
app.route("/api/stripe", stripeRoutes);

// ---------------------------------------------------------------------------
// Next.js App Router handler exports
// ---------------------------------------------------------------------------

async function handler(request: Request): Promise<Response> {
  return app.fetch(request);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;

// Increase Vercel Function max duration (requires Pro plan for >10s)
export const maxDuration = 300;
