/**
 * app/(app)/analytics/page.tsx
 *
 * Usage analytics dashboard page.
 * Shows aggregated statistics about the user's AI usage:
 * - Summary stat cards (generations, projects, credits, edits)
 * - SVG donut chart for model usage breakdown
 * - Circular progress ring for credit usage
 * - Scrollable project list with stats
 * - Compact scrollable recent activity feed
 *
 * Follows the same data-fetching pattern as the dashboard page:
 * useAuth + useState + useEffect with the typed API client.
 *
 * Protected by Clerk middleware — unauthenticated users are
 * redirected to /sign-in automatically.
 *
 * Used by: app/(app)/layout.tsx (via sidebar nav)
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  StatsCards,
  ModelBreakdownCard,
  CreditsChart,
  ProjectActivityCard,
  RecentActivityCard,
  AnalyticsSkeleton,
  EmptyAnalytics,
} from "@/components/analytics";
import type { AnalyticsData } from "@/types/analytics";
import { createApiClient } from "@/lib/api-client";

/**
 * AnalyticsPage fetches and renders usage analytics for the authenticated user.
 * Manages loading state with a skeleton and handles the empty state
 * when the user has no projects yet.
 */
export default function AnalyticsPage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetches analytics data from the Worker API.
   * Called once on mount via useEffect.
   */
  const fetchAnalytics = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const analytics = await client.analytics.get();
      setData(analytics);
    } catch (error) {
      console.error("Failed to fetch analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your AI usage, model preferences, and project activity.
        </p>
      </div>

      {/* Loading skeleton */}
      {loading && <AnalyticsSkeleton />}

      {/* Empty state — no projects yet */}
      {!loading && data && data.totalProjects === 0 && <EmptyAnalytics />}

      {/* Analytics content */}
      {!loading && data && data.totalProjects > 0 && (
        <div className="space-y-6">
          {/* Row 1: Summary stat cards */}
          <StatsCards
            totalGenerations={data.totalGenerations}
            totalProjects={data.totalProjects}
            creditsUsed={data.creditsUsed}
            creditsTotal={data.creditsTotal}
            totalManualEdits={data.totalManualEdits}
            plan={data.plan}
          />

          {/* Row 2: Charts — donut (wider) + credits ring (narrower) */}
          <div className="grid gap-6 md:grid-cols-5">
            <div className="md:col-span-3">
              <ModelBreakdownCard
                modelBreakdown={data.modelBreakdown}
                totalGenerations={data.totalGenerations}
              />
            </div>
            <div className="md:col-span-2">
              <CreditsChart
                creditsUsed={data.creditsUsed}
                creditsTotal={data.creditsTotal}
                plan={data.plan}
                periodEnd={data.periodEnd}
              />
            </div>
          </div>

          {/* Row 3: Projects + Recent activity — side by side, capped height */}
          <div className="grid gap-6 md:grid-cols-2">
            <ProjectActivityCard projectStats={data.projectStats} />
            <RecentActivityCard recentActivity={data.recentActivity} />
          </div>
        </div>
      )}
    </div>
  );
}
