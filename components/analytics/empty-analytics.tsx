/**
 * components/analytics/empty-analytics.tsx
 *
 * Empty state displayed on the analytics page when the user has no projects.
 * Encourages them to create their first project to start seeing stats.
 *
 * Used by: app/(app)/analytics/page.tsx
 */

import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * EmptyAnalytics renders a centered empty state with an icon,
 * descriptive text, and a CTA button linking to the dashboard.
 */
export function EmptyAnalytics() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-secondary">
        <BarChart3 className="size-8 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">No analytics yet</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Create a project and start generating code with AI to see your usage
        statistics, model preferences, and activity history here.
      </p>
      <Button asChild className="mt-6">
        <Link href="/dashboard">Go to Dashboard</Link>
      </Button>
    </div>
  );
}
