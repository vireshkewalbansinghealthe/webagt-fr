/**
 * components/analytics/recent-activity-card.tsx
 *
 * Card showing recent activity as compact rows in a scrollable list.
 * Each row shows the type badge, prompt snippet, project name,
 * and relative timestamp. Capped at a fixed height.
 *
 * Used by: app/(app)/analytics/page.tsx
 */

import { Sparkles, Pencil, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/types/analytics";

/**
 * Props for the RecentActivityCard component.
 *
 * @property recentActivity - Array of recent activity items sorted newest first
 */
export interface RecentActivityCardProps {
  recentActivity: ActivityItem[];
}

/**
 * Maps activity type to its icon, color, and badge label.
 */
function getActivityMeta(type: ActivityItem["type"]) {
  switch (type) {
    case "ai":
      return {
        icon: Sparkles,
        label: "AI",
        badgeClass: "bg-purple-500/15 text-purple-500",
      };
    case "manual":
      return {
        icon: Pencil,
        label: "Edit",
        badgeClass: "bg-blue-500/15 text-blue-500",
      };
    case "restore":
      return {
        icon: RotateCcw,
        label: "Restore",
        badgeClass: "bg-orange-500/15 text-orange-500",
      };
  }
}

/**
 * Formats an ISO date string into a human-readable relative time.
 */
function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSeconds = Math.floor((now - then) / 1000);

  if (diffSeconds < 60) return "Just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return new Date(isoDate).toLocaleDateString();
}

/**
 * RecentActivityCard renders compact activity rows in a scrollable container.
 * Each row has a type badge, prompt, project name, and timestamp.
 */
export function RecentActivityCard({
  recentActivity,
}: RecentActivityCardProps) {
  if (recentActivity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No activity yet. Your generation history will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <span className="text-xs text-muted-foreground">
            Last {recentActivity.length} events
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Scrollable list — capped at ~6 visible rows */}
        <div className="max-h-[320px] overflow-y-auto pr-1">
          <div className="space-y-1">
            {recentActivity.map((item, index) => {
              const meta = getActivityMeta(item.type);
              return (
                <div
                  key={`${item.projectId}-${item.createdAt}-${index}`}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-muted/40"
                >
                  {/* Type badge */}
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium",
                      meta.badgeClass
                    )}
                  >
                    <meta.icon className="size-3" />
                    {meta.label}
                  </span>

                  {/* Prompt + project name */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm">
                      {item.prompt || "No description"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.projectName}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
