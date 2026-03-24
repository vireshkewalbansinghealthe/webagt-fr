/**
 * worker/src/routes/stripe.ts
 *
 * Hono router for Stripe Connect operations.
 * Handles creating connected accounts, account links, and checkout sessions
 * with a 25% application fee.
 */

import { Hono } from "hono";
import Stripe from "stripe";
import type { Env, AppVariables } from "../types";
import type { Project } from "../types/project";

const stripeRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * Helper to initialize Stripe client.
 */
function getStripeClient(c: any): Stripe {
  const secretKey = c.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(secretKey, {
    apiVersion: "2025-01-27.acacia", // Use the latest API version or your desired version
  });
}

// ---------------------------------------------------------------------------
// POST /api/stripe/accounts — Create a new Express Connected Account
// ---------------------------------------------------------------------------
stripeRoutes.post("/accounts", async (c) => {
  try {
    const { projectId } = await c.req.json();
    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const stripe = getStripeClient(c);

    // Create the Express account
    const account = await stripe.accounts.create({
      type: "express",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
    });

    // Save the account.id in the project's metadata
    const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
    if (project) {
      project.stripeAccountId = account.id;
      project.updatedAt = new Date().toISOString();
      await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));
    }

    return c.json({ accountId: account.id });
  } catch (error: any) {
    console.error("Error creating Stripe account:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/account_links — Generate an onboarding URL
// ---------------------------------------------------------------------------
stripeRoutes.post("/account_links", async (c) => {
  try {
    const { accountId, refreshUrl, returnUrl } = await c.req.json();

    if (!accountId || !refreshUrl || !returnUrl) {
      return c.json(
        { error: "accountId, refreshUrl, and returnUrl are required" },
        400
      );
    }

    const stripe = getStripeClient(c);

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return c.json({ url: accountLink.url });
  } catch (error: any) {
    console.error("Error creating Stripe account link:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/checkout_sessions — Create a Checkout Session with 25% fee
// ---------------------------------------------------------------------------
stripeRoutes.options("/checkout_sessions", (c) => {
  return c.text("", 204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
});

stripeRoutes.post("/checkout_sessions", async (c) => {
  // Hardcode permissive CORS for this public endpoint just in case global middleware misses it
  c.header("Access-Control-Allow-Origin", "*");
  try {
    const body = await c.req.json();
    const {
      projectId,
      amount,
      currency,
      productName,
      successUrl,
      cancelUrl,
      returnUrl, // Added for embedded checkout
      uiMode = "hosted", // "hosted" or "embedded"
    } = body;

    let accountId = body.accountId;

    if (!projectId || !amount || !currency || !productName) {
      return c.json({ error: "Missing required checkout session parameters" }, 400);
    }

    const stripe = getStripeClient(c);

    // Get the project to find the connected account ID and preferred payment methods
    const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
    
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Use the project's connected account ID if not provided or to ensure security
    if (!accountId && project.stripeAccountId) {
      accountId = project.stripeAccountId;
    }

    if (!accountId) {
      return c.json({ error: "No Stripe account connected to this project. Please connect Stripe in the Shop Manager." }, 400);
    }

    // Calculate the 25% application fee amount (in the smallest currency unit, e.g., cents)
    const applicationFeeAmount = Math.round(amount * 0.25);

    const paymentMethods = project?.stripePaymentMethods || ["card", "ideal"];

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      ui_mode: uiMode as "hosted" | "embedded",
      payment_method_types: paymentMethods as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      line_items: [
        {
          price_data: {
            currency: currency,
            product_data: {
              name: productName,
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: { projectId },
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: accountId,
        },
      },
    };

    if (uiMode === "embedded") {
      sessionPayload.return_url = returnUrl || successUrl || "https://example.com/success";
    } else {
      sessionPayload.success_url = successUrl;
      sessionPayload.cancel_url = cancelUrl;
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    if (uiMode === "embedded") {
      return c.json({ clientSecret: session.client_secret, sessionId: session.id });
    } else {
      return c.json({ url: session.url, sessionId: session.id });
    }
  } catch (error: any) {
    console.error("Error creating Checkout Session:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/stripe/accounts/:id — Get account status
// ---------------------------------------------------------------------------
stripeRoutes.get("/accounts/:id", async (c) => {
  try {
    const accountId = c.req.param("id");
    const stripe = getStripeClient(c);

    const account = await stripe.accounts.retrieve(accountId);

    return c.json({
      id: account.id,
      details_submitted: account.details_submitted,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      capabilities: account.capabilities,
    });
  } catch (error: any) {
    console.error("Error retrieving Stripe account:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/stripe/accounts/:id/balance — Get account balance
// ---------------------------------------------------------------------------
stripeRoutes.get("/accounts/:id/balance", async (c) => {
  try {
    const accountId = c.req.param("id");
    const stripe = getStripeClient(c);

    const balance = await stripe.balance.retrieve({
      stripeAccount: accountId,
    });

    return c.json(balance);
  } catch (error: any) {
    console.error("Error retrieving Stripe balance:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/stripe/accounts/:id/payouts — Get recent payouts
// ---------------------------------------------------------------------------
stripeRoutes.get("/accounts/:id/payouts", async (c) => {
  try {
    const accountId = c.req.param("id");
    const stripe = getStripeClient(c);

    const payouts = await stripe.payouts.list(
      { limit: 10 },
      { stripeAccount: accountId }
    );

    return c.json(payouts);
  } catch (error: any) {
    console.error("Error retrieving Stripe payouts:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/accounts/:id/login_links — Create a login link for the dashboard
// ---------------------------------------------------------------------------
stripeRoutes.post("/accounts/:id/login_links", async (c) => {
  try {
    const accountId = c.req.param("id");
    const stripe = getStripeClient(c);

    const loginLink = await stripe.accounts.createLoginLink(accountId);

    return c.json(loginLink);
  } catch (error: any) {
    console.error("Error creating Stripe login link:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/webhook — Handle Stripe webhook events
// ---------------------------------------------------------------------------
stripeRoutes.post("/webhook", async (c) => {
  c.header("Access-Control-Allow-Origin", "*");
  try {
    const stripe = getStripeClient(c);
    const body = await c.req.text();
    const sig = c.req.header("stripe-signature");
    const webhookSecret = c.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const projectId = session.metadata?.projectId;

        if (projectId) {
          const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");

          if (project?.databaseUrl && project?.databaseToken) {
            try {
              const { createClient } = await import("@libsql/client/web");
              const db = createClient({
                url: project.databaseUrl,
                authToken: project.databaseToken,
              });

              await db.execute({
                sql: `INSERT INTO "Order" (id, status, totalAmount, currency, stripeSessionId, createdAt) 
                      VALUES (?, 'PAID', ?, ?, ?, datetime('now'))
                      ON CONFLICT(id) DO UPDATE SET status = 'PAID'`,
                args: [
                  session.id,
                  (session.amount_total || 0) / 100,
                  session.currency || "eur",
                  session.id,
                ],
              });
            } catch (dbErr) {
              console.warn("Webhook DB insert failed (non-fatal):", dbErr);
            }
          }
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const projects = await c.env.METADATA.list({ prefix: "project:" });

        for (const key of projects.keys) {
          const proj = await c.env.METADATA.get<Project>(key.name, "json");
          if (proj?.stripeAccountId === account.id) {
            break;
          }
        }
        break;
      }
    }

    return c.json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return c.json({ error: error.message }, 400);
  }
});

export { stripeRoutes };
