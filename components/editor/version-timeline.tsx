/**
 * components/editor/version-timeline.tsx
 *
 * Vertical timeline showing the version history of a project.
 * Each entry represents a version (AI generation, manual edit, or restore)
 * with its prompt, model, changed file count, and timestamp.
 *
 * Layout:
 * ┌─────────────────────────────────────┐
 * │  Version History            [Compare]│
 * │                                      │
 * │  Current ──▶  ● v3  "Add dark mode" │
 * │               │     Claude · 2 files │
 * │               │     12:30 PM         │
 * │               │                      │
 * │               ● v2  "Build todo app" │
 * │               │     Claude · 3 files │
 * │               │     12:00 PM         │
 * │               │                      │
 * │               ● v1  "Initial setup"  │
 * │                     System · 11:00AM │
 * └─────────────────────────────────────┘
 *
 * Features:
 * - Vertical dots connected by lines
 * - Current version highlighted with accent color
 * - Type badges (AI Generation, Manual Edit, Restore)
 * - Click to view version files
 * - Restore button on hover for non-current versions
 * - Scrolls to current version on mount
 *
 * Used by: app/(app)/project/[projectId]/page.tsx (via EditorLayout)
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { VersionMeta } from "@/types/project";
import {
  Bot,
  Pencil,
  RotateCcw,
  FileCode,
  GitCompare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/**
 * Props for the VersionTimeline component.
 *
 * @property versions - Array of version metadata sorted newest first
 * @property currentVersion - The project's current (latest) version number
 * @property viewingVersion - Version currently being viewed (null = current)
 * @property onViewVersion - Callback when user clicks a version to preview it
 * @property onRestoreVersion - Callback when user clicks the Restore button
 * @property onCompareVersions - Callback to open diff view between two versions
 * @property isLoading - Whether versions are still being fetched
 */
export interface VersionTimelineProps {
  versions: VersionMeta[];
  currentVersion: number;
  viewingVersion: number | null;
  onViewVersion: (versionNumber: number) => void;
  onRestoreVersion: (versionNumber: number) => void;
  onCompareVersions: (from: number, to: number) => void;
  isLoading?: boolean;
}

/**
 * Returns a user-friendly label and icon for a version type.
 */
function getVersionTypeBadge(type: VersionMeta["type"]) {
  switch (type) {
    case "ai":
      return { label: "AI Generation", icon: Bot, variant: "default" as const };
    case "manual":
      return { label: "Manual Edit", icon: Pencil, variant: "secondary" as const };
    case "restore":
      return { label: "Restore", icon: RotateCcw, variant: "outline" as const };
  }
}

/**
 * Formats a timestamp into a human-readable relative or absolute time.
 * Shows "Just now" for recent, "12:30 PM" for today, or "Jan 15" for older.
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Truncates a prompt string to a maximum length with ellipsis.
 */
function truncatePrompt(prompt: string, maxLength: number = 60): string {
  if (prompt.length <= maxLength) return prompt;
  return prompt.slice(0, maxLength).trimEnd() + "...";
}

/**
 * VersionTimeline renders a vertical timeline of all project versions.
 * Clicking an entry loads that version's files into the preview.
 * The current version is highlighted with an accent dot.
 */
