/**
 * types/analytics.ts
 *
 * TypeScript interfaces for the usage analytics dashboard.
 * Defines the shape of data returned by the analytics API endpoint
 * and consumed by the frontend analytics components.
 *
 * Used by: app/(app)/analytics/page.tsx, components/analytics/*,
 *          worker/src/routes/analytics.ts, lib/api-client.ts
 */

/**
 * Breakdown of usage per AI model.
 *
 * @property modelId - The model's unique identifier (e.g., "claude-sonnet-4-5")
 * @property modelName - Human-readable display name
 * @property count - Number of AI generations using this model
 * @property percentage - Share of total AI generations (0–100)
 */
export interface ModelUsage {
  modelId: string;
  modelName: string;
  count: number;
  percentage: number;
}

/**
 * A single recent activity event in the timeline.
 *
 * @property type - How the version was created (ai, manual, restore)
 * @property projectName - Display name of the project
 * @property projectId - Project ID for linking
 * @property model - AI model used (empty string for manual/restore)
 * @property prompt - Truncated prompt or description (max 120 chars)
 * @property createdAt - ISO 8601 timestamp
 */
export interface ActivityItem {
  type: "ai" | "manual" | "restore";
  projectName: string;
  projectId: string;
  model: string;
  prompt: string;
  createdAt: string;
}

/**
 * Per-project statistics for the analytics dashboard.
 *
 * @property projectId - Unique project identifier
 * @property projectName - Display name of the project
 * @property versionCount - Total number of versions (including v0)
 * @property aiGenerations - Number of AI-generated versions
 * @property lastActivity - ISO 8601 timestamp of the most recent version
 */
export interface ProjectStat {
  projectId: string;
  projectName: string;
  versionCount: number;
  aiGenerations: number;
  lastActivity: string;
}

/**
 * Full analytics response returned by the GET /api/analytics endpoint.
 * Aggregates data from projects, versions, and credits.
 */
export interface AnalyticsData {
  totalProjects: number;
  totalGenerations: number;
  totalManualEdits: number;
  totalRestores: number;
  creditsUsed: number;
  creditsTotal: number;
  plan: "free" | "pro";
  periodEnd: string;
  modelBreakdown: ModelUsage[];
  recentActivity: ActivityItem[];
  projectStats: ProjectStat[];
}
