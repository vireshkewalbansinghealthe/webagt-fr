/**
 * worker/src/routes/billing.ts
 *
 * Native Stripe subscription billing endpoints.
 * Replaces Clerk Billing — supports iDEAL, SEPA Debit, card, etc.
 *
 * Endpoints (all require auth):
 * - POST /api/billing/checkout — Create a Stripe Checkout Session and return the URL
 * - POST /api/billing/portal  — Create a Stripe Customer Portal session and return the URL
 * - POST /api/billing/plan-change — Internal plan change (kept for backwards compat)
 *
 * Webhook (public, no auth):
 * - POST /webhooks/stripe-billing — Handled in worker/src/routes/webhooks.ts
 *
 * Flow:
 * 1. Frontend calls POST /api/billing/checkout
 * 2. Worker creates a Stripe Checkout Session (subscription mode, iDEAL enabled)
 * 3. Worker returns { url } — frontend redirects user to Stripe-hosted checkout
 * 4. After payment, Stripe sends webhook to /webhooks/stripe-billing
 * 5. Worker upgrades plan in KV via upgradePlan()
 * 6. Frontend polls /api/credits until plan === "pro"
 */

import { Hono } from "hono";
import Stripe from "stripe";
import type { Env, AppVariables } from "../types";
import { upgradePlan, downgradePlan, getCredits } from "../services/credits";

const billingRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** KV key for persisting a user's Stripe customer ID. */
const customerKey = (userId: string) => `stripe_customer:${userId}`;

/**
 * Get or create a Stripe Customer for the given Clerk user.
 * Stores the customer ID in KV so future checkouts reuse it,
 * which means Stripe knows the user's payment history.
 */
async function getOrCreateStripeCustomer(
  stripe: Stripe,
  userId: string,
  email: string | undefined,
  env: Env
): Promise<string> {
  const existing = await env.METADATA.get(customerKey(userId));
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email,
    metadata: { clerk_user_id: userId },
  });

  await env.METADATA.put(customerKey(userId), customer.id);
  return customer.id;
}

// ---------------------------------------------------------------------------
// POST /api/billing/checkout — Create Stripe Checkout Session
// ---------------------------------------------------------------------------

billingRoutes.post("/checkout", async (c) => {
  const userId = c.var.userId;
  const env = c.env;

  const priceId = env.STRIPE_BILLING_PRICE_ID;
  const secretKey = env.STRIPE_SECRET_KEY_LIVE || env.STRIPE_SECRET_KEY;

  if (!priceId || !secretKey) {
    return c.json(
      { error: "Stripe billing is not configured on this server.", code: "CONFIG_ERROR" },
      503
    );
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });
  const frontendUrl = env.FRONTEND_URL || "https://www.webagt.ai";

  // Optional: email passed from frontend to pre-fill Stripe checkout
  const body = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
  const customerId = await getOrCreateStripeCustomer(stripe, userId, body.email, env);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    payment_method_types: ["card", "ideal", "sepa_debit"],
    metadata: { clerk_user_id: userId },
    subscription_data: {
      metadata: { clerk_user_id: userId },
    },
    success_url: `${frontendUrl}/dashboard?billing=success`,
    cancel_url: `${frontendUrl}/pricing`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    locale: "nl",
  });

  return c.json({ url: session.url });
});

// ---------------------------------------------------------------------------
// POST /api/billing/portal — Create Stripe Customer Portal session
// ---------------------------------------------------------------------------

billingRoutes.post("/portal", async (c) => {
  const userId = c.var.userId;
  const env = c.env;

  const secretKey = env.STRIPE_SECRET_KEY_LIVE || env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return c.json({ error: "Stripe is not configured.", code: "CONFIG_ERROR" }, 503);
  }

  const stripeCustomerId = await env.METADATA.get(customerKey(userId));
  if (!stripeCustomerId) {
    return c.json(
      { error: "No active subscription found.", code: "NO_SUBSCRIPTION" },
      404
    );
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });
  const frontendUrl = env.FRONTEND_URL || "https://www.webagt.ai";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${frontendUrl}/settings`,
  });

  return c.json({ url: portalSession.url });
});

// ---------------------------------------------------------------------------
// POST /api/billing/plan-change — Internal plan change (backwards compat)
// ---------------------------------------------------------------------------

billingRoutes.post("/plan-change", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{ action: "upgrade" | "downgrade" }>();

  if (!body.action || !["upgrade", "downgrade"].includes(body.action)) {
    return c.json(
      { error: "Invalid action. Must be 'upgrade' or 'downgrade'.", code: "VALIDATION_ERROR" },
      400
    );
  }

  const credits =
    body.action === "upgrade"
      ? await upgradePlan(userId, c.env)
      : await downgradePlan(userId, c.env);

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
