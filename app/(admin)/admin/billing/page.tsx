"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient, type BillingConfig, type CreditPack, type PricingFormula } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Package, Save, RefreshCw, CheckCircle2, AlertCircle, TrendingUp, Plus, Trash2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const updatePack = (idx: number, updates: Partial<CreditPack>) => {
    if (!config) return;
    const packs = [...config.creditPacks];
    packs[idx] = { ...packs[idx], ...updates };
    setConfig({ ...config, creditPacks: packs });
  };

  const addPack = () => {
    if (!config) return;
    const id = `pack_${Date.now().toString(36)}`;
    const newPack: CreditPack = {
      id,
      credits: 100,
      priceUsd: 4.99,
      priceCents: 499,
      label: "New Pack",
    };
    setConfig({ ...config, creditPacks: [...config.creditPacks, newPack] });
  };

  const removePack = (idx: number) => {
    if (!config) return;
    const packs = config.creditPacks.filter((_, i) => i !== idx);
    setConfig({ ...config, creditPacks: packs });
  };

  const updateFormula = (field: keyof PricingFormula, value: number) => {
    if (!config) return;
    setConfig({
      ...config,
      pricingFormula: { ...config.pricingFormula, [field]: value },
    });
  };

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pricing & Credits</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure credit pack prices and the pricing formula. Changes are saved to KV and take effect immediately.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          </Button>
          <Button size="sm" onClick={save} disabled={saving || loading || !config}>
            {saved ? <CheckCircle2 className="size-4 text-green-500" /> : <Save className="size-4" />}
            {saved ? "Saved!" : saving ? "Saving…" : "Save"}
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
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : !config ? (
        <p className="text-muted-foreground">No config found — using code defaults.</p>
      ) : (
        <div className="space-y-10">

          {/* ── Credit Packs ─────────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-primary" />
                <h2 className="text-base font-semibold">Credit Packs</h2>
              </div>
              <Button variant="outline" size="sm" onClick={addPack} className="gap-1.5">
                <Plus className="size-3.5" />
                Add Pack
              </Button>
            </div>

            <div className="space-y-3">
              {config.creditPacks.map((pack, idx) => (
                <div
                  key={pack.id}
                  className={cn(
                    "rounded-xl border bg-card p-5",
                    pack.popular ? "border-primary/40 bg-primary/5" : "border-border"
                  )}
                >
                  {/* Pack header */}
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-sm font-semibold">{pack.label}</span>
                    {pack.popular && (
                      <Badge className="bg-primary/20 text-primary text-[10px] gap-1">
                        <Star className="size-2.5" /> Most Popular
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-mono ml-auto">{pack.id}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removePack(idx)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  {/* Fields */}
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Label</Label>
                      <Input
                        value={pack.label}
                        onChange={(e) => updatePack(idx, { label: e.target.value })}
                        placeholder="Starter"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Credits</Label>
                      <Input
                        type="number"
                        value={pack.credits}
                        onChange={(e) => updatePack(idx, { credits: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Price ($)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pack.priceUsd}
                        onChange={(e) => {
                          const usd = parseFloat(e.target.value) || 0;
                          updatePack(idx, { priceUsd: usd, priceCents: Math.round(usd * 100) });
                        }}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Per credit</Label>
                      <div className="flex h-9 items-center rounded-md border bg-muted/40 px-3 text-sm font-mono tabular-nums">
                        ${pack.credits > 0 ? (pack.priceUsd / pack.credits).toFixed(3) : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Popular toggle */}
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`popular-${pack.id}`}
                      checked={!!pack.popular}
                      onChange={(e) => updatePack(idx, { popular: e.target.checked })}
                      className="rounded"
                    />
                    <label htmlFor={`popular-${pack.id}`} className="text-xs text-muted-foreground cursor-pointer">
                      Mark as &quot;Most Popular&quot;
                    </label>
                  </div>
                </div>
              ))}

              {config.creditPacks.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  No credit packs configured. Click &quot;Add Pack&quot; to create one.
                </div>
              )}
            </div>
          </section>

          <Separator />

          {/* ── Pricing Formula ──────────────────────────────────────────── */}
          <section>
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp className="size-4 text-primary" />
              <h2 className="text-base font-semibold">Pricing Formula</h2>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 space-y-6">
              <p className="text-xs text-muted-foreground leading-relaxed">
                These values control how API token usage is converted to credits and what users pay.
                The formula: <code className="text-[11px] bg-muted px-1 py-0.5 rounded">credits = ceil(apiCostUsd / creditUnitCostUsd)</code>,
                user pays <code className="text-[11px] bg-muted px-1 py-0.5 rounded">credits × creditUnitCostUsd × markup</code>.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Input price ($/1M tokens)</Label>
                  <Input
                    type="number"
                    step="0.25"
                    value={config.pricingFormula.inputPricePerMillion}
                    onChange={(e) => updateFormula("inputPricePerMillion", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground/60">Sonnet = $3, Haiku = $1</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Output price ($/1M tokens)</Label>
                  <Input
                    type="number"
                    step="0.25"
                    value={config.pricingFormula.outputPricePerMillion}
                    onChange={(e) => updateFormula("outputPricePerMillion", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground/60">Sonnet = $15, Haiku = $5</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Credit unit cost ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={config.pricingFormula.creditUnitCostUsd}
                    onChange={(e) => updateFormula("creditUnitCostUsd", parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-[10px] text-muted-foreground/60">API cost that equals 1 credit</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Markup</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={config.pricingFormula.markup}
                    onChange={(e) => updateFormula("markup", parseFloat(e.target.value) || 1)}
                  />
                  <p className="text-[10px] text-muted-foreground/60">1 = at cost, 2 = double, etc.</p>
                </div>
              </div>

              {/* Live example */}
              <div className="rounded-lg bg-muted/40 p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Live Example — Sonnet edit (~15K in, 5K out)</p>
                {(() => {
                  const f = config.pricingFormula;
                  const apiCost = (15_000 * f.inputPricePerMillion / 1_000_000) + (5_000 * f.outputPricePerMillion / 1_000_000);
                  const credits = Math.max(1, Math.ceil(apiCost / f.creditUnitCostUsd));
                  const userPays = credits * f.creditUnitCostUsd * f.markup;
                  return (
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <p className="text-muted-foreground/60 text-xs">API cost</p>
                        <p className="font-mono font-bold">${apiCost.toFixed(4)}</p>
                      </div>
                      <div className="text-muted-foreground">→</div>
                      <div>
                        <p className="text-muted-foreground/60 text-xs">Credits</p>
                        <p className="font-mono font-bold">{credits} cr</p>
                      </div>
                      <div className="text-muted-foreground">→</div>
                      <div>
                        <p className="text-muted-foreground/60 text-xs">User pays</p>
                        <p className="font-mono font-bold text-primary">${userPays.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground/60 text-xs">Margin</p>
                        <p className={cn("font-mono font-bold", f.markup > 1 ? "text-emerald-500" : "text-muted-foreground")}>
                          {f.markup.toFixed(1)}×
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
