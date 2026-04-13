/**
 * worker/src/routes/billing.ts
 *
 * Stripe billing endpoints for one-time credit packs.
 *
 * Endpoints (all require auth):
 * - GET  /api/billing/config       — Return credit packs + pricing info
 * - POST /api/billing/buy-credits  — Start Stripe Checkout for a credit pack
 * - POST /api/billing/portal       — Open Stripe Customer Portal
 */

import { Hono } from "hono";
import Stripe from "stripe";
import type { Env, AppVariables } from "../types";

const billingRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreditPack {
  id: string;
  credits: number;
  priceUsd: number;
  priceCents: number;
  label: string;
  popular?: boolean;
}

export interface PricingFormula {
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  creditUnitCostUsd: number;
  markup: number;
}

export interface BillingConfig {
  creditPacks: CreditPack[];
  pricingFormula: PricingFormula;
}

export const DEFAULT_PRICING_FORMULA: PricingFormula = {
  inputPricePerMillion: 3,
  outputPricePerMillion: 15,
  creditUnitCostUsd: 0.06,
  markup: 1,
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "starter",  credits: 100,  priceUsd: 4.99,  priceCents: 499,  label: "Starter" },
  { id: "popular",  credits: 500,  priceUsd: 19.99, priceCents: 1999, label: "Popular",  popular: true },
  { id: "pro",      credits: 1500, priceUsd: 49.99, priceCents: 4999, label: "Pro" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const BILLING_CONFIG_KEY = "billing_config";
const customerKey = (userId: string) => `stripe_customer:${userId}`;

export async function getBillingConfig(env: Env): Promise<BillingConfig> {
  const stored = await env.METADATA.get<BillingConfig>(BILLING_CONFIG_KEY, "json");
  return {
    creditPacks: stored?.creditPacks ?? CREDIT_PACKS,
    pricingFormula: stored?.pricingFormula ?? DEFAULT_PRICING_FORMULA,
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
// GET /api/billing/config — Public billing config (credit packs for frontend)
// ---------------------------------------------------------------------------

billingRoutes.get("/config", async (c) => {
  const config = await getBillingConfig(c.env);
  return c.json(config);
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
  const pack = config.creditPacks.find((p) => p.id === body.packId);
  if (!pack) {
    return c.json({ error: "Credit pack not found", code: "NOT_FOUND" }, 404);
  }

  const stripe = getStripe(env);
  const frontendUrl = env.FRONTEND_URL || "https://www.webagt.ai";
  const customerId = await getOrCreateStripeCustomer(stripe, userId, body.email, env);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: pack.priceCents,
        product_data: {
          name: `${pack.label} — ${pack.credits} Credits`,
          description: `${pack.credits} AI generation credits for WebAGT`,
        },
      },
      quantity: 1,
    }],
    payment_method_types: ["card", "ideal"],
    metadata: {
      clerk_user_id: userId,
      type: "credit_pack",
      pack_id: pack.id,
      credits: String(pack.credits),
    },
    success_url: `${frontendUrl}/dashboard?credits=success&pack=${pack.id}`,
    cancel_url: `${frontendUrl}/dashboard`,
    locale: "auto",
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
    return c.json({ error: "No billing history found.", code: "NO_CUSTOMER" }, 404);
  }

  const stripe = getStripe(env);
  const frontendUrl = env.FRONTEND_URL || "https://www.webagt.ai";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${frontendUrl}/dashboard`,
  });

  return c.json({ url: portalSession.url });
});

export { billingRoutes };
