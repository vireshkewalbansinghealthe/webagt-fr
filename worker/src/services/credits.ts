/**
 * worker/src/services/credits.ts
 *
 * Credit system for managing AI generation quotas.
 * Each user gets a limited number of credits per billing period.
 * Different AI models cost different amounts of credits.
 *
 * Key features:
 * - Lazy period reset: credits automatically reset when the period expires
 * - Plan support: free (50 credits/month) and pro (unlimited)
 * - Sentinel value: remaining === -1 means unlimited (Pro plan)
 * - Webhook-friendly: initializeCredits, upgradePlan, downgradePlan
 *
 * Credit storage in KV:
 *   Key:   credits:{userId}
 *   Value: { remaining, total, plan, periodStart, periodEnd }
 *
 * Used by: worker/src/routes/chat.ts, worker/src/routes/credits.ts
 */

import type { Env } from "../types";

/**
 * Shape of the credits record stored in KV.
 *
 * @property remaining - Credits left in the current period (-1 = unlimited)
 * @property total - Total credits allocated per period (50 for free)
 * @property plan - User's current plan ("free" or "pro")
 * @property periodStart - ISO 8601 start of the current billing period
 * @property periodEnd - ISO 8601 end of the current billing period
 */
export interface UserCredits {
  remaining: number;
  total: number;
  plan: "free" | "pro";
  periodStart: string;
  periodEnd: string;
}

/**
 * Default credits for new free-tier users.
 */
const DEFAULT_FREE_CREDITS = 50;

/**
 * Sentinel value for unlimited credits (Pro plan).
 * When remaining is -1, credit checks always pass.
 */
const UNLIMITED_CREDITS = -1;

/**
 * Maximum number of projects for free-tier users.
 */
export const FREE_PROJECT_LIMIT = 3;

/**
 * Creates a new billing period starting now and ending one month from now.
 *
 * @returns Object with periodStart and periodEnd ISO strings
 */
function createBillingPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  return {
    periodStart: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

/**
 * Checks if the current billing period has expired and resets credits if so.
 * This is the "lazy evaluation" approach — since Workers don't have cron jobs
 * on the free tier, we check the period on every credit lookup.
 *
 * Pro users keep their unlimited status, but their period still resets
 * for tracking purposes.
 *
 * @param credits - The current credits record
 * @param userId - Clerk user ID (for writing back to KV)
 * @param env - Worker environment with KV binding
 * @returns The credits record (possibly reset)
 */
async function checkAndResetPeriod(
  credits: UserCredits,
  userId: string,
  env: Env
): Promise<UserCredits> {
  const now = new Date();
  const periodEnd = new Date(credits.periodEnd);

  // Period hasn't expired yet
  if (now < periodEnd) {
    return credits;
  }

  // Period expired — reset credits
  const newPeriod = createBillingPeriod();

  const resetCredits: UserCredits = {
    ...credits,
    // Pro users stay unlimited, free users get their credits back
    remaining:
      credits.plan === "pro" ? UNLIMITED_CREDITS : credits.total,
    periodStart: newPeriod.periodStart,
    periodEnd: newPeriod.periodEnd,
  };

  await env.METADATA.put(
    `credits:${userId}`,
    JSON.stringify(resetCredits)
  );

  return resetCredits;
}

/**
 * Retrieves the user's current credit balance from KV.
 * If no credits record exists (new user), initializes with free tier defaults.
 * Also performs lazy period reset if the billing period has expired.
 *
 * @param userId - Clerk user ID
 * @param env - Worker environment with KV binding
 * @returns The user's credit record (possibly freshly initialized or reset)
 */
export async function getCredits(
  userId: string,
  env: Env
): Promise<UserCredits> {
  const credits = await env.METADATA.get<UserCredits>(
    `credits:${userId}`,
    "json"
  );

  if (credits) {
    // Check if billing period expired and reset if needed
    return checkAndResetPeriod(credits, userId, env);
  }

  // Initialize credits for new users
  return initializeCredits(userId, "free", env);
}

/**
 * Initializes a credits record for a new user.
 * Called on first API request or when a webhook creates a new subscription.
 *
 * @param userId - Clerk user ID
 * @param plan - The user's plan ("free" or "pro")
 * @param env - Worker environment with KV binding
 * @returns The newly created credit record
 */
export async function initializeCredits(
  userId: string,
  plan: "free" | "pro",
  env: Env
): Promise<UserCredits> {
  const period = createBillingPeriod();

  const newCredits: UserCredits = {
    remaining: plan === "pro" ? UNLIMITED_CREDITS : DEFAULT_FREE_CREDITS,
    total: DEFAULT_FREE_CREDITS,
    plan,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  };

  await env.METADATA.put(`credits:${userId}`, JSON.stringify(newCredits));
  return newCredits;
}

/**
 * Checks whether the user has enough credits for a generation.
 *
 * @param userId - Clerk user ID
 * @param creditCost - Number of credits required for this model
 * @param env - Worker environment with KV binding
 * @returns Object with `allowed` boolean and current credits info
 */
export async function checkCredits(
  userId: string,
  creditCost: number,
  env: Env
): Promise<{ allowed: boolean; credits: UserCredits }> {
  const credits = await getCredits(userId, env);

  // Pro users with unlimited credits always pass
  if (credits.remaining === UNLIMITED_CREDITS) {
    return { allowed: true, credits };
  }

  // Check if enough credits remain
  return {
    allowed: credits.remaining >= creditCost,
    credits,
  };
}

/**
 * Deducts credits after a successful AI generation.
 * Only deducts AFTER the generation completes — if the AI call fails,
 * the user doesn't lose credits.
 *
 * @param userId - Clerk user ID
 * @param creditCost - Number of credits to deduct
 * @param env - Worker environment with KV binding
 * @returns Updated credit balance
 */
export async function deductCredits(
  userId: string,
  creditCost: number,
  env: Env
): Promise<UserCredits> {
  const credits = await getCredits(userId, env);

  // Don't deduct from unlimited (Pro) users
  if (credits.remaining === UNLIMITED_CREDITS) {
    return credits;
  }

  credits.remaining = Math.max(0, credits.remaining - creditCost);
  await env.METADATA.put(`credits:${userId}`, JSON.stringify(credits));

  return credits;
}

/**
 * Upgrades a user to Pro plan.
 * Sets remaining to -1 (unlimited) and updates plan to "pro".
 * Called by the billing webhook when a subscription is created/updated.
 *
 * @param userId - Clerk user ID
 * @param env - Worker environment with KV binding
 * @returns Updated credit record
 */
export async function upgradePlan(
  userId: string,
  env: Env
): Promise<UserCredits> {
  const credits = await getCredits(userId, env);

  const upgraded: UserCredits = {
    ...credits,
    plan: "pro",
    remaining: UNLIMITED_CREDITS,
  };

  await env.METADATA.put(`credits:${userId}`, JSON.stringify(upgraded));
  return upgraded;
}

/**
 * Downgrades a user from Pro back to Free plan.
 * Resets credits to the free tier amount and starts a new billing period.
 * Called by the billing webhook when a subscription is cancelled.
 *
 * @param userId - Clerk user ID
 * @param env - Worker environment with KV binding
 * @returns Updated credit record
 */
export async function downgradePlan(
  userId: string,
  env: Env
): Promise<UserCredits> {
  const period = createBillingPeriod();

  const downgraded: UserCredits = {
    remaining: DEFAULT_FREE_CREDITS,
    total: DEFAULT_FREE_CREDITS,
    plan: "free",
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  };

  await env.METADATA.put(`credits:${userId}`, JSON.stringify(downgraded));
  return downgraded;
}
