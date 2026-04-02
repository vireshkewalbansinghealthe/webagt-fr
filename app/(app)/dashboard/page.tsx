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

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ProjectTable,
  EmptyState,
  CreateProjectDialog,
  DeleteProjectDialog,
  type ProjectDeletionInfo,
} from "@/components/dashboard";
import { UpgradeModal } from "@/components/dashboard/upgrade-modal";
import { SpotlightTour } from "@/components/dashboard/spotlight-tour";
import type { CreateProjectData } from "@/components/dashboard";
import type { Project } from "@/types/project";
import { createApiClient } from "@/lib/api-client";

type ViewMode = "grid" | "table";
type SortBy = "updated" | "created" | "name";
type FilterType = "all" | "website" | "webshop";

/**
 * DashboardPage renders the user's project list with live preview thumbnails.
 * Manages dialog state, loading state, project CRUD, and file fetching.
 * Uses the typed API client to communicate with the Worker backend.
 */
export default function DashboardPage() {
  const { getToken, isLoaded } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  /** Search / filter / sort / view state */
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortBy, setSortBy] = useState<SortBy>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  /** Whether the upgrade modal is open */
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  /** Project pending deletion (null = dialog closed) */
  const [deleteTarget, setDeleteTarget] = useState<ProjectDeletionInfo & { id: string } | null>(null);

  /** ID of the project being renamed (null = dialog closed) */
  const [renameTarget, setRenameTarget] = useState<string | null>(null);

  /** Current value of the rename input */
  const [renameValue, setRenameValue] = useState("");

  /** Ref for auto-focusing the rename input */
  const renameInputRef = useRef<HTMLInputElement>(null);

  /** Derived filtered + sorted list */
  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search by name
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Filter by type
    if (filterType !== "all") {
      result = result.filter((p) =>
        filterType === "webshop" ? p.type === "webshop" : p.type !== "webshop"
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "created")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [projects, search, filterType, sortBy]);

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
      const e = error as { isAuthError?: boolean; isNetworkError?: boolean };
      if (e.isAuthError || e.isNetworkError) return; // Clerk loading or worker unreachable
      console.error("Failed to fetch projects:", error);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    fetchProjects();
  }, [fetchProjects, isLoaded]);

  /**
   * Handles creating a new project from the dialog form.
   * Calls the API to create the project, then refreshes the list.
   */
  async function handleCreateProject(data: CreateProjectData) {
    try {
      const client = createApiClient(getToken);
      const result = await client.projects.create(data);

      // Store description in sessionStorage so the editor can auto-send it
      // as the first AI prompt (only when not using a ready-made template).
      const isTemplate = data.templateId && data.templateId !== "blank-ai";
      if (!isTemplate && data.description.trim()) {
        try {
          sessionStorage.setItem(
            `pendingPrompt:${result.project.id}`,
            data.description.trim()
          );
        } catch {
          // sessionStorage unavailable
        }
      }

      // Add a query param for webshops to trigger specific setup or feedback on the editor page if needed
      const url = data.type === 'webshop'
        ? `/project/${result.project.id}?type=webshop&setup=true`
        : `/project/${result.project.id}`;

        setDialogOpen(false);
        router.push(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create project";

      // Show the upgrade modal instead of a toast for plan limit errors
      if (
        message.toLowerCase().includes("free plan") ||
        message.toLowerCase().includes("limited to") ||
        message.toLowerCase().includes("upgrade")
      ) {
        setDialogOpen(false);
        setUpgradeModalOpen(true);
        // Rethrow so the dialog resets its own loading/form state
        throw error;
      }

      console.error("Failed to create project:", error);
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
    const p = projects.find((proj) => proj.id === id);
    if (!p) return;
    setDeleteTarget({
      id: p.id,
      name: p.name,
      type: p.type,
      deployment_uuid: p.deployment_uuid,
      databaseUrl: p.databaseUrl,
    });
  }

  /**
   * Confirms deletion — calls the API then removes from state.
   */
  async function confirmDelete() {
    if (!deleteTarget) return;
    const client = createApiClient(getToken);
    await client.projects.delete(deleteTarget.id);
    setProjects((previous) =>
      previous.filter((project) => project.id !== deleteTarget.id)
    );
    toast.success("Project deleted.");
  }

  const sortLabel: Record<SortBy, string> = {
    updated: "Last updated",
    created: "Date created",
    name: "Name",
  };

  const filterLabel: Record<FilterType, string> = {
    all: "All types",
    website: "Website",
    webshop: "Webshop",
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">My Projects</h1>
        {!loading && projects.length > 0 && (
          <Button data-tour="create-project" onClick={() => setDialogOpen(true)} className="gap-2 hidden sm:flex">
            <Plus className="size-4" />
            Create Project
          </Button>
        )}
      </div>

      {/* Toolbar: search + filters + view toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div data-tour="search" className="relative flex-1 min-w-[160px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-9"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter by type */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-9">
              {filterLabel[filterType]}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel>Filter by type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={filterType}
              onValueChange={(v) => setFilterType(v as FilterType)}
            >
              <DropdownMenuRadioItem value="all">All types</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="website">Website</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="webshop">Webshop</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort — hidden on smallest screens */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 h-9 hidden xs:flex sm:flex">
              {sortLabel[sortBy]}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortBy)}
            >
              <DropdownMenuRadioItem value="updated">Last updated</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="created">Date created</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View mode toggle */}
        <div className="ml-auto flex items-center rounded-md border border-border">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon-sm"
            className="rounded-r-none border-0 h-9 w-9"
            onClick={() => setViewMode("grid")}
            title="Grid view"
          >
            <LayoutGrid className="size-4" />
          </Button>
          <div className="w-px h-5 bg-border" />
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="icon-sm"
            className="rounded-l-none border-0 h-9 w-9"
            onClick={() => setViewMode("table")}
            title="Table view"
          >
            <List className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[240px] rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState onCreateProject={() => setDialogOpen(true)} />
      ) : viewMode === "table" ? (
        <ProjectTable
          projects={filteredProjects}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      ) : (
        <ProjectGrid
          projects={filteredProjects}
          onNewProject={() => setDialogOpen(true)}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      )}

      {/* Floating action button — mobile only */}
      <button
        onClick={() => setDialogOpen(true)}
        className="fixed bottom-6 right-5 z-30 sm:hidden flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform"
      >
        <Plus className="size-4" />
        New Project
      </button>

      {/* Create project dialog */}
      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreateProject}
      />

      {/* Upgrade modal — shown when free plan project limit is reached */}
      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
      />

      {/* Spotlight tour — shown once to new users */}
      <SpotlightTour />

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
      <DeleteProjectDialog
        project={deleteTarget}
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
