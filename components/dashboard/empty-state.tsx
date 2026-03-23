/**
 * components/dashboard/empty-state.tsx
 *
 * Empty state displayed when a user has no projects yet.
 * Shows a folder icon, encouraging heading, description, and
 * a CTA button to create their first project.
 *
 * This is the first thing new users see after signing up and
 * navigating to the dashboard.
 *
 * Used by: app/(app)/dashboard/page.tsx
 */

import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Props for the EmptyState component.
 *
 * @property onCreateProject - Callback when the "Create Project" button is clicked
 */
export interface EmptyStateProps {
  onCreateProject: () => void;
}

/**
 * EmptyState renders a centered message encouraging the user
 * to create their first project. The button triggers the
 * create project dialog.
 */
export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <FolderOpen className="size-8 text-muted-foreground" />
      </div>
      <h2 className="mt-6 text-xl font-semibold">No projects yet</h2>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        Create your first project to start building with AI. Describe your idea
        and watch it come to life.
      </p>
      <Button className="mt-6" onClick={onCreateProject}>
        Create Project
      </Button>
    </div>
  );
}
