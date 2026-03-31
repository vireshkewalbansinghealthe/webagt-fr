/**
 * worker/src/routes/stripe.ts
 *
 * Hono router for Stripe Connect operations.
 * Handles creating connected accounts, account links, and checkout sessions
 * with a 25% application fee.
 */

import { Hono } from "hono";
import Stripe from "stripe";

/**
 * Sanitize an image URL before passing to Stripe.
 * Stripe rejects URLs > 2048 chars, base64 data: URLs, and non-http(s) URLs.
 * For Unsplash and CDN-style hosts, strip query params (the bare path still loads the image).
 */
function sanitizeStripeImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:")) return undefined;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return undefined;
    const cdnHosts = ["unsplash.com", "images.unsplash.com", "source.unsplash.com", "picsum.photos", "cloudinary.com", "imgix.net"];
    if (cdnHosts.some((h) => parsed.hostname.includes(h))) {
      const clean = `${parsed.origin}${parsed.pathname}`;
      return clean.length <= 2048 ? clean : undefined;
    }
    return url.length <= 2048 ? url : undefined;
  } catch {
    return undefined;
  }
}
import type { Env, AppVariables } from "../types";
import type { Project } from "../types/project";
import {
  buildStripeAccountStatus,
  createStripeConnectedAccount,
  getProjectPaymentMode,
  getStripeAccountIdForMode,
  getStripeClient,
  resolveStripeMode,
  type PaymentMode,
  type StripeMode,
  syncCoolifyStripeConfiguration,
} from "../services/stripe-connect";
import {
  sendCustomerPaidEmailForSession,
  sendOwnerOrderEmailForSession,
  sendOrderCancelledEmail,
  sendOrderRefundedEmail,
} from "../services/order-emails";

const stripeRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

interface CheckoutCartItem {
  productId?: string;
  name: string;
  unitAmount: number;
  quantity: number;
  image?: string;
  isVirtual?: boolean;
}

interface StoredCheckoutPayload {
  projectId: string;
  items: CheckoutCartItem[];
  requiresShipping: boolean;
  createdAt: string;
}

function buildOrderNumber(sessionId: string): string {
  return `ORD-${sessionId.slice(-8).toUpperCase()}`;
}

function normalizeCartItems(body: {
  items?: Array<{
    productId?: string;
    name?: string;
    unitAmount?: number;
    quantity?: number;
    image?: string;
    isVirtual?: boolean;
  }>;
  amount?: number;
  productName?: string;
}): CheckoutCartItem[] {
  if (Array.isArray(body.items) && body.items.length > 0) {
    return body.items
      .filter((item) => item && item.name && Number(item.unitAmount) > 0)
      .map((item) => ({
        productId: item.productId,
        name: String(item.name),
        unitAmount: Math.round(Number(item.unitAmount)),
        quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        image: item.image,
        isVirtual: Boolean(item.isVirtual),
      }));
  }

  if (body.amount && body.productName) {
    return [
      {
        name: String(body.productName),
        unitAmount: Math.round(Number(body.amount)),
        quantity: 1,
        isVirtual: false,
      },
    ];
  }

  return [];
}

function serializeAddress(address: Stripe.Address | null | undefined, name?: string | null) {
  if (!address && !name) return null;
  return JSON.stringify({
    name: name || undefined,
    line1: address?.line1 || undefined,
    line2: address?.line2 || undefined,
    city: address?.city || undefined,
    state: address?.state || undefined,
    postalCode: address?.postal_code || undefined,
    country: address?.country || undefined,
  });
}

function getPlatformCommissionPercent(c: any): number {
  const parsed = Number.parseFloat(c.env.PLATFORM_COMMISSION_PERCENT || "25");
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(0, Math.min(100, parsed));
}

const MANAGED_WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
];

