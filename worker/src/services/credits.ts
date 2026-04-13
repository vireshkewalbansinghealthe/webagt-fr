/**
 * worker/src/services/credits.ts
 *
 * Simple credit-balance system — no plans, no daily resets.
 * Users start with a welcome bonus and buy credit packs when they run low.
 *
 * Storage in KV:
 *   Key:   credits:{userId}
 *   Value: { remaining, total }
 */

import type { Env } from "../types";

export interface UserCredits {
  remaining: number;
  total: number;
  /** @deprecated kept for backwards compat — always "pro" now */
  plan: "pro";
  /** Cumulative Anthropic/AI API cost in USD */
  apiSpendUsd?: number;
  /** Last time credits were modified */
  updatedAt?: string;
}

/** Credits given to brand-new users (0 = must buy or use invite code) */
export const WELCOME_CREDITS = 0;

/** Get credits for a user, initialising if needed. */
export async function getCredits(userId: string, env: Env): Promise<UserCredits> {
  const stored = await env.METADATA.get<UserCredits>(`credits:${userId}`, "json");

  if (stored) {
    // Migrate legacy records that still have plan/periodStart/periodEnd
    if ((stored as any).periodStart || (stored as any).plan === "free") {
      const migrated: UserCredits = {
        remaining: stored.remaining,
        total: stored.total,
        plan: "pro",
      };
      await env.METADATA.put(`credits:${userId}`, JSON.stringify(migrated));
      return migrated;
    }
    return { ...stored, plan: "pro" };
  }

  return initializeCredits(userId, env);
}

/** Initialise a fresh credits record for a new user. */
export async function initializeCredits(
  userId: string,
  env: Env,
  startingCredits?: number,
): Promise<UserCredits> {
  const credits = startingCredits ?? WELCOME_CREDITS;

  const newCredits: UserCredits = {
    remaining: credits,
    total: credits,
    plan: "pro",
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
  env: Env,
  apiCostUsd?: number,
): Promise<UserCredits> {
  const credits = await getCredits(userId, env);
  credits.remaining = Math.max(0, credits.remaining - creditCost);
  credits.updatedAt = new Date().toISOString();
  if (apiCostUsd !== undefined) {
    credits.apiSpendUsd = (credits.apiSpendUsd ?? 0) + apiCostUsd;
  }
  await env.METADATA.put(`credits:${userId}`, JSON.stringify(credits));
  return credits;
}

/** Add credits to a user's balance (e.g. after purchasing a credit pack). */
export async function addCredits(
  userId: string,
  amount: number,
  env: Env
): Promise<UserCredits> {
  const credits = await getCredits(userId, env);
  credits.remaining += amount;
  credits.total += amount;
  credits.updatedAt = new Date().toISOString();
  await env.METADATA.put(`credits:${userId}`, JSON.stringify(credits));
  return credits;
}

/** @deprecated — kept for backward compat, now just calls addCredits */
export async function upgradePlan(userId: string, env: Env): Promise<UserCredits> {
  return addCredits(userId, 100, env);
}

/** @deprecated — no-op, kept for backward compat */
export async function downgradePlan(userId: string, env: Env): Promise<UserCredits> {
  return getCredits(userId, env);
}
