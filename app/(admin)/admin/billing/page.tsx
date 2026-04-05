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
import { CreditCard, Package, Save, RefreshCw, CheckCircle2, AlertCircle, Euro, TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatEur(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

// ── Slider component ──────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue:    { track: "bg-blue-500",    thumb: "accent-blue-500" },
  violet:  { track: "bg-violet-500",  thumb: "accent-violet-500" },
  emerald: { track: "bg-emerald-500", thumb: "accent-emerald-500" },
  orange:  { track: "bg-orange-500",  thumb: "accent-orange-500" },
} as const;

interface PriceSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  hint: string;
  format: (v: number) => string;
  color: keyof typeof COLOR_MAP;
}

function PriceSlider({ label, value, min, max, step, onChange, hint, format, color }: PriceSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const { track, thumb } = COLOR_MAP[color];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className={cn("text-lg font-bold tabular-nums", `text-${color}-500`)}>{format(value)}</span>
      </div>

      <div className="relative h-5 flex items-center">
        {/* Track background */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-muted" />
        {/* Filled portion */}
        <div
          className={cn("absolute left-0 h-1.5 rounded-full transition-all", track)}
          style={{ width: `${pct}%` }}
        />
        {/* Range input */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className={cn("relative w-full h-1.5 appearance-none bg-transparent cursor-pointer", thumb)}
          style={{
            // Override thumb styling via inline style for cross-browser
            WebkitAppearance: "none",
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
        <span>{format(min)}</span>
        <span className="text-center opacity-80">{hint}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
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
    if (!config?.pricingFormula) return null;
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
              <h2 className="text-base font-semibold">Winstmarge instellen</h2>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-8">

              {/* ── BIG margin slider ── */}
              <div className="space-y-3">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-sm font-medium">Winstmarge</p>
                    <p className="text-xs text-muted-foreground">Sleep om je marge in te stellen — alle andere waarden passen zich automatisch aan</p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-4xl font-black tabular-nums",
                      config.pricingFormula.markup >= 4 ? "text-green-500"
                      : config.pricingFormula.markup >= 2 ? "text-emerald-500"
                      : "text-amber-500"
                    )}>
                      {config.pricingFormula.markup.toFixed(1)}×
                    </span>
                    <p className="text-xs text-muted-foreground">marge</p>
                  </div>
                </div>

                {/* Big track */}
                <div className="relative h-8 flex items-center">
                  <div className="absolute inset-x-0 h-3 rounded-full bg-muted" />
                  <div
                    className={cn(
                      "absolute left-0 h-3 rounded-full transition-all",
                      config.pricingFormula.markup >= 4 ? "bg-green-500"
                      : config.pricingFormula.markup >= 2 ? "bg-emerald-500"
                      : "bg-amber-500"
                    )}
                    style={{ width: `${((config.pricingFormula.markup - 1) / 9) * 100}%` }}
                  />
                  <input
                    type="range" min={1} max={10} step={0.5}
                    value={config.pricingFormula.markup}
                    onChange={(e) => updateFormula("markup", parseFloat(e.target.value))}
                    className="relative w-full h-3 appearance-none bg-transparent cursor-pointer"
                    style={{ WebkitAppearance: "none" }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>1× (break-even)</span>
                  <span>5× (goed)</span>
                  <span>10× (max)</span>
                </div>
              </div>

              {/* ── Live outcome cards ── */}
              {metrics && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Wat dit betekent</p>

                  {/* Top row: user price + margin health */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-muted/40 px-4 py-3 space-y-0.5">
                      <p className="text-xs text-muted-foreground">Prijs per credit voor gebruiker</p>
                      <p className="text-2xl font-black tabular-nums">
                        €{(metrics.revenuePerCreditUsd * 0.92).toFixed(3)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        jij betaalt ${config.pricingFormula.creditUnitCostUsd.toFixed(2)} aan API
                      </p>
                    </div>

                    <div className={cn(
                      "rounded-lg px-4 py-3 space-y-0.5",
                      metrics.marginAtUtil >= 3 ? "bg-green-500/10 border border-green-500/20"
                      : metrics.marginAtUtil >= 1.5 ? "bg-amber-500/10 border border-amber-500/20"
                      : "bg-destructive/10 border border-destructive/20"
                    )}>
                      <p className={cn("text-xs flex items-center gap-1",
                        metrics.marginAtUtil >= 3 ? "text-green-600 dark:text-green-400"
                        : metrics.marginAtUtil >= 1.5 ? "text-amber-600 dark:text-amber-400"
                        : "text-destructive"
                      )}>
                        <BarChart3 className="size-3" /> Nettowinst @ 30% gebruik
                      </p>
                      <p className={cn("text-2xl font-black tabular-nums",
                        metrics.marginAtUtil >= 3 ? "text-green-600 dark:text-green-400"
                        : metrics.marginAtUtil >= 1.5 ? "text-amber-600 dark:text-amber-400"
                        : "text-destructive"
                      )}>
                        {metrics.marginAtUtil.toFixed(1)}×
                      </p>
                      <p className="text-xs text-muted-foreground">
                        API kost €{(metrics.monthlyApiCostAtUtil * 0.92).toFixed(2)}/maand/user
                      </p>
                    </div>
                  </div>

                  {/* Message cost breakdown */}
                  <div className="rounded-lg border border-border/50 divide-y divide-border/50">
                    {[
                      { label: "Haiku 4.5 bericht", apiIn: 1, apiOut: 5, icon: "⚡" },
                      { label: "Sonnet 4.6 bericht", apiIn: 3, apiOut: 15, icon: "✦" },
                    ].map(({ label, apiIn, apiOut, icon }) => {
                      const apiCost = (800 * apiIn / 1_000_000) + (45_000 * 0.1 * apiIn / 1_000_000) + (500 * apiOut / 1_000_000);
                      const credits = Math.max(1, Math.ceil(apiCost / config.pricingFormula.creditUnitCostUsd));
                      const userPaysUsd = credits * metrics.revenuePerCreditUsd;
                      const userPaysEur = userPaysUsd * 0.92;
                      return (
                        <div key={label} className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{icon}</span>
                            <span className="text-sm text-muted-foreground">{label}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-muted-foreground/60 text-xs">${apiCost.toFixed(3)} API</span>
                            <span className="font-medium">{credits} cr</span>
                            <span className="font-bold text-primary">€{userPaysEur.toFixed(3)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Pro plan summary */}
                  <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Pro plan {formatEur(config.subscription.amount)}/maand</p>
                      <p className="text-xs text-muted-foreground">geeft gebruiker {metrics.proCreditsPerMonth} credits</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">~{Math.round(metrics.proCreditsPerMonth / Math.max(1, Math.ceil(((800 * config.pricingFormula.inputPricePerMillion / 1_000_000) + (45_000 * 0.1 * config.pricingFormula.inputPricePerMillion / 1_000_000) + (500 * config.pricingFormula.outputPricePerMillion / 1_000_000)) / config.pricingFormula.creditUnitCostUsd)))} berichten</p>
                      <p className="text-xs text-muted-foreground">gemiddeld per maand</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Advanced (collapsed) ── */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground hover:text-foreground list-none">
                  <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                  Geavanceerd — API prijzen & credit drempelwaarde
                </summary>
                <div className="mt-4 space-y-5 pt-4 border-t border-border/50">
                  <PriceSlider
                    label="Input tokens ($ / 1M)"
                    value={config.pricingFormula.inputPricePerMillion}
                    min={0.25} max={15} step={0.25}
                    onChange={(v) => updateFormula("inputPricePerMillion", v)}
                    hint="Haiku=$1 · Sonnet=$3 · Opus=$5"
                    format={(v) => `$${v.toFixed(2)}`}
                    color="blue"
                  />
                  <PriceSlider
                    label="Output tokens ($ / 1M)"
                    value={config.pricingFormula.outputPricePerMillion}
                    min={1.25} max={75} step={0.25}
                    onChange={(v) => updateFormula("outputPricePerMillion", v)}
                    hint="Haiku=$5 · Sonnet=$15 · Opus=$25"
                    format={(v) => `$${v.toFixed(2)}`}
                    color="violet"
                  />
                  <PriceSlider
                    label="API-kosten per credit ($)"
                    value={config.pricingFormula.creditUnitCostUsd}
                    min={0.01} max={0.20} step={0.01}
                    onChange={(v) => updateFormula("creditUnitCostUsd", v)}
                    hint="Drempel: hoeveel API-kosten = 1 credit"
                    format={(v) => `$${v.toFixed(2)}`}
                    color="emerald"
                  />
                </div>
              </details>

            </div>
          </section>

        </div>
      )}
    </div>
  );
}
