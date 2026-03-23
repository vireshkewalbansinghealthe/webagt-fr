/**
 * components/dashboard/index.ts
 *
 * Barrel export file for all dashboard components.
 * Provides a single import point for the dashboard page:
 *
 *   import { ProjectCard, ProjectGrid, EmptyState, CreateProjectDialog } from "@/components/dashboard";
 *
 * Used by: app/(app)/dashboard/page.tsx
 */

export { ProjectCard } from "./project-card";
export type { ProjectCardProps } from "./project-card";
export { ProjectGrid } from "./project-grid";
export type { ProjectGridProps } from "./project-grid";
export { EmptyState } from "./empty-state";
export type { EmptyStateProps } from "./empty-state";
export { CreateProjectDialog } from "./create-project-dialog";
export type { CreateProjectData, CreateProjectDialogProps } from "./create-project-dialog";
export { ProjectPreview } from "./project-preview";
export type { ProjectPreviewProps } from "./project-preview";
