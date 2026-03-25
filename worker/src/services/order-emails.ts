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
        subject: `New order received (${details.orderNumber})`,
        html: `<p>Hi,</p><p>You received a new order in <strong>${project.name}</strong>.</p><ul><li>Order: ${details.orderNumber}</li><li>Total: ${details.amount} ${details.currency}</li><li>Customer: ${details.customerName || details.customerEmail || "Guest"}</li></ul>`,
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
      subject: `Order confirmed (${details.orderNumber})`,
      html: `<p>Thanks for your order from <strong>${project.name}</strong>.</p><p>Your payment has been received successfully.</p><ul><li>Order: ${details.orderNumber}</li><li>Total: ${details.amount} ${details.currency}</li></ul><p>We will email you with updates about your order.</p>`,
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
