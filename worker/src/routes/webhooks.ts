/**
 * worker/src/routes/webhooks.ts
 *
 * Webhook handler for Clerk Billing events.
 * This route is PUBLIC — no auth middleware required.
 * Security is provided by Svix signature verification instead.
 *
 * When a user subscribes, upgrades, or cancels their Pro plan,
 * Clerk sends a signed webhook event to this endpoint.
 * We verify the signature, then update the user's credits in KV.
 *
 * Events handled:
 * - subscriptionItem.active → Upgrade user to Pro (unlimited credits)
 * - subscriptionItem.canceled → Log pending downgrade (completes at period end)
 * - subscriptionItem.ended → Downgrade to Free (50 credits/month)
 * - subscriptionItem.pastDue → Log payment failure warning
 * - subscription.pastDue → Log payment failure warning
 *
 * Webhook is configured in Clerk Dashboard → Webhooks.
 * Signing secret is stored in .dev.vars as CLERK_WEBHOOK_SECRET.
 *
 * Used by: worker/src/index.ts (mounted at /webhooks/clerk-billing)
 */

import { Hono } from "hono";
import { Webhook } from "svix";
import type { Env } from "../types";
import { upgradePlan, downgradePlan } from "../services/credits";

/**
 * Create a Hono router for webhook endpoints.
 * Note: NO auth middleware — webhooks are verified via Svix signatures.
 * The Bindings type includes Env but Variables is empty (no userId).
 */
const webhookRoutes = new Hono<{ Bindings: Env }>();

/**
 * Shape of the Clerk billing webhook payload.
 * Only includes fields we need for plan change processing.
 */
interface ClerkBillingWebhookPayload {
  /** The subscription item or subscription data */
  data: {
    /** Subscription item ID */
    id?: string;
    /** Plan info (present on subscriptionItem events) */
    plan?: {
      id?: string;
      name?: string;
      slug?: string;
    };
    /** Payer info with user ID */
    payer?: {
      user_id?: string;
      email?: string;
    };
    /** Item status */
    status?: string;
    /** Payer ID (on subscription-level events) */
    payer_id?: string;
  };
  /** Event type (e.g., "subscriptionItem.active") */
  type: string;
  /** Event timestamp in milliseconds */
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// POST /webhooks/clerk-billing — Handle Clerk billing webhooks
// ---------------------------------------------------------------------------

/**
 * Receives and processes Clerk billing webhook events.
 *
 * Flow:
 * 1. Extract Svix signature headers from the request
 * 2. Verify the webhook payload using the signing secret
 * 3. Parse the event type and extract user ID + plan slug
 * 4. Update credits in KV based on the event (upgrade/downgrade)
 * 5. Return 200 to acknowledge receipt
 *
 * Returns 400 if signature verification fails.
 * Returns 200 for all valid events (even unhandled ones).
 */
webhookRoutes.post("/", async (c) => {
  // --- 1. Extract Svix verification headers ---
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return c.json(
      { error: "Missing svix headers", code: "WEBHOOK_INVALID" },
      400
    );
  }

  // --- 2. Verify the webhook signature ---
  const body = await c.req.text();
  const wh = new Webhook(c.env.CLERK_WEBHOOK_SECRET);

  let event: ClerkBillingWebhookPayload;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkBillingWebhookPayload;
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return c.json(
      { error: "Invalid webhook signature", code: "WEBHOOK_UNAUTHORIZED" },
      400
    );
  }

  // --- 3. Process the event ---
  const eventType = event.type;
  console.log(`Webhook received: ${eventType}`);

  switch (eventType) {
    /**
     * subscriptionItem.active — A plan subscription became active.
     * This fires when:
     * - User completes checkout for the first time
     * - A plan renewal succeeds
     * We check if it's the "pro" plan and upgrade credits accordingly.
     */
    case "subscriptionItem.active": {
      const userId = event.data.payer?.user_id;
      const planSlug = event.data.plan?.slug;

      if (!userId) {
        console.error("subscriptionItem.active: missing user_id");
        break;
      }

      if (planSlug === "pro") {
        console.log(`Upgrading user ${userId} to Pro plan`);
        await upgradePlan(userId, c.env);
      }
      break;
    }

    /**
     * subscriptionItem.canceled — User cancelled their subscription.
     * Access continues until the current billing period ends,
     * then subscriptionItem.ended fires for the actual downgrade.
     * We just log this — no immediate credit change.
     */
    case "subscriptionItem.canceled": {
      const userId = event.data.payer?.user_id;
      const planSlug = event.data.plan?.slug;

      console.log(
        `User ${userId} cancelled ${planSlug} plan — ` +
          `access continues until period end`
      );
      break;
    }

    /**
     * subscriptionItem.ended — A plan subscription period ended.
     * This fires after a cancellation when the paid period expires.
     * Now we downgrade the user back to Free tier.
     */
    case "subscriptionItem.ended": {
      const userId = event.data.payer?.user_id;
      const planSlug = event.data.plan?.slug;

      if (!userId) {
        console.error("subscriptionItem.ended: missing user_id");
        break;
      }

      if (planSlug === "pro") {
        console.log(`Downgrading user ${userId} to Free plan`);
        await downgradePlan(userId, c.env);
      }
      break;
    }

    /**
     * subscriptionItem.pastDue / subscription.pastDue —
     * A payment failed. Clerk handles retries automatically.
     * We log the warning but don't change credits yet.
     */
    case "subscriptionItem.pastDue":
    case "subscription.pastDue": {
      const userId =
        event.data.payer?.user_id || event.data.payer_id;
      console.warn(
        `Payment past due for user ${userId} — Clerk will retry`
      );
      break;
    }

    default: {
      console.log(`Unhandled webhook event: ${eventType}`);
    }
  }

  // Always return 200 to acknowledge receipt — Clerk retries on non-2xx
  return c.json({ received: true, type: eventType });
});

export { webhookRoutes };
