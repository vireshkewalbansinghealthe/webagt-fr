/**
 * worker/src/routes/analytics.ts
 *
 * Hono router for the usage analytics endpoint.
 * Aggregates data from existing KV/R2 stores to build a complete
 * picture of the user's usage: generation counts, model breakdown,
 * per-project stats, and recent activity.
 *
 * Endpoint:
 * - GET /api/analytics — Returns aggregated analytics for the authenticated user
 *
 * Data sources:
 * - KV `user-projects:{userId}` — list of project IDs
 * - KV `project:{projectId}` — project metadata (name, currentVersion)
 * - R2 `{projectId}/v{n}/files.json` — version metadata (type, model, prompt)
 * - KV `credits:{userId}` — credit balance and plan info
 *
 * Used by: worker/src/index.ts (mounted at /api/analytics)
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import type { Project, Version } from "../types/project";
import { getCredits } from "../services/credits";

/**
 * Create a Hono router with typed bindings and variables.
 * Auth middleware sets `c.var.userId` before these handlers run.
 */
const analyticsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/**
 * Maximum number of recent activity items to return.
 */
const MAX_RECENT_ACTIVITY = 20;

/**
 * Maximum prompt length before truncation.
 */
const MAX_PROMPT_LENGTH = 120;

/**
 * Truncates a string to the specified max length, adding "..." if truncated.
 */
function truncatePrompt(prompt: string, maxLength: number): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength) + "...";
}

// ---------------------------------------------------------------------------
// GET /api/analytics — Aggregated usage analytics
// ---------------------------------------------------------------------------

/**
 * Returns aggregated analytics data for the authenticated user.
 * Fetches all projects, scans their version histories, and computes:
 * - Total generations, manual edits, restores
 * - Model usage breakdown with percentages
 * - Per-project statistics
 * - Recent activity timeline
 * - Credit balance and plan info
 *
 * Response shape matches the AnalyticsData interface in types/analytics.ts.
 */
analyticsRoutes.get("/", async (c) => {
  const userId = c.var.userId;

  // Fetch user's project IDs from KV
  const projectIds =
    (await c.env.METADATA.get<string[]>(
      `user-projects:${userId}`,
      "json"
    )) ?? [];

  // Fetch all project metadata in parallel
  const projectPromises = projectIds.map((id) =>
    c.env.METADATA.get<Project>(`project:${id}`, "json").catch(() => null)
  );
  const projects = (await Promise.all(projectPromises)).filter(
    (p): p is Project => p !== null && p.userId === userId
  );

  // Fetch credit balance
  const credits = await getCredits(userId, c.env);
  const isUnlimited = credits.remaining === -1;

  // If user has no projects, return empty analytics
  if (projects.length === 0) {
    return c.json({
      totalProjects: 0,
      totalGenerations: 0,
      totalManualEdits: 0,
      totalRestores: 0,
      creditsUsed: isUnlimited ? 0 : credits.total - credits.remaining,
      creditsTotal: credits.total,
      plan: credits.plan,
      periodEnd: credits.periodEnd,
      modelBreakdown: [],
      recentActivity: [],
      projectStats: [],
    });
  }

  // For each project, fetch all version metadata from R2 in parallel
  // We build a flat list of all versions across all projects
  interface VersionWithProject {
    version: Version;
    projectId: string;
    projectName: string;
  }

  const allVersions: VersionWithProject[] = [];

  // Fetch versions for all projects in parallel
  const projectVersionPromises = projects.map(async (project) => {
    const versionPromises: Promise<Version | null>[] = [];

    for (let v = 0; v <= project.currentVersion; v++) {
      versionPromises.push(
        c.env.FILES.get(`${project.id}/v${v}/files.json`)
          .then((obj) => (obj ? (obj.json() as Promise<Version>) : null))
          .catch(() => null)
      );
    }

    const versions = await Promise.all(versionPromises);

    return versions
      .filter((v): v is Version => v !== null)
      .map((version) => ({
        version,
        projectId: project.id,
        projectName: project.name,
      }));
  });

  const projectVersionArrays = await Promise.all(projectVersionPromises);
  for (const versions of projectVersionArrays) {
    allVersions.push(...versions);
  }

  // Aggregate counters
  let totalGenerations = 0;
  let totalManualEdits = 0;
  let totalRestores = 0;

  // Model usage tracking
  const modelCounts = new Map<string, number>();

  // Per-project stats
  const projectStatsMap = new Map<
    string,
    {
      projectId: string;
      projectName: string;
      versionCount: number;
      aiGenerations: number;
      lastActivity: string;
    }
  >();

  // Initialize project stats
  for (const project of projects) {
    projectStatsMap.set(project.id, {
      projectId: project.id,
      projectName: project.name,
      versionCount: 0,
      aiGenerations: 0,
      lastActivity: project.updatedAt,
    });
  }

  // Recent activity collection (all events, sorted later)
  const activityItems: Array<{
    type: "ai" | "manual" | "restore";
    projectName: string;
    projectId: string;
    model: string;
    prompt: string;
    createdAt: string;
  }> = [];

  // Process all versions
  for (const { version, projectId, projectName } of allVersions) {
    const stats = projectStatsMap.get(projectId);
    if (stats) {
      stats.versionCount++;
    }

    // Count by type (skip v0 initial template from AI generation count)
    if (version.type === "ai" && version.versionNumber > 0) {
      totalGenerations++;
      if (stats) stats.aiGenerations++;

      // Track model usage (only for AI-generated versions with a model)
      if (version.model) {
        modelCounts.set(
          version.model,
          (modelCounts.get(version.model) ?? 0) + 1
        );
      }
    } else if (version.type === "manual") {
      totalManualEdits++;
    } else if (version.type === "restore") {
      totalRestores++;
    }

    // Track activity (skip v0 — that's just the initial template)
    if (version.versionNumber > 0) {
      activityItems.push({
        type: version.type,
        projectName,
        projectId,
        model: version.model ?? "",
        prompt: truncatePrompt(version.prompt ?? "", MAX_PROMPT_LENGTH),
        createdAt: version.createdAt,
      });
    }
  }

  // Build model breakdown with percentages
  const totalAiCount = totalGenerations || 1; // avoid division by zero
  const modelBreakdown = Array.from(modelCounts.entries())
    .map(([modelId, count]) => ({
      modelId,
      modelName: modelId, // Frontend resolves display names via getModelById()
      count,
      percentage: Math.round((count / totalAiCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // Sort recent activity by date (newest first), limit to MAX_RECENT_ACTIVITY
  activityItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const recentActivity = activityItems.slice(0, MAX_RECENT_ACTIVITY);

  // Build project stats array sorted by most recent activity
  const projectStats = Array.from(projectStatsMap.values()).sort(
    (a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  // Compute credits used (only meaningful for free users)
  const creditsUsed = isUnlimited ? 0 : credits.total - credits.remaining;

  return c.json({
    totalProjects: projects.length,
    totalGenerations,
    totalManualEdits,
    totalRestores,
    creditsUsed,
    creditsTotal: credits.total,
    plan: credits.plan,
    periodEnd: credits.periodEnd,
    modelBreakdown,
    recentActivity,
    projectStats,
  });
});

export { analyticsRoutes };
