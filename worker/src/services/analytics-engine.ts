/**
 * worker/src/services/analytics-engine.ts
 *
 * Core logic for computing usage analytics for a specific user.
 * Shared between the user-facing /api/analytics and the admin-facing
 * /api/admin/users/:userId/analytics endpoints.
 */

import type { Env } from "../types";
import type { Project, Version } from "../types/project";
import { getCredits } from "./credits";

const MAX_RECENT_ACTIVITY = 20;
const MAX_PROMPT_LENGTH = 120;

function truncatePrompt(prompt: string, maxLength: number): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength) + "...";
}

export async function computeUserAnalytics(userId: string, env: Env) {
  // Fetch user's project IDs from KV
  const projectIds =
    (await env.METADATA.get<string[]>(
      `user-projects:${userId}`,
      "json"
    )) ?? [];

  // Fetch all project metadata in parallel
  const projectPromises = projectIds.map((id) =>
    env.METADATA.get<Project>(`project:${id}`, "json").catch(() => null)
  );
  const projects = (await Promise.all(projectPromises)).filter(
    (p): p is Project => p !== null && p.userId === userId
  );

  // Fetch credit balance
  const credits = await getCredits(userId, env);
  const isUnlimited = credits.remaining === -1;

  // If user has no projects, return empty analytics
  if (projects.length === 0) {
    return {
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
    };
  }

  // For each project, fetch all version metadata from R2 in parallel
  interface VersionWithProject {
    version: Version;
    projectId: string;
    projectName: string;
  }

  const allVersions: VersionWithProject[] = [];

  const projectVersionPromises = projects.map(async (project) => {
    const versionPromises: Promise<Version | null>[] = [];

    for (let v = 0; v <= project.currentVersion; v++) {
      versionPromises.push(
        env.FILES.get(`${project.id}/v${v}/files.json`)
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

  // Recent activity collection
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

    if (version.type === "ai" && version.versionNumber > 0) {
      totalGenerations++;
      if (stats) stats.aiGenerations++;

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

  const totalAiCount = totalGenerations || 1;
  const modelBreakdown = Array.from(modelCounts.entries())
    .map(([modelId, count]) => ({
      modelId,
      modelName: modelId,
      count,
      percentage: Math.round((count / totalAiCount) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  activityItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const recentActivity = activityItems.slice(0, MAX_RECENT_ACTIVITY);

  const projectStats = Array.from(projectStatsMap.values()).sort(
    (a, b) =>
      new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
  );

  const creditsUsed = isUnlimited ? 0 : credits.total - credits.remaining;

  return {
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
  };
}
