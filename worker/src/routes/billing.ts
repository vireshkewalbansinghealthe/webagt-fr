/**
 * worker/src/routes/billing.ts
 *
 * Internal API endpoint for handling plan changes from billing webhooks.
 * This endpoint is called by the Next.js webhook handler
 * (app/api/webhooks/clerk-billing/route.ts) after verifying the
 * webhook signature.
 *
 * Endpoints:
 * - POST /api/billing/plan-change — Update a user's plan and credits
 *
 * Security: Protected by auth middleware (JWT required).
 * In production, this would use a separate internal API key.
 * For this tutorial, the webhook handler authenticates via Clerk.
 *
 * Used by: worker/src/index.ts (mounted at /api/billing)
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { upgradePlan, downgradePlan, getCredits } from "../services/credits";

/**
 * Create a Hono router for billing endpoints.
 * Auth middleware is applied by the parent app in index.ts.
 */
const billingRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// POST /api/billing/plan-change — Update user plan
// ---------------------------------------------------------------------------

/**
 * Handles plan upgrade/downgrade requests.
 * Called internally after the billing webhook verifies the event.
 *
 * Request body: { action: "upgrade" | "downgrade" }
 * Response: Updated credit record
 */
billingRoutes.post("/plan-change", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{ action: "upgrade" | "downgrade" }>();

  if (!body.action || !["upgrade", "downgrade"].includes(body.action)) {
    return c.json(
      { error: "Invalid action. Must be 'upgrade' or 'downgrade'.", code: "VALIDATION_ERROR" },
      400
    );
  }

  let credits;

  if (body.action === "upgrade") {
    credits = await upgradePlan(userId, c.env);
  } else {
    credits = await downgradePlan(userId, c.env);
  }

  return c.json({
    success: true,
    credits: {
      remaining: credits.remaining,
      total: credits.total,
      plan: credits.plan,
      periodEnd: credits.periodEnd,
      isUnlimited: credits.remaining === -1,
    },
  });
});

export { billingRoutes };
