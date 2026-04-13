/**
 * Credit system for Fly.io — uses CloudflareKV REST API.
 * Simple balance model — no plans, no daily resets.
 */

import type { CloudflareKV } from "./cloudflare-kv.js";

export interface UserCredits {
  remaining: number;
  total: number;
  plan: "pro";
  apiSpendUsd?: number;
  updatedAt?: string;
}

export const WELCOME_CREDITS = 0;

export async function getCredits(userId: string, kv: CloudflareKV): Promise<UserCredits> {
  const stored = await kv.get<UserCredits>(`credits:${userId}`, "json");
  if (stored) {
    // Migrate legacy records
    if ((stored as any).periodStart || (stored as any).plan === "free") {
      const migrated: UserCredits = {
        remaining: stored.remaining,
        total: stored.total,
        plan: "pro",
      };
      await kv.put(`credits:${userId}`, JSON.stringify(migrated));
      return migrated;
    }
    return { ...stored, plan: "pro" };
  }
  return initializeCredits(userId, kv);
}

export async function initializeCredits(
  userId: string,
  kv: CloudflareKV,
  startingCredits?: number,
): Promise<UserCredits> {
  const credits = startingCredits ?? WELCOME_CREDITS;
  const newCredits: UserCredits = {
    remaining: credits,
    total: credits,
    plan: "pro",
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
  apiCostUsd?: number,
): Promise<UserCredits> {
  const credits = await getCredits(userId, kv);
  credits.remaining = Math.max(0, credits.remaining - creditCost);
  credits.updatedAt = new Date().toISOString();
  if (apiCostUsd !== undefined) {
    credits.apiSpendUsd = (credits.apiSpendUsd ?? 0) + apiCostUsd;
  }
  await kv.put(`credits:${userId}`, JSON.stringify(credits));
  return credits;
}

export async function addCredits(
  userId: string,
  amount: number,
  kv: CloudflareKV,
): Promise<UserCredits> {
  const credits = await getCredits(userId, kv);
  credits.remaining += amount;
  credits.total += amount;
  credits.updatedAt = new Date().toISOString();
  await kv.put(`credits:${userId}`, JSON.stringify(credits));
  return credits;
}
