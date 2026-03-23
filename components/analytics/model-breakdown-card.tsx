/**
 * components/analytics/model-breakdown-card.tsx
 *
 * Card showing AI model usage with an SVG donut chart, legend,
 * and horizontal percentage bars. The donut chart visually represents
 * the proportion of generations per model. The legend lists each model
 * with its color, count, percentage, and a progress bar.
 *
 * Uses getModelById() from lib/models.ts for display names.
 * No external charting library — pure SVG with stroke-dasharray.
 *
 * Used by: app/(app)/analytics/page.tsx
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getModelById } from "@/lib/models";
import type { ModelUsage } from "@/types/analytics";

/**
 * Props for the ModelBreakdownCard component.
 *
 * @property modelBreakdown - Array of model usage records with counts and percentages
 * @property totalGenerations - Total AI generations for the center label
 */
export interface ModelBreakdownCardProps {
  modelBreakdown: ModelUsage[];
  totalGenerations: number;
}

/**
 * Color palette for donut chart segments.
 * Assigned by index position in the sorted modelBreakdown array.
 */
const SEGMENT_COLORS = [
  "#a855f7", // purple-500
  "#3b82f6", // blue-500
  "#22c55e", // green-500
  "#f97316", // orange-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#eab308", // yellow-500
  "#8b5cf6", // violet-500
];

/** Donut chart dimensions */
const SIZE = 180;
const STROKE_WIDTH = 28;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * ModelBreakdownCard renders an SVG donut chart with a color-coded legend
 * and percentage bars. The chart center shows the total number of AI
 * generations. The legend fills the space with visual progress indicators.
 */
export function ModelBreakdownCard({
  modelBreakdown,
  totalGenerations,
}: ModelBreakdownCardProps) {
  if (modelBreakdown.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Model Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-6">
            {/* Empty donut ring */}
            <svg width={SIZE} height={SIZE} className="opacity-30">
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                className="text-secondary"
              />
            </svg>
            <p className="text-sm text-muted-foreground">
              No AI generations yet
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build donut segments — each segment is a circle with stroke-dasharray
  let cumulativePercentage = 0;
  const segments = modelBreakdown.map((model, index) => {
    const segmentLength = (model.percentage / 100) * CIRCUMFERENCE;
    const gapLength = CIRCUMFERENCE - segmentLength;
    const rotation = (cumulativePercentage / 100) * 360 - 90; // -90 to start at top
    cumulativePercentage += model.percentage;

    return {
      modelId: model.modelId,
      color: SEGMENT_COLORS[index % SEGMENT_COLORS.length],
      dashArray: `${segmentLength} ${gapLength}`,
      rotation,
    };
  });

  // Find the top model for the highlight
  const topModel = modelBreakdown[0];
  const topModelInfo = getModelById(topModel.modelId);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Model Usage</CardTitle>
          <span className="text-xs text-muted-foreground">
            {modelBreakdown.length} model{modelBreakdown.length !== 1 ? "s" : ""} used
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          {/* Donut chart */}
          <div className="relative shrink-0">
            <svg width={SIZE} height={SIZE}>
              {/* Background ring */}
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                className="text-secondary"
              />
              {/* Colored segments */}
              {segments.map((seg) => (
                <circle
                  key={seg.modelId}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={seg.dashArray}
                  strokeLinecap="butt"
                  transform={`rotate(${seg.rotation} ${SIZE / 2} ${SIZE / 2})`}
                  className="transition-all duration-500"
                />
              ))}
            </svg>
            {/* Center label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{totalGenerations}</span>
              <span className="text-xs text-muted-foreground">total</span>
            </div>
          </div>

          {/* Legend with percentage bars */}
          <div className="flex flex-1 flex-col gap-3 w-full">
            {/* Most used highlight */}
            <div className="mb-1 rounded-lg bg-muted/40 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Most Used
              </p>
              <p className="mt-0.5 text-sm font-semibold">
                {topModelInfo?.name ?? topModel.modelId}
              </p>
              <p className="text-xs text-muted-foreground">
                {topModel.count} generations &middot; {topModel.percentage}%
              </p>
            </div>

            {/* Model list with bars */}
            {modelBreakdown.map((model, index) => {
              const modelInfo = getModelById(model.modelId);
              const displayName = modelInfo?.name ?? model.modelId;
              const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];

              return (
                <div key={model.modelId} className="space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="truncate text-sm">{displayName}</span>
                    </div>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {model.count} ({model.percentage}%)
                    </span>
                  </div>
                  {/* Percentage bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${model.percentage}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
