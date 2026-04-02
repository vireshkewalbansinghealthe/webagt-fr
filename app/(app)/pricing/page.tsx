"use client";

/**
 * app/(app)/pricing/page.tsx
 *
 * Pricing page with native Stripe checkout (iDEAL, card, SEPA).
 * Replaces the Clerk PricingTable component.
 */

import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { createApiClient } from "@/lib/api-client";
import { Check, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const FREE_FEATURES = [
  "3 projecten",
  "50 AI credits per maand",
  "Live preview",
  "Code editor",
  "Versiegeschiedenis",
];

const PRO_FEATURES = [
  "Onbeperkte projecten",
  "Onbeperkte AI credits",
  "iDEAL & kaartbetalingen",
  "Volledige webshop backend",
  "Premium AI modellen (Claude, DeepSeek)",
  "Prioriteit support",
  "Turso database per project",
  "Aangepast domein",
];

export default function PricingPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleUpgrade = async () => {
    setIsRedirecting(true);
    try {
      const client = createApiClient(getToken);
      const email = user?.primaryEmailAddress?.emailAddress;
      const { url } = await client.billing.createCheckout(email);
      if (url) window.location.href = url;
    } catch (err) {
      console.error("Failed to start checkout:", err);
      setIsRedirecting(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prijzen</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Begin gratis, upgrade wanneer je meer nodig hebt.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Free plan */}
        <div className="rounded-2xl border border-border bg-card p-8 flex flex-col">
          <div>
            <h2 className="text-lg font-semibold">Gratis</h2>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold">€0</span>
              <span className="text-muted-foreground text-sm">/maand</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Voor altijd gratis
            </p>
          </div>

          <ul className="mt-6 space-y-3 flex-1">
            {FREE_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-muted-foreground shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button variant="outline" className="mt-8 w-full" disabled>
            Huidig plan
          </Button>
        </div>

        {/* Pro plan */}
        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-8 flex flex-col relative">
          <div className="absolute -top-3 left-6">
            <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
              Aanbevolen
            </span>
          </div>

          <div>
            <h2 className="text-lg font-semibold">Pro</h2>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl font-bold">€9</span>
              <span className="text-muted-foreground text-sm">/maand</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Maandelijks opzegbaar
            </p>
          </div>

          <ul className="mt-6 space-y-3 flex-1">
            {PRO_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-primary shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            className="mt-8 w-full gap-2"
            size="lg"
            onClick={handleUpgrade}
            disabled={isRedirecting}
          >
            <Zap className="size-4" />
            {isRedirecting ? "Naar Stripe…" : "Nu upgraden naar Pro"}
          </Button>
        </div>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Veilige betaling via Stripe · iDEAL · Creditcard · SEPA Incasso ·
        Opzeggen wanneer je wilt
      </p>

      <p className="text-center text-xs text-muted-foreground">
        Alle plannen bevatten: Live preview · Code editor · Versiegeschiedenis ·
        Dark mode
      </p>
    </div>
  );
}
