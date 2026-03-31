import type Stripe from "stripe";
import type { Env } from "../types";
import type { Project } from "../types/project";

type RecipientType = "owner" | "customer";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  recipientType: RecipientType;
  idempotencyKey: string;
  replyTo?: string;
}

interface OrderDetails {
  orderId: string;
  orderNumber: string;
  amount: string;
  currency: string;
  customerEmail?: string;
  customerName?: string;
}

interface SendResult {
  sent: boolean;
  skippedReason?: string;
}

function isValidEmail(value: string | undefined): value is string {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function getOwnerRecipients(project: Project): string[] {
  const source = [
    ...(project.ownerNotificationEmails || []),
    ...(project.ownerNotificationEmail ? [project.ownerNotificationEmail] : []),
  ];
  const normalized = source
    .map((email) => email.trim().toLowerCase())
    .filter((email) => isValidEmail(email));
  return Array.from(new Set(normalized));
}

function moneyFromSession(session: Stripe.Checkout.Session): OrderDetails {
  const amount = (session.amount_total || 0) / 100;
  const currency = (session.currency || "eur").toUpperCase();
  const customerEmail = session.customer_details?.email || session.customer_email || undefined;
  const customerName = session.customer_details?.name || undefined;
  const orderNumber = session.metadata?.orderNumber || `ORD-${session.id.slice(-8).toUpperCase()}`;

  return {
    orderId: session.id,
    orderNumber,
    amount: amount.toFixed(2),
    currency,
    customerEmail,
    customerName,
  };
}

function resolveSender(project: Project, env: Env): { from?: string; replyTo?: string } {
  const ownerEmail = getOwnerRecipients(project)[0];
  const canUseOwnerDomain =
    project.emailSenderMode === "owner_verified" &&
    project.emailDomainStatus === "verified" &&
    Boolean(project.emailDomain);

  const from = canUseOwnerDomain
    ? `orders@${project.emailDomain}`
    : env.PLATFORM_EMAIL_FROM;

  const replyTo = isValidEmail(ownerEmail)
    ? ownerEmail
    : env.PLATFORM_REPLY_TO_FALLBACK;

  return { from, replyTo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Email HTML Templates
// ─────────────────────────────────────────────────────────────────────────────

type EmailVariant = "confirmed" | "owner_new_order" | "cancelled" | "refunded";

interface EmailTemplateOptions {
  variant: EmailVariant;
  shopName: string;
  orderNumber: string;
  amount: string;
  currency: string;
  customerName?: string;
  customerEmail?: string;
  refundId?: string;
  replyEmail?: string;
}

const VARIANT_CONFIG: Record<EmailVariant, { accentColor: string; badge: string; headline: string }> = {
  confirmed: {
    accentColor: "#16a34a",
    badge: "✓ Order Confirmed",
    headline: "Your order is confirmed!",
  },
  owner_new_order: {
    accentColor: "#2563eb",
    badge: "🛍️ New Order",
    headline: "You received a new order",
  },
  cancelled: {
    accentColor: "#dc2626",
    badge: "✕ Order Cancelled",
    headline: "Your order has been cancelled",
  },
  refunded: {
    accentColor: "#7c3aed",
    badge: "↩ Refund Processed",
    headline: "Your refund is on the way",
  },
};

function buildEmailHtml(opts: EmailTemplateOptions): string {
  const { accentColor, badge, headline } = VARIANT_CONFIG[opts.variant];
  const firstName = opts.customerName?.split(" ")[0] || "there";
  const formattedAmount = `${opts.amount} ${opts.currency}`;
  const year = new Date().getFullYear();

  let bodyContent = "";

  if (opts.variant === "confirmed") {
    bodyContent = `
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
        Hi <strong>${firstName}</strong>, thank you for your purchase from <strong>${opts.shopName}</strong>!
        We've received your payment and your order is now confirmed.
      </p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
        You'll receive another email once your order is on its way.
      </p>`;
  } else if (opts.variant === "owner_new_order") {
    bodyContent = `
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
        A new order has been placed in your shop <strong>${opts.shopName}</strong>.
      </p>`;
  } else if (opts.variant === "cancelled") {
    bodyContent = `
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
        Hi <strong>${firstName}</strong>, your order from <strong>${opts.shopName}</strong> has been cancelled.
      </p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
        If you have any questions or didn't request this cancellation, please reply to this email.
      </p>`;
  } else if (opts.variant === "refunded") {
    bodyContent = `
      <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
        Hi <strong>${firstName}</strong>, your refund for order <strong>${opts.orderNumber}</strong>
        from <strong>${opts.shopName}</strong> has been processed.
      </p>
      <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
        The refunded amount will appear on your bank statement within <strong>5–10 business days</strong>,
        depending on your bank.
      </p>`;
  }

  const detailRows: string[] = [
    `<tr>
      <td style="padding:10px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Order number</td>
      <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;font-family:monospace;">${opts.orderNumber}</td>
    </tr>`,
  ];

  if (opts.variant === "owner_new_order" && opts.customerEmail) {
    detailRows.push(`<tr>
      <td style="padding:10px 0;color:#6b7280;font-size:14px;border-bottom:1px solid #f3f4f6;">Customer</td>
      <td style="padding:10px 0;color:#111827;font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid #f3f4f6;">${opts.customerName || "Guest"}<br><span style="color:#6b7280;font-weight:400;">${opts.customerEmail}</span></td>
    </tr>`);
  }

  const amountLabel = opts.variant === "refunded" ? "Refund amount" : "Total";
  detailRows.push(`<tr>
    <td style="padding:10px 0;color:#6b7280;font-size:14px;">${amountLabel}</td>
    <td style="padding:10px 0;color:${accentColor};font-size:16px;font-weight:700;text-align:right;">${formattedAmount}</td>
  </tr>`);

  if (opts.refundId) {
    detailRows.push(`<tr>
      <td style="padding:10px 0;color:#6b7280;font-size:14px;border-top:1px solid #f3f4f6;">Refund ID</td>
      <td style="padding:10px 0;color:#6b7280;font-size:12px;text-align:right;border-top:1px solid #f3f4f6;font-family:monospace;">${opts.refundId}</td>
    </tr>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${badge} — ${opts.orderNumber}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:${accentColor};border-radius:100px;padding:8px 18px;">
                    <span style="color:#ffffff;font-size:13px;font-weight:600;letter-spacing:0.3px;">${badge}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.06);">

              <!-- Accent stripe -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,${accentColor},${accentColor}cc);height:4px;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>

              <!-- Body -->
              <table width="100%" cellpadding="0" cellspacing="0" style="padding:36px 36px 0;">
                <tr>
                  <td>
                    <!-- Shop name -->
                    <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:${accentColor};text-transform:uppercase;letter-spacing:0.8px;">${opts.shopName}</p>

                    <!-- Headline -->
                    <h1 style="margin:0 0 24px;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${headline}</h1>

                    <!-- Message body -->
                    ${bodyContent}

                    <!-- Order details box -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;padding:4px 20px;margin-bottom:28px;">
                      <tr><td>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${detailRows.join("\n")}
                        </table>
                      </td></tr>
                    </table>

                    <!-- Footer message -->
                    <p style="margin:0 0 28px;color:#6b7280;font-size:13px;line-height:1.6;">
                      Questions? Reply to this email and we'll get back to you as soon as possible.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Footer bar -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 36px;">
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                      This email was sent by <strong style="color:#6b7280;">${opts.shopName}</strong> using WebAGT.<br />
                      © ${year} ${opts.shopName}. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Spacer -->
          <tr><td style="height:24px;"></td></tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send helpers
// ─────────────────────────────────────────────────────────────────────────────

async function sendViaResend(
  env: Env,
  from: string,
  input: SendEmailInput,
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      reply_to: input.replyTo,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend send failed (${response.status}): ${errorText}`);
  }
}

async function sendIdempotent(
  env: Env,
  from: string,
  input: SendEmailInput,
): Promise<SendResult> {
  const existing = await env.METADATA.get(input.idempotencyKey);
  if (existing) {
    return { sent: false, skippedReason: "already_sent" };
  }

  await sendViaResend(env, from, input);
  await env.METADATA.put(
    input.idempotencyKey,
    JSON.stringify({
      sentAt: new Date().toISOString(),
      to: input.to,
      recipientType: input.recipientType,
    }),
    { expirationTtl: 60 * 60 * 24 * 30 },
  );

  return { sent: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public send functions
// ─────────────────────────────────────────────────────────────────────────────

export async function sendOwnerOrderEmailForSession(
  env: Env,
  project: Project,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { from, replyTo } = resolveSender(project, env);
  if (!from || !env.RESEND_API_KEY) {
    console.warn(
      `[order-email] Skipping send for project ${project.id}: missing PLATFORM_EMAIL_FROM or RESEND_API_KEY`,
    );
    return;
  }

  const details = moneyFromSession(session);
  const ownerEmails = getOwnerRecipients(project);
  const tasks: Promise<SendResult>[] = [];

  for (const ownerEmail of ownerEmails) {
    tasks.push(
      sendIdempotent(env, from, {
        to: ownerEmail,
        subject: `New order received — ${details.orderNumber} (${project.name})`,
        html: buildEmailHtml({
          variant: "owner_new_order",
          shopName: project.name,
          orderNumber: details.orderNumber,
          amount: details.amount,
          currency: details.currency,
          customerName: details.customerName,
          customerEmail: details.customerEmail,
          replyEmail: replyTo,
        }),
        recipientType: "owner",
        idempotencyKey: `order-email:${project.id}:${details.orderId}:owner:${ownerEmail}`,
        replyTo,
      }),
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[order-email] send failed:", result.reason);
    } else if (!result.value.sent) {
      console.log(`[order-email] skipped: ${result.value.skippedReason}`);
    }
  }
}

export async function sendCustomerPaidEmailForSession(
  env: Env,
  project: Project,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const { from, replyTo } = resolveSender(project, env);
  if (!from || !env.RESEND_API_KEY) {
    console.warn(
      `[order-email] Skipping customer send for project ${project.id}: missing PLATFORM_EMAIL_FROM or RESEND_API_KEY`,
    );
    return;
  }

  const shouldSendCustomer = project.orderCustomerEmailsEnabled !== false;
  const details = moneyFromSession(session);

  if (!shouldSendCustomer || !isValidEmail(details.customerEmail)) {
    return;
  }

  try {
    const result = await sendIdempotent(env, from, {
      to: details.customerEmail,
      subject: `Order confirmed — ${details.orderNumber} (${project.name})`,
      html: buildEmailHtml({
        variant: "confirmed",
        shopName: project.name,
        orderNumber: details.orderNumber,
        amount: details.amount,
        currency: details.currency,
        customerName: details.customerName,
        customerEmail: details.customerEmail,
        replyEmail: replyTo,
      }),
      recipientType: "customer",
      idempotencyKey: `order-email:${project.id}:${details.orderId}:customer`,
      replyTo,
    });
    if (!result.sent) {
      console.log(`[order-email] skipped: ${result.skippedReason}`);
    }
  } catch (error) {
    console.error("[order-email] customer send failed:", error);
  }
}

export async function sendOrderCancelledEmail(
  env: Env,
  project: Project,
  order: { orderId: string; orderNumber: string; totalAmount: number; customerEmail?: string; customerName?: string },
): Promise<void> {
  const { from, replyTo } = resolveSender(project, env);
  if (!from || !env.RESEND_API_KEY) return;

  const shouldSendCustomer = project.orderCustomerEmailsEnabled !== false;
  if (!shouldSendCustomer || !isValidEmail(order.customerEmail)) return;

  try {
    await sendIdempotent(env, from, {
      to: order.customerEmail!,
      subject: `Order cancelled — ${order.orderNumber} (${project.name})`,
      html: buildEmailHtml({
        variant: "cancelled",
        shopName: project.name,
        orderNumber: order.orderNumber,
        amount: order.totalAmount.toFixed(2),
        currency: "EUR",
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        replyEmail: replyTo,
      }),
      recipientType: "customer",
      idempotencyKey: `order-email:${project.id}:${order.orderId}:cancelled`,
      replyTo,
    });
  } catch (error) {
    console.error("[order-email] cancel send failed:", error);
  }
}

export async function sendOrderRefundedEmail(
  env: Env,
  project: Project,
  order: { orderId: string; orderNumber: string; totalAmount: number; customerEmail?: string; customerName?: string; refundId?: string },
): Promise<void> {
  const { from, replyTo } = resolveSender(project, env);
  if (!from || !env.RESEND_API_KEY) return;

  const shouldSendCustomer = project.orderCustomerEmailsEnabled !== false;
  if (!shouldSendCustomer || !isValidEmail(order.customerEmail)) return;

  try {
    await sendIdempotent(env, from, {
      to: order.customerEmail!,
      subject: `Refund processed — ${order.orderNumber} (${project.name})`,
      html: buildEmailHtml({
        variant: "refunded",
        shopName: project.name,
        orderNumber: order.orderNumber,
        amount: order.totalAmount.toFixed(2),
        currency: "EUR",
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        refundId: order.refundId,
        replyEmail: replyTo,
      }),
      recipientType: "customer",
      idempotencyKey: `order-email:${project.id}:${order.orderId}:refunded`,
      replyTo,
    });
  } catch (error) {
    console.error("[order-email] refund send failed:", error);
  }
}
