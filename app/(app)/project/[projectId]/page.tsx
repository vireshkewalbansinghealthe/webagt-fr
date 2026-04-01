/**
 * app/(app)/project/[projectId]/page.tsx
 *
 * The main editor page for a project. This is where users interact
 * with AI to generate code and see live previews of their app.
 *
 * State managed here:
 * - files: Record<string, string> — current project files
 * - activeFile: string — selected file in Monaco editor
 * - messages: ChatMessage[] — chat history
 * - isStreaming: boolean — whether AI is generating
 * - versions: VersionMeta[] — version history for the timeline
 * - viewingVersion: number | null — old version being viewed (null = current)
 *
 * On mount, fetches the project metadata, current version files,
 * chat history, and version list from the Worker API.
 *
 * Chat messages are sent to the streaming SSE endpoint at
 * POST /api/chat/:projectId. The AI response streams in real-time
 * as chunk events, and parsed files arrive as a files event at the end.
 *
 * Used by: Next.js router for /project/[projectId] routes
 */

"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import type { ChatMessage, ImageAttachment } from "@/types/chat";
import type { Project, ProjectFile, VersionMeta } from "@/types/project";
import { createApiClient, WORKER_URL, CHAT_URL } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EditorLayout,
  EditorLayoutSkeleton,
} from "@/components/editor/editor-layout";
import { PreviewSkeleton } from "@/components/editor/preview-skeleton";
import { EditorSkeleton } from "@/components/editor/editor-skeleton";
import { VersionTimeline } from "@/components/editor/version-timeline";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { useRateLimit } from "@/components/rate-limit-provider";
import dynamic from "next/dynamic";

/**
 * Lazy-load the Sandpack preview panel.
 * Sandpack requires browser APIs (iframes, web workers) so it
 * cannot be rendered on the server — ssr: false is required.
 */
const PreviewPanel = dynamic(
  () =>
    import("@/components/editor/preview-panel").then(
      (mod) => mod.PreviewPanel
    ),
  { ssr: false, loading: () => <PreviewSkeleton /> }
);

/**
 * Lazy-load the Monaco code editor panel.
 * Monaco requires window and document — ssr: false is required.
 */
