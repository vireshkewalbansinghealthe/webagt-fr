/**
 * components/analytics/project-activity-card.tsx
 *
 * Card showing per-project statistics: version count, AI generations,
 * and last activity timestamp. Capped at a fixed height with scrolling.
 * Each project links to its editor page.
 *
 * Used by: app/(app)/analytics/page.tsx
 */

import Link from "next/link";
import { FolderOpen, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectStat } from "@/types/analytics";

/**
 * Props for the ProjectActivityCard component.
 *
 * @property projectStats - Array of per-project statistics
 */
export interface ProjectActivityCardProps {
  projectStats: ProjectStat[];
}

/**
 * Formats an ISO date string into a human-readable relative time.
 * Shows "Just now", "Xm ago", "Xh ago", "Xd ago", or a date.
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
 * ProjectActivityCard displays a scrollable list of the user's projects
 * with key stats and links. Capped at ~5 visible items.
 */
export function ProjectActivityCard({
  projectStats,
}: ProjectActivityCardProps) {
  if (projectStats.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No projects yet. Create your first project to see stats here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Projects</CardTitle>
          <span className="text-xs text-muted-foreground">
            {projectStats.length} total
          </span>
        </div>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
        {/* Scrollable container — max ~5 items visible */}
        <div className="max-h-[280px] space-y-2 overflow-y-auto pr-1">
          {projectStats.map((project) => (
            <Link
              key={project.projectId}
              href={`/project/${project.projectId}`}
              className="group flex items-center justify-between rounded-lg border border-border p-2.5 transition-colors duration-150 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary">
                  <FolderOpen className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {project.projectName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {project.versionCount} ver &middot;{" "}
                    {project.aiGenerations} AI
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 ml-2">
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(project.lastActivity)}
                </span>
                <ArrowRight className="size-3 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
