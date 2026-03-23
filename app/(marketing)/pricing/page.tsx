/**
 * app/(marketing)/pricing/page.tsx
 *
 * Pricing page powered by Clerk Billing.
 * Uses Clerk's `<PricingTable />` component which automatically:
 * - Displays all publicly visible plans with their features
 * - Handles checkout flow (opens Clerk-hosted checkout drawer)
 * - Shows current plan status for signed-in users
 *
 * Plans are configured in the Clerk Dashboard under Billing > Configure.
 * No manual card layout needed — Clerk renders everything.
 *
 * Lives in the (marketing) route group — publicly accessible.
 *
 * Used by: app/(marketing)/layout.tsx, navbar links, sidebar upgrade CTA
 */

import Link from "next/link";
import { PricingTable } from "@clerk/nextjs";
import { Navbar } from "@/components/landing";
import { ArrowLeft } from "lucide-react";

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-background">
      <Navbar />

      <main className="mx-auto max-w-5xl px-6 pb-20 pt-28">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to home
        </Link>

        {/* Page header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Choose your plan
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Start free, upgrade when you need more power.
          </p>
        </div>

        {/* Clerk PricingTable — auto-renders all public plans with checkout */}
        <PricingTable />

        {/* Shared features note */}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          All plans include: Live preview, Code editor, Version control, Dark
          mode
        </p>
      </main>
    </div>
  );
}
