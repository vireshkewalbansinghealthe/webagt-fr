/**
 * components/editor/credits-display.tsx
 *
 * Credit counter shown in the app sidebar.
 * Displays the user's remaining credits, plan name, period reset date,
 * and an upgrade CTA button for free users.
 *
 * States:
 * - Free user with credits: Shows progress bar and count (e.g., "45/50")
 * - Free user exhausted: Shows 0/50 with warning styling
 * - Pro user: Shows "Unlimited" with a manage subscription link
 * - Loading: Shows a subtle skeleton
 *
 * The "Upgrade to Pro" button uses Clerk's CheckoutButton to open
 * the checkout drawer directly — no redirect to /pricing needed.
 *
 * Used by: app/(app)/layout.tsx (sidebar)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CheckoutButton } from "@clerk/nextjs/experimental";
import Link from "next/link";
import { CreditCard, Zap, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { createApiClient, bustCreditsCache } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Clerk Pro plan ID — set via NEXT_PUBLIC_CLERK_PRO_PLAN_ID environment variable.
 * Created in the Clerk Dashboard under Billing > Configure.
 * This opens the checkout drawer when the "Upgrade to Pro" button is clicked.
 */
const PRO_PLAN_ID = process.env.NEXT_PUBLIC_CLERK_PRO_PLAN_ID ?? "";

/**
 * Shape of the credit data returned from the API.
 */
interface CreditData {
  remaining: number;
  total: number;
  plan: "free" | "pro";
  periodEnd: string;
  isUnlimited: boolean;
}

/**
 * Calculates the number of days until a given date.
 *
 * @param dateString - ISO 8601 date string
 * @returns Number of days from now (minimum 0)
 */
function daysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * CreditsDisplay renders the credit counter in the sidebar.
 * Fetches credit data on mount and shows the appropriate UI
 * based on the user's plan and remaining balance.
 */
export function CreditsDisplay() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const loadCredits = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const data = await client.credits.get();
      setCredits(data);
    } catch (error) {
      console.error("Failed to load credits:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  /** Fetch credit data on mount */
  useEffect(() => {
    loadCredits();
  }, [loadCredits]);

  /**
   * Called when Clerk checkout completes successfully.
   * Upgrades the plan in KV, then does a full Next.js router refresh so
   * every component on the page picks up the new plan without a manual reload.
   */
  const handleCheckoutSuccess = useCallback(async () => {
    setIsSyncing(true);
    try {
      const client = createApiClient(getToken);
      await client.credits.sync();
    } catch (err) {
      console.error("Failed to sync plan after checkout:", err);
    } finally {
      bustCreditsCache();
      // router.refresh() re-runs all server components and invalidates
      // the Next.js router cache — no manual page reload needed.
      router.refresh();
      setIsSyncing(false);
    }
  }, [getToken, router]);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="px-3 pb-2">
        <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="mb-2 h-2 w-full rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
  }

  // Fallback if credits failed to load
  if (!credits) {
    return (
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <CreditCard className="size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Credits unavailable</p>
        </div>
      </div>
    );
  }

  const isPro = credits.plan === "pro";
  const isExhausted = !isPro && credits.remaining === 0;
  const progressPercent = isPro
    ? 100
    : (credits.remaining / credits.total) * 100;
  const resetDays = daysUntil(credits.periodEnd);

  return (
    <div className="px-3 pb-2">
      <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
        {/* Header row — icon + plan label */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium">Credits</span>
          </div>
          {isPro && (
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <Infinity className="size-3" />
              Unlimited
            </span>
          )}
        </div>

        {/* Progress bar (free users only) */}
        {!isPro && (
          <>
            <Progress
              value={progressPercent}
              className={cn(
                "mb-1.5 h-1.5",
                isExhausted && "[&>div]:bg-destructive"
              )}
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span
                className={cn(isExhausted && "font-medium text-destructive")}
              >
                {credits.remaining}/{credits.total}
              </span>
              <span>Resets in {resetDays}d</span>
            </div>
          </>
        )}

        {/* Plan label */}
        <p className="mt-1.5 text-xs text-muted-foreground">
          {isPro ? "Pro Plan" : "Free Plan"}
        </p>

        {/* CTA button */}
        {isPro ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 w-full text-xs text-muted-foreground"
            asChild
          >
            <Link href="/settings">Manage subscription</Link>
          </Button>
        ) : (
          <CheckoutButton
            planId={PRO_PLAN_ID}
            planPeriod="month"
            onSubscriptionComplete={handleCheckoutSuccess}
          >
            <Button
              size="sm"
              className="mt-2 h-7 w-full gap-1 text-xs"
              disabled={isSyncing}
            >
              <Zap className="size-3" />
              {isSyncing ? "Activating…" : "Upgrade to Pro"}
            </Button>
          </CheckoutButton>
        )}
      </div>
    </div>
  );
}