function getModeWebhookSecrets(env: Env, mode: StripeMode): string[] {
  return Array.from(
    new Set(
      [
        mode === "live" ? env.STRIPE_WEBHOOK_SECRET_LIVE : env.STRIPE_WEBHOOK_SECRET_TEST,
        env.STRIPE_WEBHOOK_SECRET,
      ].filter(Boolean),
    ),
  ) as string[];
}

async function getStoredWebhookSecret(env: Env, mode: StripeMode): Promise<string | null> {
  return (
    (await env.METADATA.get(`stripe:webhook-secret:${mode}`)) ||
    (await env.METADATA.get("stripe:webhook-secret")) ||
    null
  );
}

async function ensureManagedWebhookEndpoint(
  env: Env,
  mode: StripeMode,
  requestUrl: string,
): Promise<void> {
  const knownSecrets = [
    ...getModeWebhookSecrets(env, mode),
    await getStoredWebhookSecret(env, mode),
  ].filter(Boolean) as string[];

  const webhookUrl = new URL("/api/stripe/webhook", requestUrl).toString();
  const stripe = getStripeClient(env, mode);
  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const hasMatchingEndpoint = endpoints.data.some((endpoint) => endpoint.url === webhookUrl);

  if (hasMatchingEndpoint && knownSecrets.length > 0) {
    return;
  }

  const created = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: MANAGED_WEBHOOK_EVENTS,
    description: `WebAGT managed checkout webhook (${mode})`,
    api_version: "2026-02-25.clover",
  });

  if (created.secret) {
    await env.METADATA.put(`stripe:webhook-secret:${mode}`, created.secret);
  }
}

