/**
 * worker/src/routes/analytics.ts
 *
 * Hono router for the usage analytics endpoint.
 * Aggregates data from existing KV/R2 stores to build a complete
 * picture of the user's usage: generation counts, model breakdown,
 * per-project stats, and recent activity.
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { computeUserAnalytics } from "../services/analytics-engine";

/**
 * Create a Hono router with typed bindings and variables.
 * Auth middleware sets `c.var.userId` before these handlers run.
 */
const analyticsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// GET /api/analytics — Aggregated usage analytics
// ---------------------------------------------------------------------------

/**
 * Returns aggregated analytics data for the authenticated user.
 * Delegates to the shared computeUserAnalytics service.
 *
 * Response shape matches the AnalyticsData interface in types/analytics.ts.
 */
analyticsRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const analytics = await computeUserAnalytics(userId, c.env);
  return c.json(analytics);
});

export { analyticsRoutes };
