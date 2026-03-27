import Stripe from "stripe";
import type { Env } from "../types";
import type { Project } from "../types/project";

export type StripeMode = "test" | "live";
export type PaymentMode = "off" | "test" | "live";

export type StripePublishConfig = {
  mode: PaymentMode;
  accountId?: string;
  secretKey?: string;
  publishableKey?: string;
};

export function getProjectPaymentMode(project?: Project | null): PaymentMode {
  return project?.paymentMode ?? "off";
}

export function getStripeAccountIdForMode(project: Project, mode: StripeMode): string | undefined {
  if (mode === "live") {
    if (project.stripeLiveAccountId) {
      return project.stripeLiveAccountId;
    }
    return project.stripeTestAccountId ? undefined : project.stripeAccountId;
  }
  if (project.stripeTestAccountId) {
    return project.stripeTestAccountId;
  }
  return project.stripeLiveAccountId ? undefined : project.stripeAccountId;
}

export function resolveStripeMode(rawMode?: string): StripeMode {
  return rawMode === "live" ? "live" : "test";
}

export function getStripeConfig(env: Env, mode: StripeMode) {
  const secretKey =
    mode === "live"
      ? env.STRIPE_SECRET_KEY_LIVE || env.STRIPE_SECRET_KEY
      : env.STRIPE_SECRET_KEY_TEST || env.STRIPE_SECRET_KEY;
  const publishableKey =
    mode === "live"
      ? env.STRIPE_PUBLISHABLE_KEY_LIVE || env.STRIPE_PUBLISHABLE_KEY
      : env.STRIPE_PUBLISHABLE_KEY_TEST || env.STRIPE_PUBLISHABLE_KEY;
  const webhookSecret =
    mode === "live"
      ? env.STRIPE_WEBHOOK_SECRET_LIVE || env.STRIPE_WEBHOOK_SECRET
      : env.STRIPE_WEBHOOK_SECRET_TEST || env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) {
    throw new Error(`Stripe ${mode} secret key is not configured.`);
  }

  return { secretKey, publishableKey, webhookSecret };
}

export function getStripeClient(env: Env, mode: StripeMode): Stripe {
  const { secretKey } = getStripeConfig(env, mode);
  return new Stripe(secretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

export function hasTransferCapability(account: Stripe.Account): boolean {
  const capabilities = (account.capabilities ?? {}) as Record<string, string | null | undefined>;
  return capabilities.transfers === "active" || capabilities.legacy_payments === "active";
}

export function buildStripeAccountStatus(account: Stripe.Account) {
  const currentlyDue = account.requirements?.currently_due ?? [];
  const eventuallyDue = account.requirements?.eventually_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];
  const pendingVerification = account.requirements?.pending_verification ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;
  const transferCapabilityActive = hasTransferCapability(account);
  const isReady =
    account.details_submitted &&
    account.charges_enabled &&
    account.payouts_enabled &&
    transferCapabilityActive &&
    currentlyDue.length === 0 &&
    pastDue.length === 0 &&
    !disabledReason;

  return {
    id: account.id,
    type: account.type,
    details_submitted: account.details_submitted,
    charges_enabled: account.charges_enabled,
    payouts_enabled: account.payouts_enabled,
    capabilities: account.capabilities,
    requirements: {
      currently_due: currentlyDue,
      eventually_due: eventuallyDue,
      past_due: pastDue,
      pending_verification: pendingVerification,
      disabled_reason: disabledReason,
    },
    transfer_capability_active: transferCapabilityActive,
    requires_action: !isReady,
    is_ready: isReady,
  };
}

export async function createStripeConnectedAccount(env: Env, mode: StripeMode): Promise<Stripe.Account> {
  const stripe = getStripeClient(env, mode);
  return stripe.accounts.create({
    type: "express",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });
}

export function getStripePublishConfig(env: Env, project: Project): StripePublishConfig {
  const mode = getProjectPaymentMode(project);
  if (mode === "off") {
    return { mode };
  }

  const accountId = getStripeAccountIdForMode(project, mode);
  const secretKey =
    mode === "live"
      ? env.STRIPE_SECRET_KEY_LIVE || env.STRIPE_SECRET_KEY
      : env.STRIPE_SECRET_KEY_TEST || env.STRIPE_SECRET_KEY;
  const publishableKey =
    mode === "live"
      ? env.STRIPE_PUBLISHABLE_KEY_LIVE || env.STRIPE_PUBLISHABLE_KEY
      : env.STRIPE_PUBLISHABLE_KEY_TEST || env.STRIPE_PUBLISHABLE_KEY;

  return { mode, accountId, secretKey, publishableKey };
}

function buildCoolifyEnvData(env: Env, project: Project) {
  const stripeConfig = getStripePublishConfig(env, project);
  const baseVars = [
    { key: "VITE_PROJECT_ID", value: project.id },
    { key: "VITE_PAYMENT_MODE", value: stripeConfig.mode },
    { key: "PLATFORM_COMMISSION_PERCENT", value: env.PLATFORM_COMMISSION_PERCENT || "25" },
  ];

  if (
    stripeConfig.mode !== "off" &&
    stripeConfig.accountId &&
    stripeConfig.secretKey &&
    stripeConfig.publishableKey
  ) {
    baseVars.push(
      { key: "STRIPE_SECRET_KEY", value: stripeConfig.secretKey },
      { key: "STRIPE_ACCOUNT_ID", value: stripeConfig.accountId },
      { key: "VITE_STRIPE_PUBLISHABLE_KEY", value: stripeConfig.publishableKey },
    );
  }

  return [
    ...baseVars.map((entry) => ({ ...entry, is_build_time: false, is_preview: false })),
    ...baseVars.map((entry) => ({ ...entry, is_build_time: false, is_preview: true })),
  ];
}

export async function syncCoolifyStripeConfiguration(env: Env, project: Project) {
  if (!project.deployment_uuid) return null;
  if (!env.COOLIFY_API_KEY) {
    throw new Error("Coolify API key is not configured.");
  }

  const coolifyUrl = env.COOLIFY_URL || "https://dock.4esh.nl";
  const headers = {
    Authorization: `Bearer ${env.COOLIFY_API_KEY}`,
    "Content-Type": "application/json",
  };

  const envRes = await fetch(`${coolifyUrl}/api/v1/applications/${project.deployment_uuid}/envs/bulk`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ data: buildCoolifyEnvData(env, project) }),
  });

  if (!envRes.ok) {
    throw new Error(`Failed to sync Stripe env vars: ${await envRes.text()}`);
  }

  const deployRes = await fetch(`${coolifyUrl}/api/v1/deploy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ uuid: project.deployment_uuid }),
  });

  if (!deployRes.ok) {
    throw new Error(`Failed to trigger deployment: ${await deployRes.text()}`);
  }

  const deployData = await deployRes.json() as any;
  return deployData?.deployments?.[0]?.deployment_uuid || null;
}