// ---------------------------------------------------------------------------
// POST /api/stripe/accounts — Create a new Express Connected Account
// ---------------------------------------------------------------------------
stripeRoutes.post("/accounts", async (c) => {
  try {
    const { projectId, mode } = await c.req.json<{ projectId?: string; mode?: StripeMode }>();
    if (!projectId) {
      return c.json({ error: "projectId is required" }, 400);
    }

    const stripeMode = resolveStripeMode(mode);
    const account = await createStripeConnectedAccount(c.env, stripeMode);

    // Save the account.id in the project's metadata
    const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
    if (project) {
      if (stripeMode === "live") {
        project.stripeLiveAccountId = account.id;
      } else {
        project.stripeTestAccountId = account.id;
      }
      if (!project.stripeAccountId || getProjectPaymentMode(project) === stripeMode) {
        project.stripeAccountId = account.id;
      }
      project.updatedAt = new Date().toISOString();
      if (project.deployment_uuid) {
        await syncCoolifyStripeConfiguration(c.env, project);
      }
      await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));
    }

    return c.json({ accountId: account.id, mode: stripeMode });
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
    const { accountId, refreshUrl, returnUrl, mode } = await c.req.json<{
      accountId?: string;
      refreshUrl?: string;
      returnUrl?: string;
      mode?: StripeMode;
    }>();

    if (!accountId || !refreshUrl || !returnUrl) {
      return c.json(
        { error: "accountId, refreshUrl, and returnUrl are required" },
        400
      );
    }

    const stripe = getStripeClient(c.env, resolveStripeMode(mode));

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
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
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
      requiresShipping,
    } = body;

    const checkoutItems = normalizeCartItems(body);

    if (!projectId || checkoutItems.length === 0 || !currency) {
      return c.json({ error: "Missing required checkout session parameters" }, 400);
    }

    // Get the project to find the connected account ID and preferred payment methods
    const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
    
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    if (!project.deployment_uuid) {
      return c.json(
        {
          error: "Publish your shop before accepting payments.",
          code: "SHOP_NOT_PUBLISHED",
        },
        400,
      );
    }

    const paymentMode = getProjectPaymentMode(project);
    if (paymentMode === "off") {
      return c.json(
        {
          error: "Payments are currently disabled for this shop.",
          code: "PAYMENTS_DISABLED",
        },
        400,
      );
    }

    const stripeMode: StripeMode = paymentMode === "live" ? "live" : "test";
    const stripe = getStripeClient(c.env, stripeMode);
    const accountId = getStripeAccountIdForMode(project, stripeMode);

    if (!accountId) {
      return c.json(
        {
          error: "No Stripe account connected to this project. Please connect Stripe in the Shop Manager.",
          code: "STRIPE_NOT_CONNECTED",
        },
        400,
      );
    }

    const account = await stripe.accounts.retrieve(accountId);
    if ("deleted" in account) {
      return c.json({ error: "Stripe account not found", code: "STRIPE_ACCOUNT_NOT_FOUND" }, 404);
    }

    const accountStatus = buildStripeAccountStatus(account);
    if (!accountStatus.is_ready) {
      return c.json(
        {
          error: "Stripe onboarding must be completed before this shop can accept payments.",
          code: "STRIPE_ONBOARDING_INCOMPLETE",
          account: accountStatus,
        },
        400,
      );
    }

    await ensureManagedWebhookEndpoint(c.env, stripeMode, c.req.url);

    const applicationFeeAmount = Math.round(
      checkoutItems.reduce((sum, item) => sum + item.unitAmount * item.quantity, 0) *
        (getPlatformCommissionPercent(c) / 100),
    );

    const paymentMethods = project?.stripePaymentMethods || ["card", "ideal"];

    const sessionPayload: Stripe.Checkout.SessionCreateParams = {
      ui_mode: uiMode as "hosted" | "embedded",
      payment_method_types: paymentMethods as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
      line_items: checkoutItems.map((item) => ({
        price_data: {
          currency,
          product_data: {
            name: item.name,
            images: item.image ? [sanitizeStripeImageUrl(item.image)].filter((u): u is string => !!u) : undefined,
          },
          unit_amount: item.unitAmount,
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      customer_creation: "always",
      billing_address_collection: "required",
      metadata: {
        projectId,
        paymentMode: stripeMode,
        requiresShipping: String(Boolean(requiresShipping)),
        orderNumber: buildOrderNumber(`pending_${Date.now().toString(36)}`),
      },
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: accountId,
        },
      },
    };

    if (requiresShipping) {
      sessionPayload.shipping_address_collection = {
        allowed_countries: ["NL", "BE", "DE", "FR", "ES", "IT", "AT", "DK", "SE", "IE", "PT", "LU", "GB", "US", "CA"],
      };
    }

    if (uiMode === "embedded") {
      sessionPayload.return_url = returnUrl || successUrl || "https://example.com/success";
    } else {
      sessionPayload.success_url = successUrl;
      sessionPayload.cancel_url = cancelUrl;
    }

    const session = await stripe.checkout.sessions.create(sessionPayload);

    await c.env.METADATA.put(
      `checkout:${projectId}:${session.id}`,
      JSON.stringify({
        projectId,
        items: checkoutItems,
        requiresShipping: Boolean(requiresShipping),
        createdAt: new Date().toISOString(),
      } satisfies StoredCheckoutPayload),
      { expirationTtl: 60 * 60 * 24 * 2 },
    );

    await stripe.checkout.sessions.update(session.id, {
      metadata: {
        projectId,
        paymentMode: stripeMode,
        requiresShipping: String(Boolean(requiresShipping)),
        orderNumber: buildOrderNumber(session.id),
      },
    });

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
    const stripe = getStripeClient(c.env, resolveStripeMode(c.req.query("mode")));

    const account = await stripe.accounts.retrieve(accountId);
    if ("deleted" in account) {
      return c.json({ error: "Stripe account not found", code: "STRIPE_ACCOUNT_NOT_FOUND" }, 404);
    }

    return c.json(buildStripeAccountStatus(account));
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
    const stripe = getStripeClient(c.env, resolveStripeMode(c.req.query("mode")));

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
    const stripe = getStripeClient(c.env, resolveStripeMode(c.req.query("mode")));

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
    const body = await c.req.json<{ mode?: StripeMode }>().catch(() => ({}) as { mode?: StripeMode });
    const stripe = getStripeClient(c.env, resolveStripeMode(body.mode));

    const loginLink = await stripe.accounts.createLoginLink(accountId);

    return c.json(loginLink);
  } catch (error: any) {
    console.error("Error creating Stripe login link:", error);
    return c.json({ error: error.message }, 500);
  }
});

