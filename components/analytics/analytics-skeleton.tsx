/**
 * components/analytics/analytics-skeleton.tsx
 *
 * Skeleton loading state for the analytics page.
 * Matches the layout of the real analytics components:
 * 4 stat cards, charts row, projects + activity row.
 *
 * Used by: app/(app)/analytics/page.tsx
 */

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

/**
 * AnalyticsSkeleton renders placeholder UI while analytics data is loading.
 * Mirrors the exact layout of the fully-loaded analytics page.
 */
export function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Row 1: Stat cards — 2x2 on mobile, 4 across on desktop */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-4 rounded" />
              </div>
              <Skeleton className="mt-2 h-8 w-16" />
              <Skeleton className="mt-1 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Row 2: Charts — donut skeleton (wider) + credits ring skeleton */}
      <div className="grid gap-6 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader>
            <Skeleton className="h-5 w-28" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
              {/* Donut placeholder */}
              <Skeleton className="size-[160px] shrink-0 rounded-full" />
              {/* Legend placeholder */}
              <div className="flex flex-1 flex-col gap-2.5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-2.5 rounded-full" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-4 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <Skeleton className="h-5 w-16" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <Skeleton className="size-[120px] rounded-full" />
              <div className="space-y-1 text-center">
                <Skeleton className="mx-auto h-4 w-24" />
                <Skeleton className="mx-auto h-3 w-20" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Projects + Activity — side by side */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-20" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-border p-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-7 rounded-md" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-2 py-2">
                <Skeleton className="h-5 w-14 rounded-md" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
