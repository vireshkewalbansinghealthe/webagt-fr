/**
 * Credit system for Fly.io — uses CloudflareKV REST API.
 * Daily quotas: Free 1/day, Pro 10/day.
 */

import type { CloudflareKV } from "./cloudflare-kv.js";

export interface UserCredits {
  remaining: number;
  total: number;
  plan: "free" | "pro";
  periodStart: string;
  periodEnd: string;
}

export const FREE_DAILY_CREDITS = 1;
export const PRO_DAILY_CREDITS = 10;
export const FREE_PROJECT_LIMIT = 3;

function createDailyPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { periodStart: now.toISOString(), periodEnd: periodEnd.toISOString() };
}

function dailyCreditsForPlan(plan: "free" | "pro"): number {
  return plan === "pro" ? PRO_DAILY_CREDITS : FREE_DAILY_CREDITS;
}

async function checkAndResetPeriod(
  credits: UserCredits,
  userId: string,
  kv: CloudflareKV,
): Promise<UserCredits> {
  const now = new Date();
  const periodEnd = new Date(credits.periodEnd);
  if (now < periodEnd) return credits;

  const newPeriod = createDailyPeriod();
  const daily = dailyCreditsForPlan(credits.plan);
  const reset: UserCredits = {
    ...credits,
    remaining: daily,
    total: daily,
    periodStart: newPeriod.periodStart,
    periodEnd: newPeriod.periodEnd,
  };
  await kv.put(`credits:${userId}`, JSON.stringify(reset));
  return reset;
}

export async function getCredits(userId: string, kv: CloudflareKV): Promise<UserCredits> {
  const stored = await kv.get<UserCredits>(`credits:${userId}`, "json");
  if (stored) {
    // Migrate legacy unlimited (-1) Pro users
    if (stored.remaining === -1) {
      const fixed: UserCredits = {
        ...stored,
        remaining: PRO_DAILY_CREDITS,
        total: PRO_DAILY_CREDITS,
        plan: "pro",
      };
      await kv.put(`credits:${userId}`, JSON.stringify(fixed));
      return checkAndResetPeriod(fixed, userId, kv);
    }
    return checkAndResetPeriod(stored, userId, kv);
  }
  return initializeCredits(userId, "free", kv);
}

export async function initializeCredits(
  userId: string,
  plan: "free" | "pro",
  kv: CloudflareKV,
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
  await kv.put(`credits:${userId}`, JSON.stringify(newCredits));
  return newCredits;
}

export async function checkCredits(
  userId: string,
  creditCost: number,
  kv: CloudflareKV,
): Promise<{ allowed: boolean; credits: UserCredits }> {
  const credits = await getCredits(userId, kv);
  return { allowed: credits.remaining >= creditCost, credits };
}

export async function deductCredits(
  userId: string,
  creditCost: number,
  kv: CloudflareKV,
): Promise<UserCredits> {
  const credits = await getCredits(userId, kv);
  credits.remaining = Math.max(0, credits.remaining - creditCost);
  await kv.put(`credits:${userId}`, JSON.stringify(credits));
  return credits;
}