export function VersionTimeline({
  versions,
  currentVersion,
  viewingVersion,
  onViewVersion,
  onRestoreVersion,
  onCompareVersions,
  isLoading,
}: VersionTimelineProps) {
  const currentRef = useRef<HTMLDivElement>(null);

  /** Version number pending restore confirmation (null = dialog closed) */
  const [restoreConfirmVersion, setRestoreConfirmVersion] = useState<number | null>(null);

  // Scroll to current version on mount
  useEffect(() => {
    if (currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [versions.length]);

  if (isLoading) {
    return <VersionTimelineSkeleton />;
  }

  if (versions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <FileCode className="size-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No version history yet. Send a message to generate your first version.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-medium text-foreground">Version History</h3>
        {versions.length >= 2 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground"
            onClick={() => {
              // Compare previous version with current
              const prev = versions.length >= 2 ? versions[1].versionNumber : 0;
              onCompareVersions(prev, currentVersion);
            }}
          >
            <GitCompare className="size-3.5" />
            Compare
          </Button>
        )}
      </div>

      {/* Timeline */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          {versions.map((version, index) => {
            const isCurrent = version.versionNumber === currentVersion;
            const isViewing = version.versionNumber === viewingVersion;
            const isLast = index === versions.length - 1;
            const typeBadge = getVersionTypeBadge(version.type);
            const TypeIcon = typeBadge.icon;

            return (
              <div
                key={version.versionNumber}
                ref={isCurrent ? currentRef : undefined}
                className="relative flex gap-3"
              >
                {/* Timeline line and dot */}
                <div className="flex flex-col items-center">
                  {/* Dot */}
                  <div
                    className={cn(
                      "relative z-10 flex size-3 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150",
                      isCurrent
                        ? "border-primary bg-primary"
                        : isViewing
                          ? "border-blue-500 bg-blue-500"
                          : "border-muted-foreground/40 bg-background"
                    )}
                  />

                  {/* Connecting line */}
                  {!isLast && (
                    <div className="w-px flex-1 bg-border" />
                  )}
                </div>

                {/* Version card */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onViewVersion(version.versionNumber)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onViewVersion(version.versionNumber);
                    }
                  }}
                  className={cn(
                    "group mb-4 flex-1 cursor-pointer rounded-lg border p-3 text-left transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isViewing
                      ? "border-blue-500/50 bg-blue-500/5"
                      : isCurrent
                        ? "border-primary/30 bg-primary/5"
                        : "border-border hover:border-border/80 hover:bg-muted/30"
                  )}
                >
                  {/* Top row: version number + badge */}
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold",
                        isCurrent
                          ? "text-primary"
                          : isViewing
                            ? "text-blue-500"
                            : "text-muted-foreground"
                      )}
                    >
                      v{version.versionNumber}
                    </span>

                    <Badge
                      variant={typeBadge.variant}
                      className="h-5 gap-1 px-1.5 text-[10px]"
                    >
                      <TypeIcon className="size-2.5" />
                      {typeBadge.label}
                    </Badge>

                    {isCurrent && (
                      <Badge
                        variant="default"
                        className="h-5 px-1.5 text-[10px]"
                      >
                        Current
                      </Badge>
                    )}
                  </div>

                  {/* Prompt text */}
                  <p className="mb-1.5 text-sm text-foreground">
                    {truncatePrompt(version.prompt || "No description")}
                  </p>

                  {/* Metadata row: model + files + timestamp */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {version.model && version.type === "ai" && (
                      <span className="truncate">
                        {version.model.split("-").slice(0, 2).join(" ")}
                      </span>
                    )}

                    {version.type === "restore" && version.restoredFrom !== undefined && (
                      <span>from v{version.restoredFrom}</span>
                    )}

                    {version.changedFiles.length > 0 && (
                      <>
                        <span className="text-border">·</span>
                        <span>
                          {version.changedFiles.length} file
                          {version.changedFiles.length !== 1 ? "s" : ""} changed
                        </span>
                      </>
                    )}

                    <span className="text-border">·</span>
                    <span>{formatTimestamp(version.createdAt)}</span>
                  </div>

                  {/* Restore button — only for non-current versions, shown on hover */}
                  {!isCurrent && (
                    <div className="mt-2 flex gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRestoreConfirmVersion(version.versionNumber);
                        }}
                      >
                        <RotateCcw className="size-3" />
                        Restore
                      </Button>

                      {/* Compare with current */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompareVersions(
                            version.versionNumber,
                            currentVersion
                          );
                        }}
                      >
                        <GitCompare className="size-3" />
                        Diff
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Restore confirmation dialog */}
      <Dialog
        open={restoreConfirmVersion !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreConfirmVersion(null);
        }}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Restore version {restoreConfirmVersion}?</DialogTitle>
            <DialogDescription>
              This will create a new version with the files from v{restoreConfirmVersion}.
              Your current version and history will not be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreConfirmVersion(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (restoreConfirmVersion !== null) {
                  onRestoreVersion(restoreConfirmVersion);
                  setRestoreConfirmVersion(null);
                }
              }}
            >
              <RotateCcw className="mr-1.5 size-3.5" />
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Loading skeleton for the version timeline.
 * Shows placeholder dots and cards while versions are being fetched.
 */
function VersionTimelineSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex-1 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <div className="size-3 rounded-full bg-muted" />
              {i < 3 && <div className="w-px flex-1 bg-border" />}
            </div>
            <div className="mb-4 flex-1 rounded-lg border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-8 animate-pulse rounded bg-muted" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-muted" />
              </div>
              <div className="mb-2 h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
