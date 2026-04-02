/**
 * worker/src/routes/billing.ts
 *
 * Native Stripe billing endpoints (subscription + one-time credit packs).
 *
 * Endpoints (all require auth unless noted):
 * - GET  /api/billing/config       — Return current billing config (prices) from KV
 * - POST /api/billing/checkout     — Start Stripe Checkout for Pro subscription
 * - POST /api/billing/buy-credits  — Start Stripe Checkout for a credit pack
 * - POST /api/billing/portal       — Open Stripe Customer Portal
 * - POST /api/billing/plan-change  — Internal plan change (backwards compat)
 */

import { Hono } from "hono";
import Stripe from "stripe";
import type { Env, AppVariables } from "../types";
import { upgradePlan, downgradePlan } from "../services/credits";

const billingRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditPack {
  id: string;
  credits: number;
  priceId: string;
  amount: number;   // in cents
  currency: string;
}

export interface PricingFormula {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  creditUnitCostUsd: number;
  markup: number;
}

export interface BillingConfig {
  subscription: {
    priceId: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
  };
  creditPacks: CreditPack[];
  pricingFormula: PricingFormula;
}

export const DEFAULT_PRICING_FORMULA: PricingFormula = {
  inputPricePerMillion: 3,
  outputPricePerMillion: 15,
  creditUnitCostUsd: 0.08,
  markup: 4,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const BILLING_CONFIG_KEY = "billing_config";
const customerKey = (userId: string) => `stripe_customer:${userId}`;

/** Fetch billing config from KV, filling in pricingFormula defaults if absent. */
export async function getBillingConfig(env: Env): Promise<BillingConfig | null> {
  const config = await env.METADATA.get<BillingConfig>(BILLING_CONFIG_KEY, "json");
  if (!config) return null;
  return {
    ...config,
    pricingFormula: config.pricingFormula ?? DEFAULT_PRICING_FORMULA,
  };
}

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

function getStripe(env: Env): Stripe {
  const secretKey = env.STRIPE_SECRET_KEY_LIVE || env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe secret key not configured");
  return new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });
}

// ---------------------------------------------------------------------------
// GET /api/billing/config — Public billing config (prices for frontend)
// ---------------------------------------------------------------------------

billingRoutes.get("/config", async (c) => {
  const config = await getBillingConfig(c.env);
  if (!config) {
    return c.json({ error: "Billing config not found", code: "CONFIG_ERROR" }, 404);
  }
  return c.json(config);
});

// ---------------------------------------------------------------------------
// POST /api/billing/checkout — Create Stripe Checkout for Pro subscription
// ---------------------------------------------------------------------------

billingRoutes.post("/checkout", async (c) => {
  const userId = c.var.userId;
  const env = c.env;

  const config = await getBillingConfig(env);
  const priceId = config?.subscription?.priceId || env.STRIPE_BILLING_PRICE_ID;

  if (!priceId) {
    return c.json({ error: "Stripe billing is not configured.", code: "CONFIG_ERROR" }, 503);
  }

  const stripe = getStripe(env);
  const frontendUrl = env.FRONTEND_URL || "https://www.webagt.ai";
  const body = await c.req.json<{ email?: string }>().catch(() => ({} as { email?: string }));
  const customerId = await getOrCreateStripeCustomer(stripe, userId, body.email, env);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    payment_method_types: ["card", "ideal", "sepa_debit"],
    metadata: { clerk_user_id: userId, type: "subscription" },
    subscription_data: { metadata: { clerk_user_id: userId } },
    success_url: `${frontendUrl}/dashboard?billing=success`,
    cancel_url: `${frontendUrl}/pricing`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    locale: "nl",
  });

  return c.json({ url: session.url });
});

// ---------------------------------------------------------------------------
// POST /api/billing/buy-credits — Create Stripe Checkout for credit pack
// ---------------------------------------------------------------------------

billingRoutes.post("/buy-credits", async (c) => {
  const userId = c.var.userId;
  const env = c.env;

  const body = await c.req.json<{ packId: string; email?: string }>().catch(() => ({} as any));
  if (!body.packId) {
    return c.json({ error: "packId is required", code: "VALIDATION_ERROR" }, 400);
  }

  const config = await getBillingConfig(env);
  const pack = config?.creditPacks?.find((p) => p.id === body.packId);
  if (!pack) {
    return c.json({ error: "Credit pack not found", code: "NOT_FOUND" }, 404);
  }

  const stripe = getStripe(env);
  const frontendUrl = env.FRONTEND_URL || "https://www.webagt.ai";
  const customerId = await getOrCreateStripeCustomer(stripe, userId, body.email, env);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{ price: pack.priceId, quantity: 1 }],
    payment_method_types: ["card", "ideal", "sepa_debit"],
    metadata: {
      clerk_user_id: userId,
      type: "credit_pack",
      pack_id: pack.id,
      credits: String(pack.credits),
    },
    success_url: `${frontendUrl}/dashboard?credits=success&pack=${pack.id}`,
    cancel_url: `${frontendUrl}/pricing`,
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

  const stripeCustomerId = await env.METADATA.get(customerKey(userId));
  if (!stripeCustomerId) {
    return c.json({ error: "No active subscription found.", code: "NO_SUBSCRIPTION" }, 404);
  }

  const stripe = getStripe(env);
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
    return c.json({ error: "Invalid action.", code: "VALIDATION_ERROR" }, 400);
  }

  const credits =
    body.action === "upgrade"
      ? await upgradePlan(userId, c.env)
      : await downgradePlan(userId, c.env);

  return c.json({ success: true, credits });
});

export { billingRoutes };
