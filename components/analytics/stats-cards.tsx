/**
 * components/analytics/stats-cards.tsx
 *
 * Four summary stat cards displayed at the top of the analytics page.
 * Shows key metrics: AI Generations, Projects, Credits Used, Manual Edits.
 * Each card has a colored icon background, accent styling, and a
 * descriptive subtitle. Uses a responsive grid: 2 columns on mobile,
 * 4 on desktop.
 *
 * Used by: app/(app)/analytics/page.tsx
 */

import { Sparkles, FolderOpen, Coins, Pencil, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Props for the StatsCards component.
 *
 * @property totalGenerations - Total AI-generated versions across all projects
 * @property totalProjects - Number of projects the user has
 * @property creditsUsed - Credits consumed in the current billing period
 * @property creditsTotal - Total credits available for the period
 * @property totalManualEdits - Total manually edited versions across all projects
 * @property plan - User's plan for displaying "Unlimited" label for Pro users
 */
export interface StatsCardsProps {
  totalGenerations: number;
  totalProjects: number;
  creditsUsed: number;
  creditsTotal: number;
  totalManualEdits: number;
  plan: "free" | "pro";
}

/**
 * Shape of a single stat card definition.
 */
interface StatCard {
  label: string;
  value: string;
  icon: LucideIcon;
  description: string;
  /** Tailwind classes for the icon wrapper background */
  iconBg: string;
  /** Tailwind classes for the icon color */
  iconColor: string;
  /** Tailwind class for the accent bar on the left */
  accent: string;
}

/**
 * StatsCards renders four stat cards in a responsive grid.
 * Each card features a colored icon, accent bar, and descriptive subtitle.
 *
 * Pro users see "Unlimited" for credits instead of a count.
 */
export function StatsCards({
  totalGenerations,
  totalProjects,
  creditsUsed,
  creditsTotal,
  totalManualEdits,
  plan,
}: StatsCardsProps) {
  const cards: StatCard[] = [
    {
      label: "AI Generations",
      value: totalGenerations.toString(),
      icon: Sparkles,
      description: "Total AI-generated versions",
      iconBg: "bg-purple-500/15",
      iconColor: "text-purple-500",
      accent: "bg-purple-500",
    },
    {
      label: "Projects",
      value: totalProjects.toString(),
      icon: FolderOpen,
      description: "Active projects",
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-500",
      accent: "bg-blue-500",
    },
    {
      label: "Credits Used",
      value: plan === "pro" ? "Unlimited" : `${creditsUsed} / ${creditsTotal}`,
      icon: Coins,
      description:
        plan === "pro" ? "Pro plan — unlimited" : "This billing period",
      iconBg: "bg-amber-500/15",
      iconColor: "text-amber-500",
      accent: "bg-amber-500",
    },
    {
      label: "Manual Edits",
      value: totalManualEdits.toString(),
      icon: Pencil,
      description: "Code edits in Monaco",
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500",
      accent: "bg-emerald-500",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="relative overflow-hidden">
          {/* Accent bar on the left edge */}
          <div className={`absolute left-0 top-0 h-full w-1 ${card.accent}`} />
          <CardContent className="p-4 pl-5 sm:p-6 sm:pl-7">
            <div className="flex items-start justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {card.label}
              </span>
              <div
                className={`flex size-8 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                <card.icon className={`size-4 ${card.iconColor}`} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {card.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