async function upsertOrderFromSession(
  project: Project,
  env: Env,
  session: Stripe.Checkout.Session,
  markPaid: boolean,
) {
  if (!project.databaseUrl || !project.databaseToken) {
    return;
  }

  const stored = await env.METADATA.get<StoredCheckoutPayload>(
    `checkout:${project.id}:${session.id}`,
    "json",
  );

  const fallbackUnitAmount = Math.round((session.amount_total || 0) / Math.max(1, 1));
  const items =
    stored?.items && stored.items.length > 0
      ? stored.items
      : [
          {
            name: session.metadata?.productName || project.name,
            unitAmount: fallbackUnitAmount,
            quantity: 1,
            isVirtual: false,
          },
        ];

  const { createClient } = await import("@libsql/client/web");
  const db = createClient({
    url: project.databaseUrl,
    authToken: project.databaseToken,
  });

  const customerEmail =
    session.customer_details?.email || session.customer_email || undefined;
  const customerName = session.customer_details?.name || "";
  const [firstName, ...restName] = customerName.trim().split(/\s+/).filter(Boolean);
  const lastName = restName.join(" ");

  let customerId: string | null = null;
  if (customerEmail) {
    const existingCustomer = await db.execute({
      sql: "SELECT id FROM Customer WHERE email = ? LIMIT 1",
      args: [customerEmail],
    });
    customerId =
      existingCustomer.rows[0] && "id" in (existingCustomer.rows[0] as any)
        ? String((existingCustomer.rows[0] as any).id)
        : null;

    if (!customerId) {
      customerId = crypto.randomUUID();
      await db.execute({
        sql: `INSERT INTO Customer (id, email, firstName, lastName, phone, createdAt, updatedAt)
              VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        args: [
          customerId,
          customerEmail,
          firstName || null,
          lastName || null,
          session.customer_details?.phone || null,
        ],
      });
    } else {
      await db.execute({
        sql: `UPDATE Customer
              SET firstName = COALESCE(?, firstName),
                  lastName = COALESCE(?, lastName),
                  phone = COALESCE(?, phone),
                  updatedAt = datetime('now')
              WHERE id = ?`,
        args: [
          firstName || null,
          lastName || null,
          session.customer_details?.phone || null,
          customerId,
        ],
      });
    }
  }

  const orderNumber = session.metadata?.orderNumber || buildOrderNumber(session.id);
  const shippingDetails = (session as Stripe.Checkout.Session & {
    shipping_details?: {
      address?: Stripe.Address | null;
      name?: string | null;
    } | null;
  }).shipping_details;
  const shippingAddress = serializeAddress(
    shippingDetails?.address,
    shippingDetails?.name,
  );
  const billingAddress = serializeAddress(
    session.customer_details?.address,
    session.customer_details?.name,
  );
  const orderStatus = markPaid ? "PAID" : "PENDING";

  await db.execute({
    sql: `INSERT INTO [Order] (id, orderNumber, customerId, status, totalAmount, shippingAddress, billingAddress, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          ON CONFLICT(id) DO UPDATE SET
            orderNumber = excluded.orderNumber,
            customerId = excluded.customerId,
            status = excluded.status,
            totalAmount = excluded.totalAmount,
            shippingAddress = excluded.shippingAddress,
            billingAddress = excluded.billingAddress,
            updatedAt = datetime('now')`,
    args: [
      session.id,
      orderNumber,
      customerId,
      orderStatus,
      (session.amount_total || 0) / 100,
      shippingAddress,
      billingAddress,
    ],
  });

  await db.execute({
    sql: "DELETE FROM OrderItem WHERE orderId = ?",
    args: [session.id],
  });

  for (const item of items) {
    if (!item.productId) {
      continue;
    }
    await db.execute({
      sql: `INSERT INTO OrderItem (id, orderId, productId, quantity, unitPrice, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [
        crypto.randomUUID(),
        session.id,
        item.productId,
        item.quantity,
        item.unitAmount / 100,
      ],
    });
  }
}

// ---------------------------------------------------------------------------
// POST /api/stripe/webhook — Handle Stripe webhook events
// ---------------------------------------------------------------------------
stripeRoutes.post("/webhook", async (c) => {
  c.header("Access-Control-Allow-Origin", "*");
  try {
    const body = await c.req.text();
    const sig = c.req.header("stripe-signature");

    let event: Stripe.Event;

    if (sig) {
      const storedSecrets = (
        await Promise.all([
          getStoredWebhookSecret(c.env, "test"),
          getStoredWebhookSecret(c.env, "live"),
        ])
      ).filter(Boolean) as string[];

      const secrets = Array.from(
        new Set(
          [
            c.env.STRIPE_WEBHOOK_SECRET_LIVE,
            c.env.STRIPE_WEBHOOK_SECRET_TEST,
            c.env.STRIPE_WEBHOOK_SECRET,
            ...storedSecrets,
          ].filter(Boolean),
        ),
      ) as string[];

      if (secrets.length === 0) {
        return c.json({ error: "Stripe webhook secret is not configured." }, 400);
      }

      let parsedEvent: Stripe.Event | null = null;
      let lastError: Error | null = null;
      const webhookSecretKey =
        c.env.STRIPE_SECRET_KEY_TEST ||
        c.env.STRIPE_SECRET_KEY_LIVE ||
        c.env.STRIPE_SECRET_KEY;

      if (!webhookSecretKey) {
        return c.json({ error: "Stripe secret key is not configured." }, 400);
      }

      for (const secret of secrets) {
        try {
          const stripe = new Stripe(webhookSecretKey, {
            apiVersion: "2026-02-25.clover",
          });
          parsedEvent = await stripe.webhooks.constructEventAsync(body, sig, secret);
          break;
        } catch (error: any) {
          lastError = error;
        }
      }

      if (!parsedEvent) {
        throw lastError || new Error("Webhook signature verification failed");
      }

      event = parsedEvent;
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        const projectId = session.metadata?.projectId;
        const isPaid =
          session.payment_status === "paid" || session.payment_status === "no_payment_required";

        if (projectId) {
          const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");

          if (project) {
            try {
              await upsertOrderFromSession(
                project,
                c.env,
                session,
                event.type === "checkout.session.async_payment_succeeded" ? true : isPaid,
              );
            } catch (dbErr) {
              console.warn("Webhook DB insert failed (non-fatal):", dbErr);
            }

            if (event.type === "checkout.session.completed") {
              try {
                await sendOwnerOrderEmailForSession(c.env, project, session);
              } catch (emailErr) {
                console.warn("Webhook owner email send failed (non-fatal):", emailErr);
              }
            }

            if (isPaid || event.type === "checkout.session.async_payment_succeeded") {
              try {
                await sendCustomerPaidEmailForSession(c.env, project, session);
              } catch (emailErr) {
                console.warn("Webhook customer email send failed (non-fatal):", emailErr);
              }
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
          if (
            proj?.stripeAccountId === account.id ||
            proj?.stripeTestAccountId === account.id ||
            proj?.stripeLiveAccountId === account.id
          ) {
            proj.updatedAt = new Date().toISOString();
            await c.env.METADATA.put(key.name, JSON.stringify(proj));
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

// ---------------------------------------------------------------------------
// Helpers shared by order management endpoints
// ---------------------------------------------------------------------------
async function getOrderFromDb(
  db: Awaited<ReturnType<typeof import("@libsql/client/web").createClient>>,
  orderId: string,
): Promise<{
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customerEmail: string | null;
  customerName: string | null;
} | null> {
  const res = await db.execute({
    sql: `SELECT o.id, o.orderNumber, o.status, o.totalAmount,
                 c.email as customerEmail,
                 (c.firstName || ' ' || COALESCE(c.lastName, '')) as customerName
          FROM [Order] o
          LEFT JOIN Customer c ON o.customerId = c.id
          WHERE o.id = ?
          LIMIT 1`,
    args: [orderId],
  });
  if (!res.rows[0]) return null;
  const row = res.rows[0] as any;
  return {
    id: String(row.id),
    orderNumber: String(row.orderNumber),
    status: String(row.status),
    totalAmount: Number(row.totalAmount),
    customerEmail: row.customerEmail ? String(row.customerEmail).trim() || null : null,
    customerName: row.customerName ? String(row.customerName).trim() || null : null,
  };
}

// ---------------------------------------------------------------------------
// POST /api/stripe/orders/cancel
// Body: { projectId, orderId }
// ---------------------------------------------------------------------------
stripeRoutes.post("/orders/cancel", async (c) => {
  try {
    const { projectId, orderId } = await c.req.json<{ projectId?: string; orderId?: string }>();
    if (!projectId || !orderId) return c.json({ error: "projectId and orderId are required" }, 400);

    const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
    if (!project) return c.json({ error: "Project not found" }, 404);
    if (!project.databaseUrl) return c.json({ error: "Project has no database configured" }, 400);

    const { createClient } = await import("@libsql/client/web");
    const db = createClient({ url: project.databaseUrl, authToken: project.databaseToken });

    const order = await getOrderFromDb(db, orderId);
    if (!order) return c.json({ error: "Order not found" }, 404);
    if (order.status === "REFUNDED") return c.json({ error: "Order has already been refunded" }, 400);

    console.log(`[order-cancel] Order ${order.orderNumber}: status=${order.status}, customerEmail=${order.customerEmail}, customerId linked=${!!order.customerEmail}`);

    // If customer email is missing from DB, try to retrieve from Stripe session
    let customerEmail = order.customerEmail ?? undefined;
    let customerName = order.customerName ?? undefined;
    if (!customerEmail && orderId.startsWith("cs_")) {
      try {
        const paymentMode = getProjectPaymentMode(project);
        const stripeMode: StripeMode = paymentMode === "live" ? "live" : "test";
        const stripe = getStripeClient(c.env, stripeMode);
        const session = await stripe.checkout.sessions.retrieve(orderId);
        customerEmail = session.customer_details?.email || session.customer_email || undefined;
        customerName = session.customer_details?.name || customerName;
        console.log(`[order-cancel] Stripe session fallback: email=${customerEmail}, name=${customerName}`);
      } catch (stripErr) {
        console.warn("[order-cancel] Stripe session lookup failed:", stripErr);
      }
    }

    await db.execute({
      sql: `UPDATE [Order] SET status = 'CANCELLED', updatedAt = datetime('now') WHERE id = ?`,
      args: [orderId],
    });

    const emailResult = await sendOrderCancelledEmail(c.env, project, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      customerEmail,
      customerName,
    });

    console.log(`[order-cancel] Email result:`, JSON.stringify(emailResult));
    return c.json({ success: true, status: "CANCELLED", emailSent: emailResult.sent, emailReason: emailResult.reason });
  } catch (error: any) {
    console.error("Order cancel error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/stripe/orders/refund
// Body: { projectId, orderId, mode? }
// ---------------------------------------------------------------------------
stripeRoutes.post("/orders/refund", async (c) => {
  try {
    const { projectId, orderId, mode } = await c.req.json<{
      projectId?: string;
      orderId?: string;
      mode?: StripeMode;
    }>();
    if (!projectId || !orderId) return c.json({ error: "projectId and orderId are required" }, 400);

    const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
    if (!project) return c.json({ error: "Project not found" }, 404);
    if (!project.databaseUrl) return c.json({ error: "Project has no database configured" }, 400);

    const { createClient } = await import("@libsql/client/web");
    const db = createClient({ url: project.databaseUrl, authToken: project.databaseToken });

    const order = await getOrderFromDb(db, orderId);
    if (!order) return c.json({ error: "Order not found" }, 404);
    if (order.status === "REFUNDED") return c.json({ error: "Order has already been refunded" }, 400);
    if (order.status === "CANCELLED") return c.json({ error: "Cannot refund a cancelled order" }, 400);

    // orderId IS the Stripe checkout session ID — retrieve it to get the payment_intent
    const stripeMode = resolveStripeMode(mode ?? (getProjectPaymentMode(project) as StripeMode));
    const stripeClient = getStripeClient(c.env, stripeMode);

    let paymentIntentId: string | null = null;
    try {
      const session = await stripeClient.checkout.sessions.retrieve(orderId);
      paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
    } catch {
      // Session might not exist if the order was created manually; try treating orderId as payment_intent
      paymentIntentId = orderId.startsWith("pi_") ? orderId : null;
    }

    let refundId: string | undefined;
    if (paymentIntentId) {
      const refund = await stripeClient.refunds.create({ payment_intent: paymentIntentId });
      refundId = refund.id;
    }

    // If customer email is missing from DB, try to retrieve from Stripe session
    let customerEmail = order.customerEmail ?? undefined;
    let customerName = order.customerName ?? undefined;
    if (!customerEmail && orderId.startsWith("cs_")) {
      try {
        const session = await stripeClient.checkout.sessions.retrieve(orderId);
        customerEmail = session.customer_details?.email || session.customer_email || undefined;
        customerName = session.customer_details?.name || customerName;
        console.log(`[order-refund] Stripe session fallback: email=${customerEmail}`);
      } catch (stripErr) {
        console.warn("[order-refund] Stripe session lookup failed:", stripErr);
      }
    }

    await db.execute({
      sql: `UPDATE [Order] SET status = 'REFUNDED', updatedAt = datetime('now') WHERE id = ?`,
      args: [orderId],
    });

    const emailResult = await sendOrderRefundedEmail(c.env, project, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      customerEmail,
      customerName,
      refundId,
    });

    console.log(`[order-refund] Email result:`, JSON.stringify(emailResult));
    return c.json({ success: true, status: "REFUNDED", refundId: refundId ?? null });
  } catch (error: any) {
    console.error("Order refund error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/stripe/orders/:orderId
// Query: ?projectId=xxx
// ---------------------------------------------------------------------------
stripeRoutes.delete("/orders/:orderId", async (c) => {
  try {
    const orderId = c.req.param("orderId");
    const projectId = c.req.query("projectId");
    if (!projectId || !orderId) return c.json({ error: "projectId and orderId are required" }, 400);

    const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
    if (!project) return c.json({ error: "Project not found" }, 404);
    if (!project.databaseUrl) return c.json({ error: "Project has no database configured" }, 400);

    const { createClient } = await import("@libsql/client/web");
    const db = createClient({ url: project.databaseUrl, authToken: project.databaseToken });

    // Cascade-delete order items first, then order
    await db.execute({ sql: "DELETE FROM OrderItem WHERE orderId = ?", args: [orderId] });
    await db.execute({ sql: "DELETE FROM [Order] WHERE id = ?", args: [orderId] });

    return c.json({ success: true });
  } catch (error: any) {
    console.error("Order delete error:", error);
    return c.json({ error: error.message }, 500);
  }
});

export { stripeRoutes };
