"use client";

/**
 * components/dashboard/upgrade-modal.tsx
 *
 * Full-screen modal shown when a free user hits the project limit.
 * Uses native Stripe Checkout (with iDEAL, SEPA, card) instead of Clerk Billing.
 */

import { useState } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createApiClient } from "@/lib/api-client";
import {
  Zap,
  Rocket,
  Infinity,
  LayoutDashboard,
  Shield,
  X,
  Check,
} from "lucide-react";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRO_HIGHLIGHTS = [
  {
    icon: Infinity,
    title: "Unlimited projects",
    description: "Create as many projects as you need",
  },
  {
    icon: Zap,
    title: "Unlimited AI credits",
    description: "Generate more, iterate faster",
  },
  {
    icon: Rocket,
    title: "Premium models",
    description: "Access Claude Sonnet, Haiku, DeepSeek and more",
  },
  {
    icon: LayoutDashboard,
    title: "Priority support",
    description: "Get help when you need it",
  },
  {
    icon: Shield,
    title: "Full webshop backend",
    description: "iDEAL, orders, inventory — all included",
  },
];

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background px-6 pt-8 pb-6 border-b border-border">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="size-4" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-primary/20 text-primary border-primary/30 hover:bg-primary/20 text-xs font-semibold">
              <Zap className="size-3 mr-1" />
              Upgrade to Pro
            </Badge>
          </div>

          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-2xl font-bold">
              You&apos;ve reached the free plan limit
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Free plan is limited to 3 projects. Upgrade to Pro to unlock
              unlimited projects, AI credits, and premium models.
            </DialogDescription>
          </DialogHeader>

          {/* Pro highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-5">
            {PRO_HIGHLIGHTS.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-2.5 rounded-lg bg-background/60 border border-border/60 px-3 py-2.5"
              >
                <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <item.icon className="size-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight">
                    {item.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing section */}
        <div className="px-6 py-8 flex flex-col items-center gap-6">
          {/* Price card */}
          <div className="w-full max-w-sm rounded-2xl border-2 border-primary/40 bg-primary/5 px-8 py-6 text-center relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                Pro Plan
              </span>
            </div>
            <div className="mt-2">
              <span className="text-4xl font-bold">€29</span>
              <span className="text-muted-foreground text-sm">/maand</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Maandelijks opzegbaar
            </p>

            <ul className="mt-5 space-y-2 text-sm text-left">
              {[
                "Onbeperkte projecten",
                "Onbeperkte AI credits",
                "iDEAL & kaartbetalingen",
                "Premium AI modellen",
                "Volledige webshop backend",
                "Prioriteit support",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <Check className="size-4 text-primary shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <Button
              className="mt-6 w-full gap-2"
              size="lg"
              onClick={handleUpgrade}
              disabled={isRedirecting}
            >
              <Zap className="size-4" />
              {isRedirecting ? "Naar Stripe…" : "Nu upgraden"}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Veilige betaling via Stripe · iDEAL · Kaart · SEPA
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Opzeggen kan altijd · Direct actief · Veilig betalen via Stripe
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Gratis blijven
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
