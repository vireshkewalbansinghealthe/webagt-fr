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
  
  // FORCE UPGRADE for viresh@flexy.nl
  if (userId === "user_3BJSQjGBOOdBT2WKyMz0tAFruoh") {
    const { upgradePlan } = await import("../services/credits");
    await upgradePlan(userId, c.env);
  }

  const credits = await getCredits(userId, c.env);

  return c.json({
    remaining: credits.remaining,
    total: credits.total,
    plan: credits.plan,
    periodEnd: credits.periodEnd,
    isUnlimited: credits.remaining === -1,
  });
});

/**
 * POST /api/credits/sync
 *
 * Syncs the user's plan from Clerk's subscription API directly.
 * Called by the frontend after the user completes checkout so they don't
 * have to wait for the webhook — gives instant plan update.
 *
 * Flow:
 * 1. Call Clerk API to get the user's active subscriptions
 * 2. If a "pro" subscription is active → upgradePlan in KV
 * 3. Return updated credits
 */
creditRoutes.post("/sync", async (c) => {
  const userId = c.var.userId;
  const secretKey = c.env.CLERK_SECRET_KEY;

  if (!secretKey) {
    // Clerk API not available — return current credits as-is
    const credits = await getCredits(userId, c.env);
    return c.json({ synced: false, credits });
  }

  try {
    // Fetch user from Clerk API to check their subscription status
    const clerkRes = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    );

    if (!clerkRes.ok) {
      const credits = await getCredits(userId, c.env);
      return c.json({ synced: false, credits });
    }

    const clerkUser: any = await clerkRes.json();

    // Clerk stores active subscription info in public_metadata or via billing API
    // Check public_metadata.plan first (set by billing webhook)
    const metaPlan = clerkUser.public_metadata?.plan as string | undefined;

    // Also fetch subscriptions from Clerk billing API
    const subsRes = await fetch(
      `https://api.clerk.com/v1/users/${userId}/subscription_items`,
      { headers: { Authorization: `Bearer ${secretKey}` } }
    ).catch(() => null);

    let hasActivePro = metaPlan === "pro";

    if (subsRes?.ok) {
      const subsData: any = await subsRes.json();
      const items: any[] = Array.isArray(subsData)
        ? subsData
        : subsData?.data || subsData?.subscription_items || [];

      hasActivePro =
        hasActivePro ||
        items.some(
          (item: any) =>
            item.status === "active" &&
            (item.plan?.slug === "pro" ||
              item.plan?.name?.toLowerCase().includes("pro"))
        );
    }

    const { upgradePlan } = await import("../services/credits");
    const currentCredits = await getCredits(userId, c.env);

    if (hasActivePro && currentCredits.plan !== "pro") {
      const upgraded = await upgradePlan(userId, c.env);
      return c.json({ synced: true, upgraded: true, credits: upgraded });
    }

    return c.json({ synced: true, upgraded: false, credits: currentCredits });
  } catch (err: any) {
    console.error("[credits/sync] Error:", err);
    const credits = await getCredits(userId, c.env);
    return c.json({ synced: false, error: err.message, credits });
  }
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
