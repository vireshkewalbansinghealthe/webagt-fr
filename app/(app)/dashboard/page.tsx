/**
 * app/(app)/dashboard/page.tsx
 *
 * Dashboard page — the authenticated user's home screen.
 * Shows a grid of their projects with live Sandpack preview thumbnails,
 * or an empty state for new users.
 *
 * Features:
 * - Top bar with "My Projects" heading and "Create Project" button
 * - ProjectGrid with live preview thumbnails when projects exist
 * - EmptyState when empty
 * - CreateProjectDialog for new project creation
 * - Fetches projects from the Worker API, then files per project for previews
 * - Skeleton loading state while fetching
 *
 * Protected by Clerk middleware — unauthenticated users are
 * redirected to /sign-in automatically.
 *
 * Used by: app/(app)/layout.tsx
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ProjectGrid,
  EmptyState,
  CreateProjectDialog,
} from "@/components/dashboard";
import type { CreateProjectData } from "@/components/dashboard";
import type { Project } from "@/types/project";
import { createApiClient } from "@/lib/api-client";

/**
 * DashboardPage renders the user's project list with live preview thumbnails.
 * Manages dialog state, loading state, project CRUD, and file fetching.
 * Uses the typed API client to communicate with the Worker backend.
 */
export default function DashboardPage() {
  const { getToken } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  /** ID of the project pending deletion (null = dialog closed) */
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  /** ID of the project being renamed (null = dialog closed) */
  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  /** Current value of the rename input */
  const [renameValue, setRenameValue] = useState("");

  /** Ref for auto-focusing the rename input */
  const renameInputRef = useRef<HTMLInputElement>(null);

  /**
   * Fetches the user's projects from the API.
   * Called on mount and after create/delete operations.
   */
  const fetchProjects = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const data = await client.projects.list();
      setProjects(data.projects);
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /**
   * Handles creating a new project from the dialog form.
   * Calls the API to create the project, then refreshes the list.
   */
  async function handleCreateProject(data: CreateProjectData) {
    try {
      const client = createApiClient(getToken);
      const result = await client.projects.create(data);

      // Store description in sessionStorage so the editor can auto-send it
      // as the first AI prompt. The editor consumes and deletes the key.
        try {
          sessionStorage.setItem(
            `pendingPrompt:${result.project.id}`,
            data.description.trim()
          );
        } catch {
          // sessionStorage unavailable
        }

        // Add a query param for webshops to trigger specific setup or feedback on the editor page if needed
        const url = data.type === 'webshop' 
          ? `/project/${result.project.id}?type=webshop&setup=true`
          : `/project/${result.project.id}`;

        setDialogOpen(false);
        router.push(url);
      } catch (error) {
      console.error("Failed to create project:", error);
      const message =
        error instanceof Error ? error.message : "Failed to create project";
      toast.error(message);
    }
  }

  /**
   * Opens the rename dialog for a project, pre-filling its current name.
   */
  function handleRename(id: string) {
    const project = projects.find((p) => p.id === id);
    if (!project) return;
    setRenameValue(project.name);
    setRenameTarget(id);
    // Auto-focus after the dialog renders
    setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);
  }

  /**
   * Confirms the rename — calls the API and updates local state.
   */
  async function confirmRename() {
    if (!renameTarget) return;
    const trimmed = renameValue.trim();
    const original = projects.find((p) => p.id === renameTarget);
    if (!trimmed || trimmed === original?.name) {
      setRenameTarget(null);
      return;
    }

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) => (p.id === renameTarget ? { ...p, name: trimmed } : p))
    );
    setRenameTarget(null);

    try {
      const client = createApiClient(getToken);
      await client.projects.update(renameTarget, { name: trimmed });
      toast.success("Project renamed");
    } catch {
      // Revert on failure
      setProjects((prev) =>
        prev.map((p) =>
          p.id === renameTarget ? { ...p, name: original?.name ?? p.name } : p
        )
      );
      toast.error("Failed to rename project");
    }
  }

  /**
   * Opens the delete confirmation dialog for a project.
   */
  function handleDelete(id: string) {
    setDeleteTarget(id);
  }

  /**
   * Confirms deletion — calls the API then removes from state.
   */
  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      const client = createApiClient(getToken);
      await client.projects.delete(deleteTarget);
      setProjects((previous) =>
        previous.filter((project) => project.id !== deleteTarget)
      );
      toast.success("Project deleted.");
    } catch (error) {
      console.error("Failed to delete project:", error);
      toast.error("Failed to delete project. Try again.");
    } finally {
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Top bar with heading and create button */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Projects</h1>
        <Button onClick={() => setDialogOpen(true)} className="gap-2">
          <Plus className="size-4" />
          Create Project
        </Button>
      </div>

      {/* Loading skeletons */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[240px] rounded-xl" />
          ))}
        </div>
      ) : projects.length > 0 ? (
        <ProjectGrid
          projects={projects}
          onNewProject={() => setDialogOpen(true)}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ) : (
        <EmptyState onCreateProject={() => setDialogOpen(true)} />
      )}

      {/* Create project dialog */}
      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateProject}
      />

      {/* Rename project dialog */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Enter a new name for your project.
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                confirmRename();
              }
              if (event.key === "Escape") {
                setRenameTarget(null);
              }
            }}
            placeholder="Project name"
            maxLength={100}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRenameTarget(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={confirmRename}
              disabled={
                !renameValue.trim() ||
                renameValue.trim() ===
                  projects.find((p) => p.id === renameTarget)?.name
              }
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the project and all its versions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
