"use client";

/**
 * components/dashboard/upgrade-modal.tsx
 *
 * Full-screen modal shown when a free user hits the project limit.
 * Embeds Clerk's <PricingTable /> so the user can upgrade without leaving
 * the dashboard.
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PricingTable } from "@clerk/nextjs";
import {
  Zap,
  Rocket,
  Infinity,
  LayoutDashboard,
  Shield,
  X,
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
    title: "More AI credits",
    description: "Generate more, iterate faster",
  },
  {
    icon: Rocket,
    title: "Premium models",
    description: "Access Claude Opus, GPT-4o, and more",
  },
  {
    icon: LayoutDashboard,
    title: "Priority support",
    description: "Get help when you need it",
  },
  {
    icon: Shield,
    title: "No limits on collaborators",
    description: "Invite your whole team",
  },
];

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[820px] max-h-[90vh] overflow-y-auto p-0 gap-0">
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
              Free plan is limited to 3 projects. Upgrade to Pro to unlock unlimited
              projects, more AI credits, and premium models.
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

        {/* Clerk Pricing Table */}
        <div className="px-6 py-6">
          <PricingTable newSubscriptionRedirectUrl="/dashboard" />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Cancel anytime · Instant activation · Secure payments via Stripe
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Stay on free plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
