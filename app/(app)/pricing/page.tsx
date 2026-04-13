"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { createApiClient, type BillingConfig, type CreditPack } from "@/lib/api-client";
import { Check, Package, Star, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  "Full AI-powered website & webshop builder",
  "All AI models (Claude Sonnet, Haiku, DeepSeek)",
  "Live preview & code editor",
  "Version history & rollback",
  "One-click deployment",
  "iDEAL & card payments (Stripe)",
  "Custom domain support",
  "Credits never expire",
];

export default function PricingPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [isRedirecting, setIsRedirecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const data = await client.billing.getConfig();
      setConfig(data);
    } catch {
      setConfig({
        creditPacks: [
          { id: "starter", credits: 100, priceUsd: 4.99, priceCents: 499, label: "Starter" },
          { id: "popular", credits: 500, priceUsd: 19.99, priceCents: 1999, label: "Popular", popular: true },
          { id: "pro", credits: 1500, priceUsd: 49.99, priceCents: 4999, label: "Pro" },
        ],
        pricingFormula: { inputPricePerMillion: 3, outputPricePerMillion: 15, creditUnitCostUsd: 0.06, markup: 1 },
      });
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const handleBuyPack = async (packId: string) => {
    setIsRedirecting(packId);
    try {
      const client = createApiClient(getToken);
      const email = user?.primaryEmailAddress?.emailAddress;
      const { url } = await client.billing.buyCredits(packId, email);
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Failed to buy credits:", err);
      setIsRedirecting(null);
    }
  };

  return (
    <div className="flex flex-col gap-12 p-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Simple, transparent pricing</h1>
        <p className="mt-2 text-base text-muted-foreground max-w-lg mx-auto">
          Buy credits when you need them. No subscriptions, no hidden fees, no expiration.
        </p>
      </div>

      {/* ── Credit Packs ──────────────────────────────────────────────────── */}
      {!config ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {config.creditPacks.map((pack) => (
            <PackCard
              key={pack.id}
              pack={pack}
              isRedirecting={isRedirecting}
              onBuy={() => handleBuyPack(pack.id)}
            />
          ))}
        </div>
      )}

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-8">
        <h2 className="text-lg font-semibold mb-4">Everything included with every credit pack</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm">
              <Check className="size-4 text-primary shrink-0" />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Secure payment via Stripe — iDEAL, Credit Card, SEPA, and more.
      </p>
    </div>
  );
}

function PackCard({ pack, isRedirecting, onBuy }: { pack: CreditPack; isRedirecting: string | null; onBuy: () => void }) {
  const perCredit = pack.credits > 0 ? (pack.priceUsd / pack.credits) : 0;

  return (
    <div
      className={`relative rounded-2xl border-2 p-8 flex flex-col transition-all ${
        pack.popular
          ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
          : "border-border bg-card hover:border-primary/40"
      }`}
    >
      {pack.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground gap-1 text-xs px-3">
            <Star className="size-3" /> Most Popular
          </Badge>
        </div>
      )}

      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{pack.label}</p>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          <span className="text-4xl font-bold">${pack.priceUsd.toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">one-time payment</p>
      </div>

      <div className="mt-6 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <Package className="size-4 text-primary" />
          <span className="text-2xl font-bold">{pack.credits}</span>
          <span className="text-sm text-muted-foreground">credits</span>
        </div>
        <p className="text-xs text-muted-foreground">
          ${perCredit.toFixed(3)} per credit
        </p>
      </div>

      <Button
        className="mt-6 w-full gap-2"
        size="lg"
        variant={pack.popular ? "default" : "outline"}
        onClick={onBuy}
        disabled={isRedirecting !== null}
      >
        {isRedirecting === pack.id ? (
          "Redirecting to Stripe…"
        ) : (
          <>
            Get {pack.credits} credits
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>
    </div>
  );
}
