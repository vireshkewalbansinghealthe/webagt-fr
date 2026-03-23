/**
 * components/dashboard/project-grid.tsx
 *
 * Responsive grid of project cards for the dashboard.
 * Shows a "New Project" card as the first item (dashed border, plus icon)
 * followed by all user projects sorted by most recently updated.
 *
 * Grid responsive breakpoints:
 * - 1 column on mobile
 * - 2 columns on tablet (sm)
 * - 3 columns on desktop (lg)
 * - 4 columns on wide screens (xl)
 *
 * Used by: app/(app)/dashboard/page.tsx
 */

"use client";

import { Plus } from "lucide-react";
import type { Project } from "@/types/project";
import { Card } from "@/components/ui/card";
import { ProjectCard } from "./project-card";

/**
 * Props for the ProjectGrid component.
 *
 * @property projects - Array of projects to display in the grid
 * @property projectFiles - Map of projectId → files for live previews
 * @property onNewProject - Callback when the "New Project" card is clicked
 * @property onRename - Callback when rename is selected on a project card
 * @property onDelete - Callback when delete is selected on a project card
 */
export interface ProjectGridProps {
  projects: Project[];
  onNewProject: () => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * ProjectGrid renders a responsive grid with a "New Project" card
 * followed by project cards for each user project.
 */
export function ProjectGrid({
  projects,
  onNewProject,
  onRename,
  onDelete,
}: ProjectGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {/* New Project card — dashed border with plus icon */}
      <Card
        className="flex h-full cursor-pointer items-center justify-center gap-2 border-dashed transition-all duration-150 hover:brightness-[1.08]"
        onClick={onNewProject}
      >
        <Plus className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground">
          New Project
        </span>
      </Card>

      {/* User project cards */}
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          project={project}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
