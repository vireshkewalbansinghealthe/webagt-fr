"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import confetti from "canvas-confetti";
import { Coins, Sparkles, Check, Loader2, Ticket, Gift } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createApiClient, bustCreditsCache, type CreditPack } from "@/lib/api-client";

interface BuyCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPurchaseComplete?: () => void;
  currentCredits: number;
}

const FALLBACK_PACKS: CreditPack[] = [
  { id: "starter", credits: 100, priceUsd: 4.99, priceCents: 499, label: "Starter" },
  { id: "popular", credits: 500, priceUsd: 19.99, priceCents: 1999, label: "Popular", popular: true },
  { id: "pro", credits: 1500, priceUsd: 49.99, priceCents: 4999, label: "Pro" },
];

export function BuyCreditsModal({
  open,
  onOpenChange,
  onPurchaseComplete,
  currentCredits,
}: BuyCreditsModalProps) {
  const { getToken } = useAuth();
  const [packs, setPacks] = useState<CreditPack[]>(FALLBACK_PACKS);
  const [selectedPack, setSelectedPack] = useState<string>("popular");
  const [isLoading, setIsLoading] = useState(false);

  // Promo code state
  const [showPromoInput, setShowPromoInput] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ success: boolean; message: string; credits?: number } | null>(null);

  useEffect(() => {
    if (!open) {
      setPromoResult(null);
      setPromoCode("");
      setShowPromoInput(false);
      return;
    }
    const loadPacks = async () => {
      try {
        const client = createApiClient(getToken);
        const config = await client.billing.getConfig();
        if (config.creditPacks?.length) {
          setPacks(config.creditPacks);
        }
      } catch {
        // use fallback packs
      }
    };
    loadPacks();
  }, [open, getToken]);

  const handleBuy = useCallback(async () => {
    setIsLoading(true);
    try {
      const client = createApiClient(getToken);
      const { url } = await client.billing.buyCredits(selectedPack);
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error("Failed to start checkout:", err);
      setIsLoading(false);
    }
  }, [getToken, selectedPack]);

  const handleRedeemCode = useCallback(async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoResult(null);
    try {
      const client = createApiClient(getToken);
      const result = await client.credits.redeemCode(promoCode.trim());
      setPromoResult({
        success: true,
        message: `+${result.creditsAdded} credits added!`,
        credits: result.creditsAdded,
      });
      setPromoCode("");
      bustCreditsCache();
      onPurchaseComplete?.();
      fireConfetti();
    } catch (err: any) {
      const message = err?.message || "Invalid code. Please try again.";
      setPromoResult({ success: false, message });
    } finally {
      setPromoLoading(false);
    }
  }, [getToken, promoCode, onPurchaseComplete]);

  const fireConfetti = () => {
    const end = Date.now() + 600;
    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  };

  const perCredit = (pack: CreditPack) =>
    (pack.priceUsd / pack.credits).toFixed(3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-5 text-primary" />
            Buy Credits
          </DialogTitle>
          <DialogDescription>
            You have <strong>{currentCredits}</strong> credits remaining.
            Each AI generation uses ~4-10 credits depending on complexity.
          </DialogDescription>
        </DialogHeader>

        {/* Credit packs */}
        <div className="mt-2 flex flex-col gap-3">
          {packs.map((pack) => (
            <button
              key={pack.id}
              onClick={() => setSelectedPack(pack.id)}
              className={cn(
                "relative flex items-center justify-between rounded-lg border-2 px-4 py-3 text-left transition-all",
                selectedPack === pack.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40 hover:bg-accent/50",
              )}
            >
              {pack.popular && (
                <span className="absolute -top-2.5 left-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Most Popular
                </span>
              )}

              <div className="flex items-center gap-3">
                {selectedPack === pack.id ? (
                  <div className="flex size-5 items-center justify-center rounded-full bg-primary">
                    <Check className="size-3 text-primary-foreground" />
                  </div>
                ) : (
                  <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                )}
                <div>
                  <p className="text-sm font-medium">{pack.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {pack.credits} credits · ${perCredit(pack)}/credit
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold">${pack.priceUsd.toFixed(2)}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Purchase button */}
        <div className="mt-4 flex flex-col gap-2">
          <Button
            className="w-full gap-2"
            onClick={handleBuy}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {isLoading ? "Redirecting to checkout…" : "Continue to Payment"}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Secure payment via Stripe · Card & iDEAL accepted
          </p>
        </div>

        {/* Divider */}
        <div className="relative mt-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-3 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Promo code section */}
        {!showPromoInput ? (
          <button
            onClick={() => setShowPromoInput(true)}
            className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <Ticket className="size-3.5" />
            Have an invitation or promo code?
          </button>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Input
                placeholder="Enter code"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  setPromoResult(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleRedeemCode()}
                className="h-9 font-mono uppercase tracking-wider"
                maxLength={20}
                autoFocus
              />
              <Button
                size="sm"
                className="h-9 gap-1.5 px-4"
                onClick={handleRedeemCode}
                disabled={promoLoading || !promoCode.trim()}
              >
                {promoLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Gift className="size-3.5" />
                )}
                Redeem
              </Button>
            </div>

            {/* Result feedback */}
            {promoResult && (
              <p className={cn(
                "text-xs font-medium flex items-center gap-1.5",
                promoResult.success ? "text-emerald-500" : "text-destructive"
              )}>
                {promoResult.success ? (
                  <Check className="size-3.5" />
                ) : null}
                {promoResult.message}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
