/**
 * components/editor/credits-display.tsx
 *
 * Credit counter shown in the app sidebar.
 * Displays the user's remaining credits and a "Buy Credits" button
 * when running low (< 10 credits).
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { createApiClient, bustCreditsCache } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { BuyCreditsModal } from "./buy-credits-modal";

interface CreditData {
  remaining: number;
  total: number;
}

const LOW_CREDITS_THRESHOLD = 10;

export function CreditsDisplay() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBuyModal, setShowBuyModal] = useState(false);

  const loadCredits = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const data = await client.credits.get();
      setCredits({ remaining: data.remaining, total: data.total });
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

  const handlePurchaseComplete = useCallback(() => {
    bustCreditsCache();
    loadCredits();
  }, [loadCredits]);

  if (isLoading) {
    return (
      <div className="px-3 pb-2">
        <div className="rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <Skeleton className="mb-2 h-4 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    );
  }

  if (!credits) {
    return (
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <Coins className="size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">Credits unavailable</p>
        </div>
      </div>
    );
  }

  const isLow = credits.remaining < LOW_CREDITS_THRESHOLD;
  const isEmpty = credits.remaining === 0;

  return (
    <>
      <div className="px-3 pb-2" data-tour="credits">
        <div className={cn(
          "rounded-lg px-3 py-2.5 transition-colors",
          isEmpty
            ? "bg-destructive/10 border border-destructive/20"
            : isLow
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-sidebar-accent/50"
        )}>
          {/* Credit count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Coins className={cn(
                "size-4",
                isEmpty ? "text-destructive" : isLow ? "text-amber-500" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-sm font-semibold tabular-nums",
                isEmpty ? "text-destructive" : isLow ? "text-amber-500" : ""
              )}>
                {credits.remaining}
              </span>
              <span className="text-xs text-muted-foreground">credits</span>
            </div>
          </div>

          {/* Low credits warning + buy button */}
          {isLow && (
            <div className="mt-2">
              <p className="mb-1.5 text-xs text-muted-foreground">
                {isEmpty ? "You're out of credits" : "Running low on credits"}
              </p>
              <Button
                size="sm"
                className={cn(
                  "h-7 w-full gap-1 text-xs",
                  isEmpty ? "bg-destructive hover:bg-destructive/90" : ""
                )}
                onClick={() => setShowBuyModal(true)}
              >
                <Plus className="size-3" />
                Buy Credits
              </Button>
            </div>
          )}

          {/* Always show buy button for non-low users too, just subtler */}
          {!isLow && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1.5 h-7 w-full gap-1 text-xs text-muted-foreground"
              onClick={() => setShowBuyModal(true)}
            >
              <Plus className="size-3" />
              Buy Credits
            </Button>
          )}
        </div>
      </div>

      <BuyCreditsModal
        open={showBuyModal}
        onOpenChange={setShowBuyModal}
        onPurchaseComplete={handlePurchaseComplete}
        currentCredits={credits.remaining}
      />
    </>
  );
}
