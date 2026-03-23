/**
 * components/editor/version-diff.tsx
 *
 * Monaco DiffEditor wrapper for viewing changes between two versions.
 * Shows side-by-side file diffs with a file selector dropdown.
 *
 * Layout:
 * ┌────────────────────────────────────┐
 * │ Comparing v2 → v3           [Close]│
 * │                                     │
 * │ Files changed:                      │
 * │ ┌─────────────────────────────┐    │
 * │ │ src/App.tsx (modified)    ▼ │    │
 * │ └─────────────────────────────┘    │
 * │                                     │
 * │ ┌───────────────────────────────┐  │
 * │ │  Diff Editor                   │  │
 * │ │  - old line                    │  │
 * │ │  + new line                    │  │
 * │ └───────────────────────────────┘  │
 * └────────────────────────────────────┘
 *
 * Features:
 * - Side-by-side diff view (Monaco DiffEditor)
 * - File selector dropdown for multi-file diffs
 * - Color-coded: green for additions, red for deletions
 * - Read-only mode
 *
 * Used by: app/(app)/project/[projectId]/page.tsx (via EditorLayout)
 */

"use client";

import { useState, useMemo } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { cn } from "@/lib/utils";
import { X, FilePlus, FileX, FileEdit } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * A single change between two versions.
 */
export interface DiffChange {
  path: string;
  type: "added" | "removed" | "modified";
  oldContent: string | null;
  newContent: string | null;
}

/**
 * Props for the VersionDiff component.
 *
 * @property from - The "from" version number
 * @property to - The "to" version number
 * @property changes - Array of file changes between the two versions
 * @property onClose - Callback to close the diff viewer
 */
export interface VersionDiffProps {
  from: number;
  to: number;
  changes: DiffChange[];
  onClose: () => void;
}

/**
 * Returns the appropriate icon for a diff change type.
 */
function getChangeIcon(type: DiffChange["type"]) {
  switch (type) {
    case "added":
      return FilePlus;
    case "removed":
      return FileX;
    case "modified":
      return FileEdit;
  }
}

/**
 * Returns the language ID for Monaco based on file extension.
 */
function getLanguageFromPath(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "tsx":
    case "ts":
      return "typescript";
    case "jsx":
    case "js":
      return "javascript";
    case "css":
      return "css";
    case "html":
      return "html";
    case "json":
      return "json";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

/**
 * VersionDiff renders a Monaco DiffEditor to compare file changes
 * between two versions. Includes a file selector for multi-file diffs.
 */
export function VersionDiff({ from, to, changes, onClose }: VersionDiffProps) {
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const selectedChange = changes[selectedFileIndex] || null;

  const language = useMemo(() => {
    if (!selectedChange) return "plaintext";
    return getLanguageFromPath(selectedChange.path);
  }, [selectedChange]);

  if (changes.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <DiffHeader from={from} to={to} onClose={onClose} />
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No differences found between v{from} and v{to}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with version info and close button */}
      <DiffHeader from={from} to={to} onClose={onClose} />

      {/* File selector */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">Files changed:</span>
        <div className="flex flex-wrap gap-1.5">
          {changes.map((change, index) => {
            const ChangeIcon = getChangeIcon(change.type);
            const isSelected = index === selectedFileIndex;

            return (
              <button
                key={change.path}
                onClick={() => setSelectedFileIndex(index)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-all duration-150",
                  isSelected
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <ChangeIcon className={cn(
                  "size-3",
                  change.type === "added" && "text-green-500",
                  change.type === "removed" && "text-red-500",
                  change.type === "modified" && "text-yellow-500"
                )} />
                {change.path.split("/").pop()}
                <Badge
                  variant="outline"
                  className={cn(
                    "h-4 px-1 text-[9px]",
                    change.type === "added" && "border-green-500/30 text-green-500",
                    change.type === "removed" && "border-red-500/30 text-red-500",
                    change.type === "modified" && "border-yellow-500/30 text-yellow-500"
                  )}
                >
                  {change.type}
                </Badge>
              </button>
            );
          })}
        </div>
      </div>

      {/* Monaco DiffEditor */}
      <div className="flex-1">
        {selectedChange && (
          <DiffEditor
            original={selectedChange.oldContent || ""}
            modified={selectedChange.newContent || ""}
            language={language}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 13,
              lineNumbers: "on",
              folding: true,
              wordWrap: "on",
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Header bar for the diff viewer showing version comparison info.
 */
function DiffHeader({
  from,
  to,
  onClose,
}: {
  from: number;
  to: number;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          Comparing
        </span>
        <Badge variant="outline" className="text-xs">
          v{from}
        </Badge>
        <span className="text-xs text-muted-foreground">→</span>
        <Badge variant="outline" className="text-xs">
          v{to}
        </Badge>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0"
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
