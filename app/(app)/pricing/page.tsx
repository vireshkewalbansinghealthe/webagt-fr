"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { createApiClient, type BillingConfig } from "@/lib/api-client";
import { Check, Zap, Package, Infinity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

const FREE_FEATURES = [
  "1 AI credit per dag",
  "Alleen websites (geen webshop)",
  "Max 3 projecten",
  "Live preview",
  "Code editor",
  "Versiegeschiedenis",
];

const PRO_FEATURES = [
  "10 AI credits per dag",
  "Websites én webshops",
  "Onbeperkte projecten",
  "iDEAL & kaartbetalingen",
  "Volledige webshop backend",
  "Premium AI modellen (Claude, DeepSeek)",
  "Prioriteit support",
  "Turso database per project",
  "Aangepast domein",
];

function formatEur(cents: number) {
  return `€${(cents / 100).toFixed(2).replace(".00", "")}`;
}

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
      // Use fallback defaults if config not available
      setConfig({
        subscription: { priceId: "", amount: 2900, currency: "eur", name: "Pro Plan", description: "" },
        creditPacks: [
          { id: "pack_5", credits: 5, priceId: "", amount: 249, currency: "eur" },
          { id: "pack_10", credits: 10, priceId: "", amount: 449, currency: "eur" },
          { id: "pack_25", credits: 25, priceId: "", amount: 999, currency: "eur" },
          { id: "pack_50", credits: 50, priceId: "", amount: 1799, currency: "eur" },
          { id: "pack_100", credits: 100, priceId: "", amount: 2999, currency: "eur" },
          { id: "pack_250", credits: 250, priceId: "", amount: 5999, currency: "eur" },
        ],
      });
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const handleUpgrade = async () => {
    setIsRedirecting("sub");
    try {
      const client = createApiClient(getToken);
      const email = user?.primaryEmailAddress?.emailAddress;
      const { url } = await client.billing.createCheckout(email);
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Failed to start checkout:", err);
      setIsRedirecting(null);
    }
  };

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

  const subPrice = config ? formatEur(config.subscription.amount) : "€29";

  return (
    <div className="flex flex-col gap-10 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prijzen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Begin gratis, upgrade wanneer je meer nodig hebt.
        </p>
      </div>

      {/* ── Subscription Plans ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free */}
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
          <div>
            <h2 className="text-lg font-semibold">Gratis</h2>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold">€0</span>
              <span className="text-muted-foreground text-sm">/maand</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Voor altijd gratis</p>
          </div>
          <ul className="mt-6 space-y-3 flex-1">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-muted-foreground shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" className="mt-8 w-full" disabled>
            Huidig plan
          </Button>
        </div>

        {/* Pro */}
        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-8 flex flex-col relative">
          <div className="absolute -top-3 left-6">
            <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              Aanbevolen
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Pro</h2>
            <div className="mt-3 flex items-baseline gap-1">
              {config ? (
                <span className="text-4xl font-bold">{subPrice}</span>
              ) : (
                <Skeleton className="h-10 w-20" />
              )}
              <span className="text-muted-foreground text-sm">/maand</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Maandelijks opzegbaar</p>
          </div>
          <ul className="mt-6 space-y-3 flex-1">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-primary shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Button
            className="mt-8 w-full gap-2"
            size="lg"
            onClick={handleUpgrade}
            disabled={isRedirecting !== null}
          >
            <Zap className="size-4" />
            {isRedirecting === "sub" ? "Naar Stripe…" : "Nu upgraden naar Pro"}
          </Button>
        </div>
      </div>

      {/* ── Credit Packs ──────────────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center gap-3">
          <div>
            <h2 className="text-xl font-bold">Creditpakketten</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Eenmalige aankoop · Geen abonnement nodig · Credits verlopen niet
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto">
            <Package className="size-3 mr-1" />
            Pay as you go
          </Badge>
        </div>

        {!config ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {config.creditPacks.map((pack) => (
              <button
                key={pack.id}
                onClick={() => handleBuyPack(pack.id)}
                disabled={isRedirecting !== null}
                className="flex flex-col items-center rounded-xl border border-border bg-card p-4 text-center transition-all hover:border-primary/60 hover:bg-primary/5 hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-2xl font-bold">{pack.credits}</span>
                <span className="text-xs text-muted-foreground">credits</span>
                <span className="mt-3 text-base font-semibold text-primary">
                  {formatEur(pack.amount)}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5">
                  {formatEur(Math.round(pack.amount / pack.credits))}/credit
                </span>
                {isRedirecting === pack.id && (
                  <span className="mt-2 text-[10px] text-muted-foreground">Laden…</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Veilige betaling via Stripe · iDEAL · Creditcard · SEPA Incasso · Opzeggen wanneer je wilt
      </p>
    </div>
  );
}
