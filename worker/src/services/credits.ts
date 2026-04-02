/**
 * worker/src/services/credits.ts
 *
 * Credit system — daily quotas per plan:
 *   Free:  1 credit / day   (websites only, no webshop)
 *   Pro:  10 credits / day  (websites + webshop)
 *
 * Credits reset automatically every 24 hours (lazy evaluation on lookup).
 * Credit packs (one-time purchases) are added on top of the daily quota.
 *
 * Storage in KV:
 *   Key:   credits:{userId}
 *   Value: { remaining, total, plan, periodStart, periodEnd }
 */

import type { Env } from "../types";

export interface UserCredits {
  remaining: number;
  total: number;
  plan: "free" | "pro";
  periodStart: string;
  periodEnd: string;
}

/** Daily credits for free plan */
export const FREE_DAILY_CREDITS = 1;

/** Daily credits for pro plan */
export const PRO_DAILY_CREDITS = 10;

/** Max projects for free-tier users */
export const FREE_PROJECT_LIMIT = 3;

/** Creates a billing period that ends 24 hours from now */
function createDailyPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    periodStart: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

function dailyCreditsForPlan(plan: "free" | "pro"): number {
  return plan === "pro" ? PRO_DAILY_CREDITS : FREE_DAILY_CREDITS;
}

/**
 * Lazy daily reset: if the period has expired, give the user a fresh day of credits.
 * Called on every credit lookup.
 */
async function checkAndResetPeriod(
  credits: UserCredits,
  userId: string,
  env: Env
): Promise<UserCredits> {
  const now = new Date();
  const periodEnd = new Date(credits.periodEnd);

  if (now < periodEnd) return credits;

  // Period expired — start a new day
  const newPeriod = createDailyPeriod();
  const daily = dailyCreditsForPlan(credits.plan);

  const reset: UserCredits = {
    ...credits,
    remaining: daily,
    total: daily,
    periodStart: newPeriod.periodStart,
    periodEnd: newPeriod.periodEnd,
  };

  await env.METADATA.put(`credits:${userId}`, JSON.stringify(reset));
  return reset;
}

/** Get credits for a user, initialising if needed and resetting daily if expired. */
export async function getCredits(userId: string, env: Env): Promise<UserCredits> {
  const stored = await env.METADATA.get<UserCredits>(`credits:${userId}`, "json");

  if (stored) {
    // Legacy Pro users may still have remaining === -1 (unlimited).
    // Treat them as having full Pro credits so the period reset kicks in correctly.
    if (stored.remaining === -1) {
      const fixed: UserCredits = {
        ...stored,
        remaining: PRO_DAILY_CREDITS,
        total: PRO_DAILY_CREDITS,
        plan: "pro",
      };
      await env.METADATA.put(`credits:${userId}`, JSON.stringify(fixed));
      return checkAndResetPeriod(fixed, userId, env);
    }
    return checkAndResetPeriod(stored, userId, env);
  }

  return initializeCredits(userId, "free", env);
}

/** Initialise a fresh credits record for a new user. */
export async function initializeCredits(
  userId: string,
  plan: "free" | "pro",
  env: Env
): Promise<UserCredits> {
  const period = createDailyPeriod();
  const daily = dailyCreditsForPlan(plan);

  const newCredits: UserCredits = {
    remaining: daily,
    total: daily,
    plan,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  };

  await env.METADATA.put(`credits:${userId}`, JSON.stringify(newCredits));
  return newCredits;
}

/** Check if the user has enough credits for a generation. */
export async function checkCredits(
  userId: string,
  creditCost: number,
  env: Env
): Promise<{ allowed: boolean; credits: UserCredits }> {
  const credits = await getCredits(userId, env);
  return {
    allowed: credits.remaining >= creditCost,
    credits,
  };
}

/** Deduct credits after a successful AI generation. */
export async function deductCredits(
  userId: string,
  creditCost: number,
  env: Env
): Promise<UserCredits> {
  const credits = await getCredits(userId, env);
  credits.remaining = Math.max(0, credits.remaining - creditCost);
  await env.METADATA.put(`credits:${userId}`, JSON.stringify(credits));
  return credits;
}

/** Upgrade user to Pro — give a fresh daily quota of 10 credits immediately. */
export async function upgradePlan(userId: string, env: Env): Promise<UserCredits> {
  const existing = await env.METADATA.get<UserCredits>(`credits:${userId}`, "json");
  const period = createDailyPeriod();

  const upgraded: UserCredits = {
    remaining: PRO_DAILY_CREDITS,
    total: PRO_DAILY_CREDITS,
    plan: "pro",
    periodStart: existing?.periodStart ?? period.periodStart,
    periodEnd: period.periodEnd,
  };

  await env.METADATA.put(`credits:${userId}`, JSON.stringify(upgraded));
  return upgraded;
}

/** Downgrade user to Free — 1 credit/day from now. */
export async function downgradePlan(userId: string, env: Env): Promise<UserCredits> {
  const period = createDailyPeriod();

  const downgraded: UserCredits = {
    remaining: FREE_DAILY_CREDITS,
    total: FREE_DAILY_CREDITS,
    plan: "free",
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  };

  await env.METADATA.put(`credits:${userId}`, JSON.stringify(downgraded));
  return downgraded;
}
