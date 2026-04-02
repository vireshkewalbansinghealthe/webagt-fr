/**
 * components/dashboard/delete-project-dialog.tsx
 *
 * A thorough confirmation dialog for permanent project deletion.
 * Lists every resource that will be destroyed (published deployment,
 * shop database, project files) and requires the user to type the
 * project name before the Delete button becomes active.
 *
 * Used by: dashboard/page.tsx, components/editor/project-menu.tsx
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Globe, Database, FolderOpen, MessageSquare } from "lucide-react";
/** Minimal project info needed by the dialog — no need to pass the full Project type. */
export interface ProjectDeletionInfo {
  name: string;
  type?: "website" | "webshop";
  /** Coolify application UUID — present when project has been published */
  deployment_uuid?: string;
  /** Turso database URL — present for webshop projects */
  databaseUrl?: string;
}

interface DeleteProjectDialogProps {
  project: ProjectDeletionInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the user confirms; the dialog closes itself on success. */
  onConfirm: () => Promise<void>;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onConfirm,
}: DeleteProjectDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const isWebshop = project?.type === "webshop";
  const isPublished = Boolean(project?.deployment_uuid);
  const hasDatabase = Boolean(project?.databaseUrl);

  const projectName = project?.name ?? "";
  const canDelete = confirmText === projectName && projectName.length > 0;

  async function handleDelete() {
    if (!canDelete || loading) return;
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
      setConfirmText("");
    }
  }

  function handleOpenChange(value: boolean) {
    if (!loading) {
      onOpenChange(value);
      if (!value) setConfirmText("");
    }
  }

  const resources: { icon: typeof Globe; label: string; description: string }[] = [];

  if (isPublished) {
    resources.push({
      icon: Globe,
      label: "Published website",
      description: "The live deployment on Coolify will be permanently removed and the URL will stop working.",
    });
  }

  if (hasDatabase) {
    resources.push({
      icon: Database,
      label: "Shop database",
      description: "All orders, products, customers, and shop data in the Turso database will be erased.",
    });
  }

  resources.push({
    icon: FolderOpen,
    label: "All project files & versions",
    description: "Every version of your code, assets, and build history will be deleted from storage.",
  });

  resources.push({
    icon: MessageSquare,
    label: "Chat history",
    description: "The entire AI conversation for this project will be removed.",
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5 shrink-0" />
            <DialogTitle className="text-destructive">
              Delete &ldquo;{projectName}&rdquo;?
            </DialogTitle>
          </div>
          <DialogDescription className="pt-1">
            {isWebshop
              ? "This will permanently delete the webshop, its live deployment, and all associated data."
              : "This will permanently delete the project and everything associated with it."}
            {" "}
            <strong>This action cannot be undone.</strong>
          </DialogDescription>
        </DialogHeader>

        {/* What gets deleted */}
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-destructive/80">
            The following will be permanently deleted
          </p>
          <ul className="space-y-2.5">
            {resources.map(({ icon: Icon, label, description }) => (
              <li key={label} className="flex items-start gap-3">
                <Icon className="size-4 mt-0.5 shrink-0 text-destructive/70" />
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-none">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Confirmation input */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Type <strong className="text-foreground select-none">{projectName}</strong> to confirm deletion:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canDelete && handleDelete()}
            placeholder={projectName}
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canDelete || loading}
          >
            {loading ? "Deleting…" : "Delete permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
