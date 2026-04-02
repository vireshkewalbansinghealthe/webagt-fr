/**
 * worker/src/routes/credits.ts
 *
 * API endpoint for retrieving the authenticated user's credit balance.
 * The frontend uses this to display the credit counter in the sidebar
 * and to determine whether the chat input should be disabled.
 *
 * Endpoints:
 * - GET /api/credits — Return the user's current credit balance and plan
 *
 * Credits are managed by the credits service (worker/src/services/credits.ts)
 * and stored in KV as `credits:{userId}`.
 *
 * Used by: worker/src/index.ts (mounted at /api/credits)
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { getCredits } from "../services/credits";

/**
 * Create a Hono router for credit endpoints.
 * Auth middleware is applied by the parent app in index.ts.
 */
const creditRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// GET /api/credits — Get the user's current credit balance
// ---------------------------------------------------------------------------

/**
 * Returns the authenticated user's credit balance, plan, and period info.
 * Triggers lazy period reset if the billing period has expired.
 *
 * Response shape:
 * {
 *   remaining: number,   // -1 means unlimited (Pro)
 *   total: number,       // 50 for free tier
 *   plan: "free" | "pro",
 *   periodEnd: string,   // ISO 8601 — when credits reset
 *   isUnlimited: boolean // convenience flag for the frontend
 * }
 */
creditRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const credits = await getCredits(userId, c.env);

  return c.json({
    remaining: credits.remaining,
    total: credits.total,
    plan: credits.plan,
    periodEnd: credits.periodEnd,
    isUnlimited: false,
  });
});

/**
 * POST /api/credits/sync
 *
 * Called immediately after Clerk's onSubscriptionComplete fires in the UI.
 * Because Clerk only fires that callback on a real successful payment,
 * we can unconditionally upgrade the authenticated user to Pro here —
 * no secondary verification needed.
 */
creditRoutes.post("/sync", async (c) => {
  const userId = c.var.userId;

  try {
    const { upgradePlan } = await import("../services/credits");
    const credits = await upgradePlan(userId, c.env);
    return c.json({ synced: true, upgraded: true, credits });
  } catch (err: any) {
    console.error("[credits/sync] Error:", err);
    const credits = await getCredits(userId, c.env);
    return c.json({ synced: false, error: err.message, credits });
  }
});

/**
 * GET /api/credits/onboarding — Check if the user has seen the onboarding modal.
 * Returns { seen: boolean } read from KV so it's the same across all devices.
 */
creditRoutes.get("/onboarding", async (c) => {
  const userId = c.var.userId;
  const seen = await c.env.METADATA.get(`onboarding_seen:${userId}`);
  return c.json({ seen: seen === "1" });
});

/**
 * POST /api/credits/onboarding — Mark the onboarding modal as seen.
 * Stored in KV so it persists across devices and browsers.
 */
creditRoutes.post("/onboarding", async (c) => {
  const userId = c.var.userId;
  await c.env.METADATA.put(`onboarding_seen:${userId}`, "1");
  return c.json({ ok: true });
});

/**
 * DEBUG: Force upgrade a specific user to Pro.
 */
creditRoutes.get("/debug-upgrade", async (c) => {
  const userId = c.var.userId;
  const { upgradePlan } = await import("../services/credits");
  const upgraded = await upgradePlan(userId, c.env);
  return c.json({ success: true, upgraded });
});

export { creditRoutes };
