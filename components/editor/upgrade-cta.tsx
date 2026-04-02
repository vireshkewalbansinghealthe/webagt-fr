/**
 * components/editor/upgrade-cta.tsx
 *
 * Upgrade prompt shown when a user hits a plan limitation.
 * Displays a card with the limitation reason, Pro features list,
 * and a CTA button to upgrade.
 *
 * Shown when:
 * 1. User tries to send a message with 0 credits
 * 2. User tries to use a premium model on free plan
 * 3. User tries to create a 4th project on free plan
 * 4. User tries to export on free plan
 *
 * Used by: components/editor/chat-panel.tsx, create-project-dialog.tsx
 */

"use client";

import Link from "next/link";
import { Zap, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Props for the UpgradeCTA component.
 *
 * @property reason - Why the upgrade is being shown (displayed as header)
 * @property resetDays - Days until credits reset (optional, for credit exhaustion)
 */
export interface UpgradeCTAProps {
  reason: string;
  resetDays?: number;
}

/** Pro features to highlight in the upgrade prompt */
const PRO_FEATURES = [
  "Unlimited AI messages",
  "All AI models (Claude Sonnet 4.6, GPT-4o)",
  "Unlimited projects",
  "ZIP export",
] as const;

/**
 * UpgradeCTA renders an upgrade prompt card with Pro features.
 * Designed to be shown inline where the limitation occurs
 * (e.g., replacing the disabled chat input).
 *
 * @param reason - The limitation reason to display
 * @param resetDays - Optional days until credit reset
 */
export function UpgradeCTA({ reason, resetDays }: UpgradeCTAProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      {/* Header with lightning icon */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10">
          <Zap className="size-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold">Upgrade to Pro</h3>
          <p className="text-xs text-muted-foreground">{reason}</p>
        </div>
      </div>

      {/* Feature list */}
      <ul className="mb-4 space-y-1.5">
        {PRO_FEATURES.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-xs">
            <Check className="size-3 text-emerald-500" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA button */}
      <Button size="sm" className="w-full gap-1.5 text-xs" asChild>
        <Link href="/pricing">
          <Zap className="size-3" />
          Upgrade voor €9/maand
        </Link>
      </Button>

      {/* Reset note */}
      {resetDays !== undefined && resetDays > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Credits reset in {resetDays} day{resetDays !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
