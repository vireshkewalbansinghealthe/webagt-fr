/**
 * worker/src/index.ts
 *
 * Main entry point for the Cloudflare Worker backend.
 * Sets up the Hono web framework with:
 *
 * 1. CORS middleware — allows requests from the Next.js frontend
 * 2. Health check endpoint — GET /health (public, no auth required)
 * 3. Auth middleware — protects all /api/* routes with Clerk JWT verification
 * 4. Project routes — full CRUD for project management
 *
 * The Worker handles all backend logic: project CRUD, AI code generation,
 * file storage, versioning, and credit management.
 *
 * Used by: Cloudflare Workers runtime (entry point defined in wrangler.jsonc)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, AppVariables } from "./types";
import { authMiddleware } from "./middleware/auth";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { projectRoutes } from "./routes/projects";
import { chatRoutes } from "./routes/chat";
import { versionRoutes } from "./routes/versions";
import { creditRoutes } from "./routes/credits";
import { billingRoutes } from "./routes/billing";
import { exportRoutes } from "./routes/export";
import { analyticsRoutes } from "./routes/analytics";
import { webhookRoutes } from "./routes/webhooks";
import { stripeBillingWebhookRoutes } from "./routes/stripe-billing-webhook";
import { stripeRoutes } from "./routes/stripe";
import { collabRoutes } from "./routes/collaborators";
import { adminRoutes } from "./routes/admin";
import { testingRoutes } from "./routes/testing";

/**
 * Create the Hono app with typed bindings and context variables.
 *
 * - Bindings: KV, R2, and secrets from wrangler.jsonc / .dev.vars
 * - Variables: userId set by auth middleware, available in all /api/* handlers
 */
const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * CORS middleware — applied to all routes.
 * In development, allows localhost:3000. In production, reads
 * the allowed origin from the FRONTEND_URL environment variable
 * set in wrangler.jsonc or Cloudflare dashboard.
 */
app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const frontendUrl = c.env.FRONTEND_URL || "http://localhost:3000";

  const allowedOrigins = [frontendUrl, "http://localhost:3000"];

  let actualOrigin = allowedOrigins.includes(origin || "") ? origin : undefined;

  if (
    origin &&
    (origin.endsWith(".csb.app") ||
      origin.endsWith(".codesandbox.io") ||
      origin.endsWith(".dock.4esh.nl") ||
      origin.endsWith(".webagt.ai") ||
      origin === "https://www.webagt.ai" ||
      origin === "https://webagt.ai")
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
// Public routes (no auth required)
// ---------------------------------------------------------------------------

/**
 * Health check endpoint.
 * Used to verify the Worker is running and responding.
 * Returns a simple JSON object with status and current timestamp.
 */
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Clerk Billing webhook endpoint.
 * Receives subscription lifecycle events (upgrade, cancel, etc.)
 * and updates user credits in KV.
 *
 * PUBLIC — no auth middleware. Security via Svix signature verification.
 * See worker/src/routes/webhooks.ts for the handler.
 */
app.route("/webhooks/clerk-billing", webhookRoutes);

/**
 * Native Stripe subscription webhook.
 * PUBLIC — security via Stripe HMAC-SHA256 signature verification.
 * Configure in Stripe Dashboard → Developers → Webhooks.
 */
app.route("/webhooks/stripe-billing", stripeBillingWebhookRoutes);

// ---------------------------------------------------------------------------
// Protected routes (require valid Clerk JWT)
// ---------------------------------------------------------------------------

/**
 * Apply auth middleware to all /api/* routes EXCEPT checkout sessions.
 * checkout sessions are public as they are called by the generated shop.
 */
app.use("/api/*", async (c, next) => {
  if (
    c.req.path === "/api/stripe/checkout_sessions" ||
    c.req.path === "/api/stripe/webhook" ||
    c.req.path === "/api/testing/bot-run" ||
    c.req.path === "/api/testing/ensure-credits" ||
    c.req.path === "/api/testing/sign-in-token" ||
    c.req.path.match(/\/api\/projects\/.*\/public-files/) ||
    c.req.method === "GET" && c.req.path.match(/^\/api\/invites\/[^/]+$/)
  ) {
    return next();
  }
  return authMiddleware(c, next);
});

/**
 * Apply rate limiting to all /api/* routes.
 * Runs after auth so we have the userId for per-user limits.
 * Different categories (chat, export, general) have different limits.
 */
app.use("/api/*", rateLimitMiddleware);

/**
 * Mount project CRUD routes at /api/projects.
 * Handles listing, creating, reading, updating, and deleting projects.
 * See worker/src/routes/projects.ts for individual route handlers.
 */
app.route("/api/projects", projectRoutes);

/**
 * Mount chat routes at /api/chat.
 * Handles AI code generation streaming and chat history retrieval.
 * See worker/src/routes/chat.ts for individual route handlers.
 */
app.route("/api/chat", chatRoutes);

/**
 * Mount version routes nested under /api/projects/:id/versions.
 * Handles version listing, file retrieval, diffs, restores, and manual saves.
 * See worker/src/routes/versions.ts for individual route handlers.
 */
app.route("/api/projects/:id/versions", versionRoutes);

/**
 * Mount credit routes at /api/credits.
 * Handles credit balance retrieval for the authenticated user.
 * See worker/src/routes/credits.ts for individual route handlers.
 */
app.route("/api/credits", creditRoutes);

/**
 * Mount billing routes at /api/billing.
 * Handles plan changes from billing webhooks.
 * See worker/src/routes/billing.ts for individual route handlers.
 */
app.route("/api/billing", billingRoutes);

/**
 * Mount analytics route at /api/analytics.
 * Returns aggregated usage statistics for the authenticated user.
 * See worker/src/routes/analytics.ts for the handler.
 */
app.route("/api/analytics", analyticsRoutes);

/**
 * Mount export route at /api/projects/:id/export.
 * Generates and downloads a ZIP of the project as a standalone Vite app.
 * See worker/src/routes/export.ts for the handler.
 */
app.route("/api/projects/:id/export", exportRoutes);

/**
 * Mount stripe route at /api/stripe.
 * Handles Stripe Connect logic.
 * See worker/src/routes/stripe.ts for the handler.
 */
app.route("/api/stripe", stripeRoutes);

/**
 * Mount collaboration routes.
 * Handles invites, accept, remove collaborator, and list collaborators.
 * The GET /api/invites/:token endpoint is public (no auth required).
 * See worker/src/routes/collaborators.ts for the handlers.
 */
app.route("/", collabRoutes);

/**
 * Mount testing routes (Feedback & Bug reporting).
 * POST /api/testing/submit, POST /api/testing/feedback
 * POST /api/testing/bot-run (public — no auth)
 * GET /api/testing/admin/results (Admin only)
 */
app.route("/api/testing", testingRoutes);

/**
 * Mount admin routes at root (routes are prefixed /api/admin/*).
 * All handlers are gated by adminMiddleware (requires role=admin in JWT).
 * See worker/src/routes/admin.ts for individual route handlers.
 */
app.route("/", adminRoutes);

export default app;
