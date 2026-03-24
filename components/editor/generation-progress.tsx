/**
 * components/editor/generation-progress.tsx
 *
 * Renders real-time progress during AI code generation.
 * Instead of showing raw <file> code blocks while streaming,
 * this component displays a clean progress card showing:
 *
 * Phase 1 — "Thinking...": Spinner before any <file> tag appears
 * Phase 2 — "Generating files...": File list with completion status
 * Phase 3 — Done: Summary card showing all files changed
 *
 * File detection works by parsing the streaming content in real-time:
 * - Opening <file path="..."> tags indicate a file has started
 * - Closing </file> tags indicate a file is complete
 * - The last opened file without a closing tag is "in progress"
 *
 * Used by: components/editor/message-bubble.tsx
 */

"use client";

import { useMemo } from "react";
import { Loader2, FileCode, Check, Sparkles, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for the GenerationProgress component.
 *
 * @property content - The raw streaming AI response content
 * @property isStreaming - Whether the response is still being streamed
 * @property changedFiles - Persisted file paths from a completed generation (used on refresh)
 */
export interface GenerationProgressProps {
  content: string;
  isStreaming: boolean;
  changedFiles?: string[];
}

/**
 * Tracks the status of a single file being generated.
 *
 * @property path - File path (e.g., "src/App.tsx")
 * @property status - "writing" while content streams, "done" when </file> seen
 */
interface FileProgress {
  path: string;
  status: "writing" | "done";
}

/**
 * Regex to match opening <file path="..."> tags.
 * Used to detect when the AI starts writing a new file.
 */
const FILE_OPEN_REGEX = /<file\s+path="([^"]+)">/g;

/**
 * Regex to match complete <file path="...">...</file> blocks.
 * Used to detect when a file's content is fully written.
 */
const FILE_COMPLETE_REGEX = /<file\s+path="([^"]+)">[\s\S]*?<\/file>/g;

/**
 * Parses the streaming content to extract file progress information.
 * Compares opened file tags vs completed file tags to determine
 * which files are done and which are still being written.
 *
 * @param content - Raw streaming AI response
 * @returns Array of FileProgress objects with path and status
 */
function parseFileProgress(content: string): FileProgress[] {
  // Find all opened files
  const openedFiles: string[] = [];
  FILE_OPEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FILE_OPEN_REGEX.exec(content)) !== null) {
    openedFiles.push(match[1].trim());
  }

  // Find all completed files
  const completedFiles = new Set<string>();
  FILE_COMPLETE_REGEX.lastIndex = 0;
  while ((match = FILE_COMPLETE_REGEX.exec(content)) !== null) {
    completedFiles.add(match[1].trim());
  }

  // Build progress array — mark each file as done or writing
  return openedFiles.map((path) => ({
    path,
    status: completedFiles.has(path) ? "done" as const : "writing" as const,
  }));
}

/**
 * Extracts the file name from a full path for compact display.
 * e.g., "src/components/NavBar.tsx" → "NavBar.tsx"
 *
 * @param path - Full file path
 * @returns Just the file name portion
 */
function getFileName(path: string): string {
  return path.split("/").pop() || path;
}

/**
 * GenerationProgress shows the real-time progress of AI code generation.
 * Displays a thinking spinner, then a file list as files are detected,
 * then a completion summary when streaming finishes.
 */
export function GenerationProgress({
  content,
  isStreaming,
  changedFiles,
}: GenerationProgressProps) {
  /**
   * Parse file progress from the current streaming content.
   * Falls back to the persisted changedFiles array when the content
   * no longer contains <file> tags (e.g., after page refresh).
   */
  const files = useMemo(() => {
    const parsed = parseFileProgress(content);
    if (parsed.length === 0 && changedFiles && changedFiles.length > 0) {
      return changedFiles.map((path) => ({ path, status: "done" as const }));
    }
    return parsed;
  }, [content, changedFiles]);

  /** Check if the AI has started writing any files yet */
  const hasFiles = files.length > 0;

  /** Check if any file is currently being written */
  const hasActiveFile = files.some((f) => f.status === "writing");

  // --- Phase 1: Thinking (no files yet, still streaming) ---
  if (isStreaming && !hasFiles) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
        {/* Animated shimmer background */}
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-primary/5 to-transparent" />

        <div className="relative flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <BrainCircuit className="size-4 text-primary animate-pulse" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              Thinking
              <span className="inline-flex w-6">
                <span className="animate-[dotPulse_1.4s_infinite]">.</span>
                <span className="animate-[dotPulse_1.4s_0.2s_infinite]">.</span>
                <span className="animate-[dotPulse_1.4s_0.4s_infinite]">.</span>
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              Analyzing your request
            </span>
          </div>
        </div>
      </div>
    );
  }

  // --- Phase 2 & 3: File progress (streaming) or summary (done) ---
  if (!hasFiles) return null;

  const doneCount = files.filter((f) => f.status === "done").length;

  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border/30 px-3.5 py-2">
        {isStreaming ? (
          <>
            <Sparkles className="size-3.5 animate-pulse text-primary" />
            <span className="text-xs font-medium text-foreground">
              Generating {files.length} {files.length === 1 ? "file" : "files"}...
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {doneCount}/{files.length}
            </span>
          </>
        ) : (
          <>
            <FileCode className="size-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-foreground">
              {files.length} {files.length === 1 ? "file" : "files"} changed
            </span>
          </>
        )}
      </div>

      {/* File list */}
      <div className="divide-y divide-border/10">
        {files.map((file) => (
          <div
            key={file.path}
            className={cn(
              "flex items-center gap-2.5 px-3.5 py-1.5 transition-colors",
              file.status === "writing" && isStreaming && "bg-primary/5"
            )}
          >
            {/* Status indicator */}
            {file.status === "done" || !isStreaming ? (
              <div className="flex size-4 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="size-2.5 text-emerald-500" />
              </div>
            ) : (
              <Loader2 className="size-4 animate-spin text-primary" />
            )}

            {/* File path */}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-xs font-mono",
                file.status === "writing" && isStreaming
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
              title={file.path}
            >
              {file.path}
            </span>

            {/* Writing indicator */}
            {file.status === "writing" && isStreaming && (
              <span className="shrink-0 text-[10px] font-medium text-primary">
                writing
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar during streaming */}
      {isStreaming && hasFiles && (
        <div className="h-[3px] bg-secondary/50">
          <div
            className="h-full rounded-r-full bg-primary transition-all duration-500 ease-out"
            style={{
              width: `${files.length > 0 ? (doneCount / files.length) * 100 : 0}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}
