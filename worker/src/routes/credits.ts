/**
 * worker/src/routes/credits.ts
 *
 * API endpoints for credit balance and promo code redemption.
 *
 * Endpoints:
 * - GET  /api/credits            — Return the user's current credit balance
 * - POST /api/credits/redeem     — Redeem a promo/invitation code for credits
 * - GET  /api/credits/onboarding — Check if onboarding modal was seen
 * - POST /api/credits/onboarding — Mark onboarding as seen
 *
 * Promo code KV schema:
 *   Key:   promo:{CODE}          (uppercase, trimmed)
 *   Value: { credits, maxUses, usedBy[], createdAt, expiresAt?, label? }
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import { getCredits, addCredits } from "../services/credits";

const creditRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PromoCode {
  credits: number;
  maxUses: number;
  usedBy: string[];
  createdAt: string;
  expiresAt?: string;
  label?: string;
}

// ---------------------------------------------------------------------------
// GET /api/credits
// ---------------------------------------------------------------------------

creditRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const credits = await getCredits(userId, c.env);

  return c.json({
    remaining: credits.remaining,
    total: credits.total,
    plan: "pro",
  });
});

// ---------------------------------------------------------------------------
// POST /api/credits/redeem — Redeem a promo/invitation code
// ---------------------------------------------------------------------------

creditRoutes.post("/redeem", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{ code: string }>().catch(() => ({ code: "" }));
  const code = (body.code || "").trim().toUpperCase();

  if (!code || code.length < 3) {
    return c.json({ error: "Please enter a valid code.", code: "INVALID_CODE" }, 400);
  }

  const kvKey = `promo:${code}`;
  const promo = await c.env.METADATA.get<PromoCode>(kvKey, "json");

  if (!promo) {
    return c.json({ error: "This code doesn't exist or has expired.", code: "NOT_FOUND" }, 404);
  }

  if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
    return c.json({ error: "This code has expired.", code: "EXPIRED" }, 410);
  }

  if (promo.usedBy.includes(userId)) {
    return c.json({ error: "You've already used this code.", code: "ALREADY_USED" }, 409);
  }

  if (promo.usedBy.length >= promo.maxUses) {
    return c.json({ error: "This code has reached its maximum number of uses.", code: "MAX_USES" }, 410);
  }

  // Redeem: add credits + mark as used
  promo.usedBy.push(userId);
  await c.env.METADATA.put(kvKey, JSON.stringify(promo));

  const updated = await addCredits(userId, promo.credits, c.env);

  console.log(`[credits/redeem] User ${userId} redeemed code "${code}" for ${promo.credits} credits, balance: ${updated.remaining}`);

  return c.json({
    success: true,
    creditsAdded: promo.credits,
    remaining: updated.remaining,
    label: promo.label || `${promo.credits} credits`,
  });
});

// ---------------------------------------------------------------------------
// Onboarding flag (KV-persisted)
// ---------------------------------------------------------------------------

creditRoutes.get("/onboarding", async (c) => {
  const userId = c.var.userId;
  const seen = await c.env.METADATA.get(`onboarding_seen:${userId}`);
  return c.json({ seen: seen === "1" });
});

creditRoutes.post("/onboarding", async (c) => {
  const userId = c.var.userId;
  await c.env.METADATA.put(`onboarding_seen:${userId}`, "1");
  return c.json({ ok: true });
});

export { creditRoutes };
