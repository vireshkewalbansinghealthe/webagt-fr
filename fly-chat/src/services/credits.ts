/**
 * Credit system adapted for Fly.io — uses CloudflareKV REST API
 * instead of KVNamespace bindings.
 */

import type { CloudflareKV } from "./cloudflare-kv.js";

export interface UserCredits {
  remaining: number;
  total: number;
  plan: "free" | "pro";
  periodStart: string;
  periodEnd: string;
}

const DEFAULT_FREE_CREDITS = 50;
const UNLIMITED_CREDITS = -1;

function createBillingPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  return {
    periodStart: now.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

async function checkAndResetPeriod(
  credits: UserCredits,
  userId: string,
  kv: CloudflareKV,
): Promise<UserCredits> {
  const now = new Date();
  const periodEnd = new Date(credits.periodEnd);

  if (now < periodEnd) return credits;

  const newPeriod = createBillingPeriod();
  const resetCredits: UserCredits = {
    ...credits,
    remaining: credits.plan === "pro" ? UNLIMITED_CREDITS : credits.total,
    periodStart: newPeriod.periodStart,
    periodEnd: newPeriod.periodEnd,
  };

  await kv.put(`credits:${userId}`, JSON.stringify(resetCredits));
  return resetCredits;
}

export async function getCredits(userId: string, kv: CloudflareKV): Promise<UserCredits> {
  const credits = await kv.get<UserCredits>(`credits:${userId}`, "json");
  if (credits) return checkAndResetPeriod(credits, userId, kv);
  return initializeCredits(userId, "free", kv);
}

export async function initializeCredits(
  userId: string,
  plan: "free" | "pro",
  kv: CloudflareKV,
): Promise<UserCredits> {
  const period = createBillingPeriod();
  const newCredits: UserCredits = {
    remaining: plan === "pro" ? UNLIMITED_CREDITS : DEFAULT_FREE_CREDITS,
    total: DEFAULT_FREE_CREDITS,
    plan,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
  };
  await kv.put(`credits:${userId}`, JSON.stringify(newCredits));
  return newCredits;
}

export async function checkCredits(
  userId: string,
  creditCost: number,
  kv: CloudflareKV,
): Promise<{ allowed: boolean; credits: UserCredits }> {
  const credits = await getCredits(userId, kv);
  if (credits.remaining === UNLIMITED_CREDITS) {
    return { allowed: true, credits };
  }
  return { allowed: credits.remaining >= creditCost, credits };
}

export async function deductCredits(
  userId: string,
  creditCost: number,
  kv: CloudflareKV,
): Promise<UserCredits> {
  const credits = await getCredits(userId, kv);
  if (credits.remaining === UNLIMITED_CREDITS) return credits;
  credits.remaining = Math.max(0, credits.remaining - creditCost);
  await kv.put(`credits:${userId}`, JSON.stringify(credits));
  return credits;
}
