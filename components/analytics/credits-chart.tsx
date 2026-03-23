/**
 * components/analytics/credits-chart.tsx
 *
 * Rich credit usage card with a large progress ring, usage breakdown,
 * horizontal bar, and billing period info. Pro users see a premium
 * unlimited badge with gradient styling instead.
 *
 * Used by: app/(app)/analytics/page.tsx
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, Zap, CalendarClock, TrendingUp } from "lucide-react";

/**
 * Props for the CreditsChart component.
 *
 * @property creditsUsed - Credits consumed this billing period
 * @property creditsTotal - Total credits available for the period
 * @property plan - User's plan ("free" or "pro")
 * @property periodEnd - ISO date when the billing period ends
 */
export interface CreditsChartProps {
  creditsUsed: number;
  creditsTotal: number;
  plan: "free" | "pro";
  periodEnd: string;
}

/** Ring dimensions — larger for more visual impact */
const SIZE = 160;
const STROKE_WIDTH = 18;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Formats an ISO date into a short readable string (e.g., "Mar 15").
 */
function formatPeriodEnd(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Returns a color based on usage percentage.
 * Green when low, amber when moderate, red when high.
 */
function getUsageColor(percentage: number): string {
  if (percentage < 50) return "#22c55e"; // green-500
  if (percentage < 80) return "#eab308"; // yellow-500
  return "#ef4444"; // red-500
}

/**
 * Returns a background class based on usage percentage.
 */
function getUsageBgClass(percentage: number): string {
  if (percentage < 50) return "bg-emerald-500/15 text-emerald-500";
  if (percentage < 80) return "bg-amber-500/15 text-amber-500";
  return "bg-red-500/15 text-red-500";
}

/**
 * CreditsChart renders a detailed credit usage card.
 * Pro users see an unlimited badge. Free users see a progress ring
 * with a horizontal usage bar, stats breakdown, and reset date.
 */
export function CreditsChart({
  creditsUsed,
  creditsTotal,
  plan,
  periodEnd,
}: CreditsChartProps) {
  // Pro users — show premium unlimited badge
  if (plan === "pro") {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Credits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Gradient ring background */}
            <div className="relative">
              <div className="flex size-28 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 via-orange-500/15 to-yellow-500/20 ring-2 ring-amber-500/20">
                <Crown className="size-10 text-amber-500" />
              </div>
              <div className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-amber-500 shadow-lg shadow-amber-500/30">
                <Zap className="size-3.5 text-white" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">Unlimited</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Pro plan — no limits</p>
            </div>
            {/* Pro perks */}
            <div className="w-full space-y-2 rounded-lg bg-muted/40 p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 text-amber-500" />
                <span>All premium models available</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5 text-amber-500" />
                <span>Renews {formatPeriodEnd(periodEnd)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Free users — show detailed progress
  const percentage = creditsTotal > 0 ? Math.round((creditsUsed / creditsTotal) * 100) : 0;
  const usedArc = (percentage / 100) * CIRCUMFERENCE;
  const color = getUsageColor(percentage);
  const remaining = creditsTotal - creditsUsed;
  const statusBgClass = getUsageBgClass(percentage);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Credits</CardTitle>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${statusBgClass}`}
          >
            {percentage}% used
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-5">
          {/* Progress ring */}
          <div className="relative">
            <svg width={SIZE} height={SIZE}>
              {/* Background track */}
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                className="text-secondary"
              />
              {/* Usage arc */}
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${usedArc} ${CIRCUMFERENCE - usedArc}`}
                strokeLinecap="round"
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                className="transition-all duration-500"
              />
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{remaining}</span>
              <span className="text-xs text-muted-foreground">remaining</span>
            </div>
          </div>

          {/* Horizontal usage bar */}
          <div className="w-full space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${percentage}%`, backgroundColor: color }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{creditsUsed} used</span>
              <span>{remaining} left</span>
            </div>
          </div>

          {/* Stats breakdown */}
          <div className="w-full space-y-2 rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Zap className="size-3.5" style={{ color }} />
                Credits this period
              </span>
              <span className="font-medium tabular-nums">
                {creditsUsed} / {creditsTotal}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <CalendarClock className="size-3.5 text-muted-foreground" />
                Resets
              </span>
              <span className="font-medium">{formatPeriodEnd(periodEnd)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
