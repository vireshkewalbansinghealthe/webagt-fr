"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient, type BillingConfig, type CreditPack } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Package, Save, RefreshCw, CheckCircle2, AlertCircle, Euro } from "lucide-react";
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

        </div>
      )}
    </div>
  );
}
