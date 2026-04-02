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
 * - Pro user: Shows "Unlimited" with a manage subscription button
 * - Loading: Shows a subtle skeleton
 *
 * The "Upgrade to Pro" button creates a Stripe Checkout Session (with iDEAL
 * support) and redirects the user to Stripe-hosted checkout.
 * After payment, Stripe fires a webhook that upgrades the plan in KV.
 * The dashboard polls /api/credits until plan === "pro".
 *
 * Used by: app/(app)/layout.tsx (sidebar)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { CreditCard, Zap, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { createApiClient, bustCreditsCache } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface CreditData {
  remaining: number;
  total: number;
  plan: "free" | "pro";
  periodEnd: string;
  isUnlimited: boolean;
}

function daysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function CreditsDisplay() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const loadCredits = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const data = await client.credits.get();
      setCredits(data);
    } catch (error) {
      const e = error as { isAuthError?: boolean; isNetworkError?: boolean };
      if (e.isAuthError || e.isNetworkError) return;
      console.error("Failed to load credits:", error);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadCredits();
  }, [loadCredits, isLoaded, isSignedIn]);

  const handleUpgradeClick = useCallback(() => {
    router.push("/pricing");
  }, [router]);

  /**
   * Redirect to Stripe Customer Portal to manage/cancel subscription.
   */
  const handleManageClick = useCallback(async () => {
    setIsRedirecting(true);
    try {
      const client = createApiClient(getToken);
      const { url } = await client.billing.createPortal();
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Failed to open billing portal:", err);
      setIsRedirecting(false);
    }
  }, [getToken]);

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
  const isExhausted = credits.remaining === 0;
  const progressPercent = (credits.remaining / credits.total) * 100;

  // Time until next daily reset
  const resetMs = new Date(credits.periodEnd).getTime() - Date.now();
  const resetHours = Math.max(0, Math.ceil(resetMs / (1000 * 60 * 60)));
  const resetLabel = resetHours <= 1 ? "< 1u" : `${resetHours}u`;

  return (
    <div className="px-3 pb-2">
      <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
        {/* Header row */}
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            <span className="text-xs font-medium">Credits</span>
          </div>
          <span className={cn(
            "text-xs font-medium",
            isPro ? "text-primary" : "text-muted-foreground"
          )}>
            {isPro ? "Pro" : "Free"}
          </span>
        </div>

        {/* Progress bar */}
        <Progress
          value={progressPercent}
          className={cn(
            "mb-1.5 h-1.5",
            isExhausted && "[&>div]:bg-destructive"
          )}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className={cn(isExhausted && "font-medium text-destructive")}>
            {credits.remaining}/{credits.total} vandaag
          </span>
          <span>Reset in {resetLabel}</span>
        </div>

        {/* Plan label */}
        <p className="mt-1.5 text-xs text-muted-foreground">
          {isPro ? "Pro Plan · 10 credits/dag" : "Free Plan · 1 credit/dag"}
        </p>

        {/* CTA button */}
        {isPro ? (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-7 w-full text-xs text-muted-foreground"
            onClick={handleManageClick}
            disabled={isRedirecting}
          >
            {isRedirecting ? "Opening…" : "Manage subscription"}
          </Button>
        ) : (
          <div className="mt-2 flex flex-col gap-1">
            <Button
              size="sm"
              className="h-7 w-full gap-1 text-xs"
              onClick={handleUpgradeClick}
            >
              <Zap className="size-3" />
              Upgrade to Pro
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full gap-1 text-xs text-muted-foreground"
              onClick={() => router.push("/pricing#credits")}
            >
              <Package className="size-3" />
              Koop credits
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
