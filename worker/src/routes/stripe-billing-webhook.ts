/**
 * worker/src/routes/stripe-billing-webhook.ts
 *
 * PUBLIC webhook handler for native Stripe subscription events.
 * Security: Stripe-signed HMAC-SHA256 — no auth middleware needed.
 *
 * Events handled:
 * - checkout.session.completed       → Upgrade user to Pro
 * - customer.subscription.deleted    → Downgrade user to Free
 * - customer.subscription.updated    → Downgrade if status !== "active"
 * - invoice.payment_failed           → Log warning (Stripe retries)
 *
 * The Clerk user ID is carried in session/subscription metadata:
 *   metadata.clerk_user_id = "user_..."
 *
 * Webhook URL to set in Stripe Dashboard:
 *   https://<worker-url>/webhooks/stripe-billing
 *
 * Set STRIPE_BILLING_WEBHOOK_SECRET in Cloudflare secrets:
 *   wrangler secret put STRIPE_BILLING_WEBHOOK_SECRET
 */

import { Hono } from "hono";
import Stripe from "stripe";
import type { Env } from "../types";
import { upgradePlan, downgradePlan, getCredits } from "../services/credits";

const stripeBillingWebhookRoutes = new Hono<{ Bindings: Env }>();

stripeBillingWebhookRoutes.post("/", async (c) => {
  const env = c.env;
  const webhookSecret = env.STRIPE_BILLING_WEBHOOK_SECRET;
  const secretKey = env.STRIPE_SECRET_KEY_LIVE || env.STRIPE_SECRET_KEY;

  if (!webhookSecret || !secretKey) {
    console.error("[stripe-billing-webhook] Missing STRIPE_BILLING_WEBHOOK_SECRET or secret key");
    return c.json({ error: "Webhook not configured" }, 503);
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" as any });

  const sig = c.req.header("stripe-signature");
  if (!sig) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  const body = await c.req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("[stripe-billing-webhook] Signature verification failed:", err);
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  console.log(`[stripe-billing-webhook] Event: ${event.type}`);

  switch (event.type) {
    /**
     * checkout.session.completed — Payment succeeded, subscription started.
     * Upgrade the user whose clerk_user_id is in session metadata.
     */
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.clerk_user_id;
      if (!userId) {
        console.error("[stripe-billing-webhook] checkout.session.completed: missing clerk_user_id");
        break;
      }

      // Persist Stripe customer ID
      if (session.customer) {
        const customerId = typeof session.customer === "string"
          ? session.customer : session.customer.id;
        const existing = await env.METADATA.get(`stripe_customer:${userId}`);
        if (!existing) await env.METADATA.put(`stripe_customer:${userId}`, customerId);
      }

      if (session.mode === "subscription") {
        // Pro subscription payment
        console.log(`[stripe-billing-webhook] Upgrading user ${userId} to Pro`);
        await upgradePlan(userId, env);
      } else if (session.mode === "payment" && session.metadata?.type === "credit_pack") {
        // One-time credit pack purchase — add credits to user balance
        const creditsToAdd = parseInt(session.metadata?.credits || "0", 10);
        if (creditsToAdd > 0) {
          const current = await getCredits(userId, env);
          // Pro users are already unlimited, no need to add
          if (current.remaining !== -1) {
            const updated = {
              ...current,
              remaining: current.remaining + creditsToAdd,
              total: current.total + creditsToAdd,
            };
            await env.METADATA.put(`credits:${userId}`, JSON.stringify(updated));
            console.log(`[stripe-billing-webhook] Added ${creditsToAdd} credits to user ${userId}`);
          } else {
            console.log(`[stripe-billing-webhook] User ${userId} is Pro (unlimited) — skipping credit add`);
          }
        }
      }
      break;
    }

    /**
     * customer.subscription.deleted — Subscription fully cancelled/expired.
     * Downgrade the user back to Free.
     */
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.clerk_user_id;
      if (!userId) {
        console.error("[stripe-billing-webhook] subscription.deleted: missing clerk_user_id");
        break;
      }
      console.log(`[stripe-billing-webhook] Downgrading user ${userId} to Free`);
      await downgradePlan(userId, env);
      break;
    }

    /**
     * customer.subscription.updated — Status changed (e.g. past_due, canceled, active).
     * Only downgrade when status leaves "active" state definitively.
     */
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.clerk_user_id;
      if (!userId) break;

      if (sub.status === "active" || sub.status === "trialing") {
        // Still active — ensure they're on Pro
        await upgradePlan(userId, env);
      } else if (sub.status === "canceled" || sub.status === "unpaid") {
        await downgradePlan(userId, env);
      }
      // past_due: Stripe retries, don't downgrade yet
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(
        `[stripe-billing-webhook] Payment failed for customer ${invoice.customer} — Stripe will retry`
      );
      break;
    }

    default:
      console.log(`[stripe-billing-webhook] Unhandled event: ${event.type}`);
  }

  return c.json({ received: true, type: event.type });
});

export { stripeBillingWebhookRoutes };