const CodeEditorPanel = dynamic(
  () =>
    import("@/components/editor/code-editor-panel").then(
      (mod) => mod.CodeEditorPanel
    ),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

/**
 * Lazy-load the Monaco diff viewer.
 * Monaco DiffEditor requires window — ssr: false is required.
 */
const VersionDiff = dynamic(
  () =>
    import("@/components/editor/version-diff").then(
      (mod) => mod.VersionDiff
    ),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

/**
 * Lazy-load the Shop Manager panel.
 */
const ShopManagerPanel = dynamic(
  () =>
    import("@/components/editor/shop-manager-panel").then(
      (mod) => mod.ShopManagerPanel
    ),
  { ssr: false, loading: () => <EditorSkeleton /> }
);

/**
 * Strips markdown code fences from file content.
 * Removes the opening ```lang line (if first line) and closing ``` line (if last line).
 * Uses a line-based approach for robustness.
 *
 * @param content - Raw file content that may have markdown fences
 * @returns Clean code without markdown fences
 */
function stripMarkdownFences(content: string): string {
  const lines = content.split("\n");

  // Strip opening fence if first line matches ```lang or ```
  if (lines.length > 0 && /^\s*```[a-zA-Z]*\s*$/.test(lines[0])) {
    lines.shift();
  }

  // Strip trailing empty lines, then closing fence
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  if (lines.length > 0 && /^\s*```\s*$/.test(lines[lines.length - 1])) {
    lines.pop();
  }

  return lines.join("\n");
}

/**
 * Converts a ProjectFile[] array to a Record<string, string>.
 * This is the format expected by Sandpack and Monaco.
 * Also strips any markdown code fences from file content.
 *
 * @param files - Array of ProjectFile objects from the API
 * @returns Object mapping file paths to their content
 */
function filesToRecord(files: ProjectFile[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const file of files) {
    const cleaned = stripMarkdownFences(file.content);
    if (cleaned !== file.content) {
      console.log(`[filesToRecord] Stripped markdown fences from ${file.path}`);
    }
    record[file.path] = cleaned;
  }
  return record;
}

/**
 * Converts a Record<string, string> back to a ProjectFile[] array.
 * Used when sending files to the API.
 *
 * @param record - Object mapping file paths to content
 * @returns Array of ProjectFile objects
 */
function recordToFiles(record: Record<string, string>): ProjectFile[] {
  return Object.entries(record).map(([path, content]) => ({ path, content }));
}

/**
 * EditorPage is the main page component for the project editor.
 * Fetches project data on mount, manages all editor state,
 * and renders the EditorLayout with panels.
 */
export default function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { getToken } = useAuth();
  const router = useRouter();
  const { setRateLimitedUntil } = useRateLimit();

  // --- Auto-heal refs ---
  /** Tracks how many auto-heal attempts have been made for the current error */
  const autoHealAttemptRef = useRef(0);
  /** Whether the last generation was AI-initiated (not manual edit) */
  const justGeneratedRef = useRef(false);
  /** Mirror of isStreaming as a ref — avoids stale closures in callbacks */
  const isStreamingRef = useRef(false);
  /** Maximum number of auto-heal retry attempts before giving up */
  const MAX_AUTO_HEAL_ATTEMPTS = 3;

  /** AbortController for stopping AI generation */
  const abortControllerRef = useRef<AbortController | null>(null);

  /** Interval handle for polling generation status after a page refresh */
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Fire-and-forget project log writer */
  const logQueue = useRef<Array<{ level: string; source: string; message: string; detail?: string }>>([]);
  const logFlushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plog = useCallback((level: string, source: string, message: string, detail?: string) => {
    logQueue.current.push({ level, source, message, detail });
    if (logFlushTimer.current) return;
    logFlushTimer.current = setTimeout(async () => {
      logFlushTimer.current = null;
      const entries = logQueue.current.splice(0);
      if (entries.length === 0) return;
      try {
        const client = createApiClient(getToken);
        await client.projects.writeLogs(projectId, entries);
      } catch { /* best effort */ }
    }, 2000);
  }, [getToken, projectId]);

  /**
   * Stores a pending prompt from sessionStorage (set during project creation).
   * Consumed once after the editor finishes loading to auto-send the first message.
   */
  const pendingPromptRef = useRef<string | null>(null);

  /**
   * Ref that always holds the latest handleSendMessage callback.
   * Used by the auto-send effect to avoid stale closure issues
   * without needing handleSendMessage in the effect's deps.
   */
  const handleSendMessageRef = useRef<(content: string, images?: ImageAttachment[], isAutoHeal?: boolean) => void>(() => {});

  /** Project metadata from the API */
  const [project, setProject] = useState<Project | null>(null);

  /** File contents — Record<filePath, content> */
  const [files, setFiles] = useState<Record<string, string>>({});

  /** Currently selected file in Monaco editor */
  const [activeFile, setActiveFile] = useState<string>("src/App.tsx");

  /** Chat message history */
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  /** Whether AI is currently generating a response */
  const [isStreaming, setIsStreaming] = useState(false);

  /** Loading state while fetching project data */
  const [isLoading, setIsLoading] = useState(true);

  /** Version history metadata for the timeline */
  const [versions, setVersions] = useState<VersionMeta[]>([]);

  /** Whether versions are still loading */
  const [isLoadingVersions, setIsLoadingVersions] = useState(true);

  /** User's remaining credits (-1 = unlimited, undefined = loading) */
  const [creditsRemaining, setCreditsRemaining] = useState<number | undefined>(
    undefined
  );

  /** Total credits for the billing period (e.g. 50 for free) */
  const [creditsTotal, setCreditsTotal] = useState<number>(50);

  /** User's current plan — determines model access */
  const [userPlan, setUserPlan] = useState<"free" | "pro">("free");

  /** Currently selected AI model ID */
  const [selectedModelId, setSelectedModelId] = useState<string>(DEFAULT_MODEL_ID);

  /** Whether the user has exhausted their free credits */
  const isCreditsExhausted =
    creditsRemaining !== undefined &&
    creditsRemaining !== -1 &&
    creditsRemaining <= 0;

  /**
   * Which old version the user is currently viewing (null = current).
   * When viewing an old version, the editor shows those files read-only.
   */
  const [viewingVersion, setViewingVersion] = useState<number | null>(null);

  /**
   * Saved files for the current version — used to restore when
   * the user clicks "Back to current" after viewing an old version.
   */
  const currentFilesRef = useRef<Record<string, string>>({});

  /**
   * Diff state — when set, the history panel shows the diff viewer
   * instead of the timeline.
   */
  const [diffState, setDiffState] = useState<{
    from: number;
    to: number;
    changes: Array<{
      path: string;
      type: "added" | "removed" | "modified";
      oldContent: string | null;
      newContent: string | null;
    }>;
  } | null>(null);

  /**
   * Polls the Fly.io status endpoint every 4 seconds while a background
   * generation is running (e.g. after the user refreshed the page).
   * When the generation finishes, reloads files, messages, and versions
   * automatically and clears the streaming indicator.
   */
  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // already polling

    pollingRef.current = setInterval(async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const res = await fetch(`${CHAT_URL}/api/chat/status/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;

        const state = await res.json() as { status: string; versionId?: string };

        if (state.status === "completed" || state.status === "failed") {
          // Stop polling
          clearInterval(pollingRef.current!);
          pollingRef.current = null;

          // Reload everything from the backend
          const client = createApiClient(getToken);
          const [filesResponse, chatResponse, versionsResponse] = await Promise.all([
            client.projects.getFiles(projectId),
            client.chat.getHistory(projectId),
            client.versions.list(projectId),
          ]);

          const newFiles = filesToRecord(filesResponse.files);
          setFiles(newFiles);
          currentFilesRef.current = newFiles;
          lastSavedFilesRef.current = newFiles;

          setMessages(chatResponse.messages);
          setVersions(versionsResponse.versions);

          if (state.status === "completed") {
            setProject((prev) =>
              prev ? { ...prev, currentVersion: prev.currentVersion + 1, updatedAt: new Date().toISOString() } : prev
            );
          }

          setIsStreaming(false);
          isStreamingRef.current = false;
        }
      } catch {
        // Polling failed silently — will retry next interval
      }
    }, 4000);
  }, [getToken, projectId]);

  /**
   * Fetch project metadata, current version files, chat history,
   * and version list on mount.
   */
  useEffect(() => {
    async function loadProject() {
      try {
        const client = createApiClient(getToken);
        const token = await getToken();

        // Fetch project metadata, files, chat history, versions, credits, and
        // generation status all in parallel.
        const [projectResponse, filesResponse, chatResponse, versionsResponse, creditsResponse, statusRes] =
          await Promise.all([
            client.projects.get(projectId),
            client.projects.getFiles(projectId),
            client.chat.getHistory(projectId),
            client.versions.list(projectId),
            client.credits.get(),
            token
              ? fetch(`${CHAT_URL}/api/chat/status/${projectId}`, {
                  headers: { Authorization: `Bearer ${token}` },
                }).then((r) => r.json()).catch(() => ({ status: "idle" }))
              : Promise.resolve({ status: "idle" }),
          ]);

        setProject(projectResponse.project);
        setSelectedModelId(
          projectResponse.project.model || DEFAULT_MODEL_ID
        );
        setCreditsRemaining(
          creditsResponse.isUnlimited ? -1 : creditsResponse.remaining
        );
        setCreditsTotal(creditsResponse.total);
        setUserPlan(creditsResponse.plan);

        const fileRecord = filesToRecord(filesResponse.files);
        setFiles(fileRecord);
        currentFilesRef.current = fileRecord;

        setMessages(chatResponse.messages);
        setVersions(versionsResponse.versions);

        // Set the initial active file to App.tsx (or first file)
        const filePaths = filesResponse.files.map((f) => f.path);
        if (filePaths.includes("src/App.tsx")) {
          setActiveFile("src/App.tsx");
        } else if (filePaths.length > 0) {
          setActiveFile(filePaths[0]);
        }

        // If the server is still generating (background), show the spinner
        // and poll until it finishes — no user-visible reconnect message.
        const genState = statusRes as { status: string };
        if (genState.status === "running") {
          setIsStreaming(true);
          isStreamingRef.current = true;
          startPolling();
        }

        // Check sessionStorage for a pending prompt (set during project creation).
        // Consume and delete the key so refreshes won't re-send.
        try {
          const storageKey = `pendingPrompt:${projectId}`;
          const pending = sessionStorage.getItem(storageKey);
          if (pending) {
            sessionStorage.removeItem(storageKey);
            pendingPromptRef.current = pending;
          }
        } catch {
          // sessionStorage unavailable — skip auto-send
        }
      } catch {
        // If project not found or access denied, redirect to dashboard
        router.push("/dashboard");
      } finally {
        setIsLoading(false);
        setIsLoadingVersions(false);
      }
    }

    loadProject();

    // Clean up polling on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [projectId, getToken, router, startPolling]);

  /**
   * Refreshes the version list from the API.
   * Called after AI generations, restores, and manual saves.
   */
  const refreshVersions = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const response = await client.versions.list(projectId);
      setVersions(response.versions);
    } catch {
      // Silently fail — timeline will show stale data
      console.error("Failed to refresh versions");
    }
  }, [getToken, projectId]);

  /**
   * Handles viewing a specific version's files in the editor.
   * Fetches the version files and shows them in read-only mode.
   * If the user clicks the current version, return to normal mode.
   */
  const handleViewVersion = useCallback(
    async (versionNumber: number) => {
      // If clicking the current version, go back to current
      if (versionNumber === project?.currentVersion) {
        setViewingVersion(null);
        setFiles(currentFilesRef.current);
        setDiffState(null);
        return;
      }

      try {
        const client = createApiClient(getToken);
        const response = await client.versions.get(projectId, versionNumber);
        setFiles(filesToRecord(response.files));
        setViewingVersion(versionNumber);
        setDiffState(null);
      } catch {
        console.error("Failed to load version files");
        toast.error("Failed to load version files.");
      }
    },
    [getToken, projectId, project?.currentVersion]
  );

  /**
   * Restores a previous version, creating a new version with its files.
   * After restore, refreshes the version list and updates editor state.
   */
  const handleRestoreVersion = useCallback(
    async (versionNumber: number) => {
      try {
        const client = createApiClient(getToken);
        const response = await client.versions.restore(projectId, versionNumber);

        // Update files to the restored version
        const restoredFiles = filesToRecord(response.files);
        setFiles(restoredFiles);
        currentFilesRef.current = restoredFiles;
        lastSavedFilesRef.current = restoredFiles;

        // Update project metadata
        setProject((prev) =>
          prev
            ? {
                ...prev,
                currentVersion: response.version.versionNumber,
                updatedAt: new Date().toISOString(),
              }
            : prev
        );

        // Exit version viewing mode
        setViewingVersion(null);
        setDiffState(null);

        // Add a system message to the chat so the user sees the restore event
        const systemMessage: ChatMessage = {
          id: `msg-${Date.now()}-system`,
          role: "system",
          content: `Restored to version ${versionNumber}`,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, systemMessage]);

        // Refresh version timeline
        await refreshVersions();

        toast.success(`Restored to v${versionNumber}`);
      } catch {
        console.error("Failed to restore version");
        toast.error("Failed to restore version. Try again.");
      }
    },
    [getToken, projectId, refreshVersions]
  );

  /**
   * Compares two versions by fetching the diff from the API
   * and showing the diff viewer in the history panel.
   */
  const handleCompareVersions = useCallback(
    async (from: number, to: number) => {
      try {
        const client = createApiClient(getToken);
        const response = await client.versions.diff(projectId, from, to);
        setDiffState(response);
      } catch {
        console.error("Failed to compute diff");
        toast.error("Failed to compare versions.");
      }
    },
    [getToken, projectId]
  );

  /** Display name for the project — used in the header and menu */
  const projectName = project?.name ?? "Untitled Project";

  /**
   * Handles renaming the project.
   * Updates local state immediately and persists to KV via PATCH.
   *
   * @param newName - The new project name
   */
  const handleRename = useCallback(
    async (newName: string) => {
      // Capture old name for revert
      const oldName = project?.name ?? "Untitled Project";

      // Optimistic update
      setProject((prev) => (prev ? { ...prev, name: newName } : prev));

      try {
        const client = createApiClient(getToken);
        await client.projects.update(projectId, { name: newName });
        toast.success("Project renamed");
      } catch {
        // Revert on failure
        setProject((prev) => (prev ? { ...prev, name: oldName } : prev));
        toast.error("Failed to rename project");
      }
    },
    [getToken, projectId, project?.name]
  );

  /**
   * Handles deleting the project.
   * Calls the API and redirects to the dashboard.
   */
  const handleDelete = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      await client.projects.delete(projectId);
      toast.success("Project deleted");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete project");
    }
  }, [getToken, projectId, router]);

  /**
   * Handles switching the AI model for this project.
   * Updates local state immediately and persists to KV via PATCH.
   *
   * @param modelId - The new model ID to use
   */
  const handleModelChange = useCallback(
    async (modelId: string) => {
      setSelectedModelId(modelId);

      // Update project metadata locally
      setProject((prev) =>
        prev ? { ...prev, model: modelId } : prev
      );

      // Persist to the backend
      try {
        const client = createApiClient(getToken);
        await client.projects.update(projectId, { model: modelId });
      } catch {
        console.error("Failed to save model preference");
      }
    },
    [getToken, projectId]
  );

  /**
   * Returns to the current version after viewing an old version.
   */
  const handleBackToCurrent = useCallback(() => {
    setViewingVersion(null);
    setFiles(currentFilesRef.current);
    setDiffState(null);
  }, []);

  const handleStopGeneration = useCallback(async () => {
    // Stop polling if running (background reconnect scenario)
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Abort the active SSE connection if there is one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Notify the server to stop the background generation
    try {
      const token = await getToken();
      if (token) {
        await fetch(`${CHAT_URL}/api/chat/stop/${projectId}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.error("Failed to notify server to stop generation:", err);
    }

    setIsStreaming(false);
    isStreamingRef.current = false;
    toast.info("Generation stopped");
  }, [getToken, projectId]);

  /**
   * Handles sending a new chat message via SSE streaming.
   * Connects to POST /api/chat/:projectId, streams the AI response
   * character-by-character, and updates files when generation completes.
   *
   * SSE events handled:
   * - chunk: append text to the AI message (real-time streaming)
   * - files: update project files (Sandpack + Monaco)
   * - done: mark generation complete, update project version
   * - error: display error message to user
   *
   * @param content - The user's message text
   */
  const handleSendMessage = useCallback(
    async (content: string, images?: ImageAttachment[], isAutoHeal?: boolean) => {
      // Reset auto-heal counter on normal user messages
      if (!isAutoHeal) {
        autoHealAttemptRef.current = 0;
      }

      // If viewing an old version, go back to current first
      if (viewingVersion !== null) {
        handleBackToCurrent();
      }

      // Mark that we're starting a new generation (not yet complete)
      justGeneratedRef.current = false;

      // Create the user message and add to chat
      const userMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content,
        timestamp: new Date().toISOString(),
        images: images && images.length > 0 ? images : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      isStreamingRef.current = true;

      // Initialize AbortController for this request
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // Create an empty AI message that will be filled by streaming chunks
      const aiMessageId = `msg-${Date.now()}-assistant`;
      const aiMessage: ChatMessage = {
        id: aiMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        model: selectedModelId,
      };
      setMessages((prev) => [...prev, aiMessage]);

      try {
        // Get the Clerk auth token for the API request
        const token = await getToken();
        if (!token) {
          throw new Error("Not authenticated");
        }

        // Make the streaming request to the chat endpoint
        const response = await fetch(
          `${CHAT_URL}/api/chat/${projectId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              message: content,
              model: selectedModelId,
              images: images && images.length > 0 ? images : undefined,
            }),
            signal,
          }
        );

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({
            error: "Request failed",
          }));
          const typed = errorBody as { error?: string; code?: string; retryAfter?: number };

          // Trigger the global rate limit banner on 429 responses
          if (response.status === 429) {
            const retryAfter = typed.retryAfter ?? 60;
            setRateLimitedUntil(Date.now() + retryAfter * 1000);
            window.dispatchEvent(
              new CustomEvent("rate-limited", { detail: { retryAfter } })
            );
          }

          throw new Error(typed.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        // Read the SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            // Parse SSE event type lines
            if (line.startsWith("event: ")) {
              continue;
            }

            // Parse SSE data lines
            if (!line.startsWith("data: ")) {
              continue;
            }

            const data = line.slice(6);
            if (!data) continue;

            try {
              const event = JSON.parse(data);

              // Handle chunk events — append text to AI message
              if (event.text !== undefined) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, content: msg.content + event.text }
                      : msg
                  )
                );
              }

              // Handle files event — update Sandpack + Monaco
              if (event.files) {
                const newFiles = filesToRecord(event.files);
                plog("info", "sse", `Received 'files' event — ${Object.keys(newFiles).length} files`);
                setFiles(newFiles);
                currentFilesRef.current = newFiles;
                lastSavedFilesRef.current = newFiles;
                // Mark that AI generation produced files — enables auto-heal
                // Set here (not on "done") because Sandpack evaluates files
                // immediately and may error before the done event arrives.
                justGeneratedRef.current = true;
              }

              // Handle done event — update project version info and credits
              if (event.creditsRemaining !== undefined) {
                setCreditsRemaining(event.creditsRemaining);
              }

              if (event.versionId) {
                setProject((prev) =>
                  prev
                    ? {
                        ...prev,
                        currentVersion: prev.currentVersion + 1,
                        updatedAt: new Date().toISOString(),
                      }
                    : prev
                );

                // Update the AI message with version number
                const versionNumber = parseInt(
                  event.versionId.replace("v", ""),
                  10
                );
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? { ...msg, versionNumber }
                      : msg
                  )
                );

                // Refresh the version timeline
                refreshVersions();
              }

              // Auto-continue if the AI chunked its response
              if (event.continue) {
                setTimeout(() => {
                  handleSendMessageRef.current?.(
                    "Please continue generating the remaining files.",
                    undefined,
                    true // Use isAutoHeal flag so it doesn't reset counters, though it's technically a continuation
                  );
                }, 1000);
              }

              // Handle error events from the stream
              if (event.code && event.message) {
                plog("error", "sse", `SSE error: ${event.code} — ${event.message}`);
                // Trigger global rate limit banner for SSE rate limit errors (fallback 60s)
                if (event.code === "RATE_LIMITED") {
                  setRateLimitedUntil(Date.now() + 60000);
                  window.dispatchEvent(
                    new CustomEvent("rate-limited", { detail: { retryAfter: 60 } })
                  );
                }

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === aiMessageId
                      ? {
                          ...msg,
                          content: `Error: ${event.message}`,
                        }
                      : msg
                  )
                );
                toast.error(event.message as string);
              }
            } catch {
              // Skip unparseable lines
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          // User intentionally stopped generation
          return;
        }

        const errorMessage =
          error instanceof Error ? error.message : "Something went wrong";

        plog("error", "sse-connection", `SSE connection error: ${errorMessage}`, error instanceof Error ? error.stack : undefined);

        const lowerError = errorMessage.toLowerCase();
        if (
          lowerError.includes("too many requests") ||
          lowerError.includes("rate limit")
        ) {
          setRateLimitedUntil(Date.now() + 60000);
          window.dispatchEvent(
            new CustomEvent("rate-limited", { detail: { retryAfter: 60 } })
          );
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === aiMessageId
              ? { ...msg, content: `Error: ${errorMessage}` }
              : msg
          )
        );

        toast.error(errorMessage);
      } finally {
        setIsStreaming(false);
        isStreamingRef.current = false;
        abortControllerRef.current = null;
      }
    },
    [project, selectedModelId, getToken, projectId, viewingVersion, handleBackToCurrent, refreshVersions]
  );

  // Keep the ref in sync so the auto-send effect always calls the latest version
  handleSendMessageRef.current = handleSendMessage;

  /**
   * Handles Sandpack build/runtime errors after AI generation.
   * Automatically sends a "fix this error" request to the AI, up to
   * MAX_AUTO_HEAL_ATTEMPTS retries. Only triggers after AI generation
   * (not after manual edits in Monaco). Each retry deducts credits normally.
   */
  const handleSandpackError = useCallback(
    (error: { message: string }) => {
      plog("error", "sandpack", `Sandpack error: ${error.message.slice(0, 300)}`, error.message);

      if (!justGeneratedRef.current) return;
      if (isStreamingRef.current) return;

      if (autoHealAttemptRef.current >= MAX_AUTO_HEAL_ATTEMPTS) {
        justGeneratedRef.current = false;
        plog("warn", "sandpack", `Auto-heal gave up after ${MAX_AUTO_HEAL_ATTEMPTS} attempts`);
        toast.error("Auto-fix failed after 3 attempts. Please fix the error manually.");
        return;
      }

      autoHealAttemptRef.current += 1;
      const attempt = autoHealAttemptRef.current;
      plog("info", "sandpack", `Auto-heal attempt ${attempt}/${MAX_AUTO_HEAL_ATTEMPTS}`, error.message.slice(0, 500));

      const healPrompt = `The app has a build/runtime error that needs to be fixed (attempt ${attempt}/${MAX_AUTO_HEAL_ATTEMPTS}):\n\n${error.message}\n\nPlease fix this error. Only modify the files necessary to resolve the issue.`;

      handleSendMessage(healPrompt, undefined, true);
    },
    [handleSendMessage, plog]
  );

  /**
   * Handles file changes from the Monaco editor.
   * Updates a single file in the files state, triggering
   * a Sandpack re-render with the new code.
   *
   * @param updatedFiles - New files record (full replacement)
   */
  const handleFilesChange = useCallback(
    (updatedFiles: Record<string, string>) => {
      // Manual edits in Monaco should not trigger auto-heal
      justGeneratedRef.current = false;
      setFiles(updatedFiles);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Auto-save: debounced manual edits → new version
  // ---------------------------------------------------------------------------

  /** Ref tracking the debounce timer for auto-save */
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ref tracking the max-wait timer (force save after 30s of continuous typing) */
  const maxWaitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Ref to the last saved files snapshot (for change detection) */
  const lastSavedFilesRef = useRef<Record<string, string>>({});

  /** Whether this is a user-initiated edit (not an AI update) */
  const isManualEditRef = useRef(false);

  /**
   * Compares two file records to detect if anything changed.
   * Returns true if file paths or contents differ.
   */
  const hasChanges = useCallback(
    (current: Record<string, string>, saved: Record<string, string>): boolean => {
      const currentKeys = Object.keys(current).sort();
      const savedKeys = Object.keys(saved).sort();

      if (currentKeys.length !== savedKeys.length) return true;
      if (currentKeys.some((key, i) => key !== savedKeys[i])) return true;
      return currentKeys.some((key) => current[key] !== saved[key]);
    },
    []
  );

  /**
   * Performs the actual auto-save: sends current files to the API
   * and updates the version timeline if changes were detected.
   */
  const performAutoSave = useCallback(async () => {
    // Don't save if streaming, viewing old version, or no project
    if (isStreaming || viewingVersion !== null || !project) return;

    // Get the current files from the ref (state may be stale in closure)
    const currentFiles = { ...files };

    // Skip if no changes from last saved snapshot
    if (!hasChanges(currentFiles, lastSavedFilesRef.current)) return;

    try {
      const client = createApiClient(getToken);
      const response = await client.versions.saveManual(
        projectId,
        recordToFiles(currentFiles)
      );

      if (response.version) {
        // Update the saved snapshot
        lastSavedFilesRef.current = currentFiles;
        currentFilesRef.current = currentFiles;

        // Update project metadata
        setProject((prev) =>
          prev
            ? {
                ...prev,
                currentVersion: response.version!.versionNumber,
                updatedAt: new Date().toISOString(),
              }
            : prev
        );

        // Refresh version timeline
        refreshVersions();
      }
    } catch {
      console.error("Auto-save failed");
    }
  }, [files, isStreaming, viewingVersion, project, getToken, projectId, hasChanges, refreshVersions]);

  /**
   * Effect: Initialize lastSavedFilesRef when files are first loaded.
   * This prevents auto-save from triggering on the initial load.
   */
  useEffect(() => {
    if (!isLoading && Object.keys(lastSavedFilesRef.current).length === 0) {
      lastSavedFilesRef.current = { ...files };
    }
  }, [isLoading, files]);

  /**
   * Effect: Debounced auto-save trigger on file changes.
   * Resets the 2-second timer on each change. Sets a 30-second
   * max-wait timer the first time a change is detected.
   */
  useEffect(() => {
    // Only auto-save user edits, not AI-generated file updates
    if (isStreaming || viewingVersion !== null || isLoading) return;

    // Skip if files haven't changed from last save
    if (!hasChanges(files, lastSavedFilesRef.current)) return;

    // Clear existing debounce timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new debounce timer (2 seconds after last change)
    autoSaveTimerRef.current = setTimeout(() => {
      performAutoSave();

      // Clear max-wait timer since we saved
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
    }, 2000);

    // Set max-wait timer if not already running (30s force save)
    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        // Clear the debounce timer and force save
        if (autoSaveTimerRef.current) {
          clearTimeout(autoSaveTimerRef.current);
          autoSaveTimerRef.current = null;
        }
        performAutoSave();
        maxWaitTimerRef.current = null;
      }, 30000);
    }

    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [files, isStreaming, viewingVersion, isLoading, hasChanges, performAutoSave]);

  /**
   * Cleanup: clear all timers on component unmount.
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (maxWaitTimerRef.current) clearTimeout(maxWaitTimerRef.current);
    };
  }, []);

  /**
   * Effect: Auto-send the pending prompt after loading completes.
   * Fires once when isLoading transitions to false with a pending prompt.
   * The 400ms delay lets the UI render before the message appears.
   * Uses handleSendMessageRef to always call the latest callback.
   */
  useEffect(() => {
    if (isLoading || !pendingPromptRef.current) return;

    const prompt = pendingPromptRef.current;
    pendingPromptRef.current = null;

    const timer = setTimeout(() => handleSendMessageRef.current(prompt), 400);
    return () => clearTimeout(timer);
  }, [isLoading]);

  /**
   * Effect: Listen for prompts generated by the Visual Editor and thumbnails.
   */
  useEffect(() => {
    const handleVisualPrompt = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        handleSendMessageRef.current(customEvent.detail);
      }
    };
    
    const handleThumbnailSave = async (e: MessageEvent) => {
      if (e.data && e.data.type === 'SAVE_THUMBNAIL') {
        try {
          const client = createApiClient(getToken);
          await client.projects.saveThumbnail(projectId, e.data.dataUrl);
        } catch (err) {
          console.error("Failed to save thumbnail", err);
        }
      }
    };
    
    window.addEventListener('send-visual-prompt', handleVisualPrompt);
    window.addEventListener('message', handleThumbnailSave);
    
    return () => {
      window.removeEventListener('send-visual-prompt', handleVisualPrompt);
      window.removeEventListener('message', handleThumbnailSave);
    };
  }, [projectId, getToken]);

  // Show skeleton while loading
  if (isLoading) {
    return <EditorLayoutSkeleton />;
  }

  const userMessageCount = messages.filter(m => m.role === "user").length;
  const canStop = userMessageCount > 1;

  return (
    <EditorLayout
      projectId={projectId}
      projectName={projectName}
      files={files}
      messages={messages}
      isStreaming={isStreaming}
      onSendMessage={handleSendMessage}
      onFilesChange={handleFilesChange}
      activeFile={activeFile}
      onActiveFileChange={setActiveFile}
      creditsRemaining={creditsRemaining}
      creditsTotal={creditsTotal}
      isCreditsExhausted={isCreditsExhausted}
      selectedModelId={selectedModelId}
      onModelChange={handleModelChange}
      userPlan={userPlan}
      onRename={handleRename}
      onDelete={handleDelete}
      onStopGeneration={handleStopGeneration}
      canStop={canStop}
      viewingVersion={viewingVersion}
      onBackToCurrent={handleBackToCurrent}
      onRestoreViewing={
        viewingVersion !== null
          ? () => handleRestoreVersion(viewingVersion)
          : undefined
      }
      projectType={project?.type}
      databaseUrl={project?.databaseUrl}
      databaseToken={project?.databaseToken}
      shopManagerPanel={project && project.type === "webshop" ? <ShopManagerPanel project={project} /> : undefined}
      previewPanel={<PreviewPanel files={files} onError={handleSandpackError} isStreaming={isStreaming} onFilesChange={handleFilesChange} streamingContent={isStreaming ? (messages.findLast(m => m.role === "assistant")?.content ?? "") : ""} />}
      codeEditorPanel={
        <CodeEditorPanel
          files={files}
          activeFile={activeFile}
          onActiveFileChange={setActiveFile}
          onFileContentChange={(filePath, content) => {
            setFiles((prev) => ({ ...prev, [filePath]: content }));
          }}
        />
      }
      historyPanel={
        <div className="flex h-full bg-background">
          {/* Version Timeline — left side of history panel */}
          <div className={cn(
            "h-full border-r border-border",
            diffState ? "w-[280px] shrink-0" : "w-full"
          )}>
            <VersionTimeline
              versions={versions}
              currentVersion={project?.currentVersion ?? 0}
              viewingVersion={viewingVersion}
              onViewVersion={handleViewVersion}
              onRestoreVersion={handleRestoreVersion}
              onCompareVersions={handleCompareVersions}
              isLoading={isLoadingVersions}
            />
          </div>

          {/* Diff Viewer — right side when comparing */}
          {diffState && (
            <div className="flex-1">
              <VersionDiff
                from={diffState.from}
                to={diffState.to}
                changes={diffState.changes}
                onClose={() => setDiffState(null)}
              />
            </div>
          )}
        </div>
      }
    />
  );
}
