"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient, type BillingConfig, type CreditPack, type PricingFormula } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Package, Save, RefreshCw, CheckCircle2, AlertCircle, Euro, TrendingUp, Zap, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatEur(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

export default function AdminBillingPage() {
  const { getToken } = useAuth();
  const [config, setConfig] = useState<BillingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getBillingConfig();
      setConfig(data);
    } catch (e: any) {
      setError(e.message || "Failed to load billing config");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    try {
      const client = createApiClient(getToken);
      await client.admin.saveBillingConfig(config);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const updateSubscription = (field: keyof BillingConfig["subscription"], value: string | number) => {
    if (!config) return;
    setConfig({ ...config, subscription: { ...config.subscription, [field]: value } });
  };

  const updatePack = (id: string, field: keyof CreditPack, value: string | number) => {
    if (!config) return;
    setConfig({
      ...config,
      creditPacks: config.creditPacks.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      ),
    });
  };

  const updateFormula = (field: keyof PricingFormula, value: number) => {
    if (!config) return;
    setConfig({
      ...config,
      pricingFormula: { ...config.pricingFormula, [field]: value },
    });
  };

  // Derived margin metrics — recomputed whenever formula or subscription changes
  const metrics = useMemo(() => {
    if (!config) return null;
    const f = config.pricingFormula;
    const subUsd = config.subscription.amount / 100;

    const revenuePerCreditUsd = f.creditUnitCostUsd * f.markup;
    const proCreditsPerMonth = Math.floor(subUsd / revenuePerCreditUsd);

    // Typical generation: ~15K input + 5K output tokens
    const avgGenApiCostUsd =
      (15_000 * f.inputPricePerMillion) / 1_000_000 +
      (5_000 * f.outputPricePerMillion) / 1_000_000;
    const avgGenCredits = Math.max(1, Math.ceil(avgGenApiCostUsd / f.creditUnitCostUsd));
    const avgGenRevenueUsd = avgGenCredits * revenuePerCreditUsd;

    // At 30% daily utilisation of Pro plan (10 credits/day × 30% × 31 days)
    const dailyCredits = 10;
    const utilisation = 0.3;
    const monthlyApiCostAtUtil = dailyCredits * utilisation * 31 * f.creditUnitCostUsd;
    const marginAtUtil = subUsd / monthlyApiCostAtUtil;

    return {
      revenuePerCreditUsd,
      proCreditsPerMonth,
      avgGenApiCostUsd,
      avgGenCredits,
      avgGenRevenueUsd,
      monthlyApiCostAtUtil,
      marginAtUtil,
    };
  }, [config]);

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing configuratie</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Beheer abonnement- en creditpakket prijzen. Stripe Price IDs zijn gekoppeld aan producten in je Stripe dashboard.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading || !config}>
            {saved ? <CheckCircle2 className="size-4 text-green-500" /> : <Save className="size-4" />}
            {saved ? "Opgeslagen!" : saving ? "Opslaan…" : "Opslaan"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : !config ? (
        <p className="text-muted-foreground">Geen config gevonden.</p>
      ) : (
        <div className="space-y-10">

          {/* ── Pro Subscription ─────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <CreditCard className="size-4 text-primary" />
              <h2 className="text-base font-semibold">Pro abonnement</h2>
              <Badge variant="secondary">Maandelijks terugkerend</Badge>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Naam</Label>
                  <Input
                    value={config.subscription.name}
                    onChange={(e) => updateSubscription("name", e.target.value)}
                    placeholder="Pro Plan"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Prijs (in centen)</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <Input
                      className="pl-8"
                      type="number"
                      value={config.subscription.amount}
                      onChange={(e) => updateSubscription("amount", parseInt(e.target.value))}
                      placeholder="2900"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Weergegeven als: {formatEur(config.subscription.amount)}/maand
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Stripe Price ID</Label>
                <Input
                  value={config.subscription.priceId}
                  onChange={(e) => updateSubscription("priceId", e.target.value)}
                  placeholder="price_..."
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Maak een nieuwe recurring price aan in Stripe Dashboard als je de prijs wilt veranderen.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Omschrijving</Label>
                <Input
                  value={config.subscription.description}
                  onChange={(e) => updateSubscription("description", e.target.value)}
                  placeholder="Unlimited AI credits per month"
                />
              </div>
            </div>
          </section>

          <Separator />

          {/* ── Credit Packs ─────────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <Package className="size-4 text-primary" />
              <h2 className="text-base font-semibold">Creditpakketten</h2>
              <Badge variant="secondary">Eenmalige betaling</Badge>
            </div>

            <div className="space-y-3">
              {config.creditPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="rounded-xl border border-border bg-card p-4"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-medium">{pack.credits} Credits</span>
                    <Badge variant="outline" className="text-xs font-mono">{pack.id}</Badge>
                    <span className="ml-auto text-sm font-semibold text-primary">
                      {formatEur(pack.amount)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Credits</Label>
                      <Input
                        type="number"
                        value={pack.credits}
                        onChange={(e) => updatePack(pack.id, "credits", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Prijs (centen)</Label>
                      <Input
                        type="number"
                        value={pack.amount}
                        onChange={(e) => updatePack(pack.id, "amount", parseInt(e.target.value))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Stripe Price ID</Label>
                      <Input
                        value={pack.priceId}
                        onChange={(e) => updatePack(pack.id, "priceId", e.target.value)}
                        className="font-mono text-xs"
                        placeholder="price_..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Tip: maak nieuwe one-time prices aan in Stripe Dashboard voor prijswijzigingen, en vul hier het nieuwe Price ID in.
            </p>
          </section>

          <Separator />

          {/* ── Pricing Formula ──────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <h2 className="text-base font-semibold">Prijsformule & marge</h2>
              <Badge variant="secondary">Claude Sonnet 4.6</Badge>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              {/* API pricing */}
              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Anthropic API kosten</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Input prijs ($ / 1M tokens)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={config.pricingFormula.inputPricePerMillion}
                      onChange={(e) => updateFormula("inputPricePerMillion", parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Claude Sonnet = $3.00</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Output prijs ($ / 1M tokens)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={config.pricingFormula.outputPricePerMillion}
                      onChange={(e) => updateFormula("outputPricePerMillion", parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Claude Sonnet = $15.00</p>
                  </div>
                </div>
              </div>

              {/* Credit pricing */}
              <div>
                <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Credit pricing</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">API-kosten per credit ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={config.pricingFormula.creditUnitCostUsd}
                      onChange={(e) => updateFormula("creditUnitCostUsd", parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Hoeveel API-tokens = 1 credit</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Markup (×)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="1"
                      value={config.pricingFormula.markup}
                      onChange={(e) => updateFormula("markup", parseFloat(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Hoe veel meer we rekenen vs API-kosten</p>
                  </div>
                </div>
              </div>

              {/* Live metrics */}
              {metrics && (
                <div>
                  <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Live berekening</p>
                  <div className="grid grid-cols-2 gap-3">

                    <div className="rounded-lg bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Revenue per credit</p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums">
                        ${metrics.revenuePerCreditUsd.toFixed(3)}
                      </p>
                      <p className="text-xs text-muted-foreground">{config.pricingFormula.markup}× markup op API-kosten</p>
                    </div>

                    <div className="rounded-lg bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Pro credits / maand</p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums">
                        {metrics.proCreditsPerMonth} cr
                      </p>
                      <p className="text-xs text-muted-foreground">Bij {formatEur(config.subscription.amount)} abonnement</p>
                    </div>

                    <div className="rounded-lg bg-muted/50 px-4 py-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Zap className="size-3" />
                        Gem. generatie (~15K↑ 5K↓)
                      </p>
                      <p className="mt-0.5 text-xl font-bold tabular-nums">
                        {metrics.avgGenCredits} cr
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ${metrics.avgGenApiCostUsd.toFixed(3)} API · ${metrics.avgGenRevenueUsd.toFixed(3)} opbrengst
                      </p>
                    </div>

                    <div className={cn(
                      "rounded-lg px-4 py-3",
                      metrics.marginAtUtil >= 3
                        ? "bg-green-500/10 border border-green-500/20"
                        : metrics.marginAtUtil >= 1.5
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "bg-destructive/10 border border-destructive/20"
                    )}>
                      <p className={cn(
                        "text-xs flex items-center gap-1",
                        metrics.marginAtUtil >= 3 ? "text-green-600 dark:text-green-400"
                        : metrics.marginAtUtil >= 1.5 ? "text-amber-600 dark:text-amber-400"
                        : "text-destructive"
                      )}>
                        <BarChart3 className="size-3" />
                        Marge @ 30% gebruik
                      </p>
                      <p className={cn(
                        "mt-0.5 text-xl font-bold tabular-nums",
                        metrics.marginAtUtil >= 3 ? "text-green-600 dark:text-green-400"
                        : metrics.marginAtUtil >= 1.5 ? "text-amber-600 dark:text-amber-400"
                        : "text-destructive"
                      )}>
                        {metrics.marginAtUtil.toFixed(1)}×
                      </p>
                      <p className="text-xs text-muted-foreground">
                        API-kosten: ${metrics.monthlyApiCostAtUtil.toFixed(2)}/maand
                      </p>
                    </div>

                  </div>
                </div>
              )}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
