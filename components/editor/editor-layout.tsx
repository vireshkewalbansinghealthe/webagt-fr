/**
 * components/editor/editor-layout.tsx
 *
 * The main layout component for the project editor view.
 *
 * Desktop (md+): Full-width header + two resizable side-by-side panels.
 * Mobile (<md): Header + single full-width panel (chat or preview/code,
 * toggled via the header tabs). No resize handle on mobile.
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │  HEADER (h-12, full width)                                 │
 * │  [Logo] [ProjectName ▼]    │  [Preview][Code]  │ [Share][👤]│
 * ├───────────────────────┬────────────────────────────────────┤
 * │  CHAT PANEL           │  RIGHT PANEL (no tab bar)          │
 * │  ◄── resizable ──►    │  Preview / Code fills 100%         │
 * │  (default 30%)        │  (default 70%)                     │
 * └───────────────────────┴────────────────────────────────────┘
 *
 * The header contains the tab switcher (Preview/Code) in its center.
 * On mobile, an extra "Chat" tab appears to toggle the chat panel.
 *
 * Used by: app/(app)/project/[projectId]/page.tsx
 */

"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { ChatMessage, ImageAttachment } from "@/types/chat";
import type { ProjectFile } from "@/types/project";
import { ChatPanel } from "./chat-panel";
import { EditorHeader } from "./editor-header";
import { PanelErrorBoundary } from "./panel-error-boundary";
import { useEditorShortcuts } from "./use-editor-shortcuts";
import type { EditorTabValue } from "./editor-tabs";
import type { DeviceMode } from "./device-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Eye, RotateCcw, ArrowLeft } from "lucide-react";

/**
 * Props for the EditorLayout component.
 *
 * @property projectName - Name of the current project
 * @property files - Record of file paths to content strings
 * @property messages - Chat message history
 * @property isStreaming - Whether AI is currently generating
 * @property onSendMessage - Callback when user sends a chat message
 * @property onFilesChange - Callback when files are updated (e.g., from Monaco edits)
 * @property activeFile - Currently selected file path in the code editor
 * @property onActiveFileChange - Callback when user selects a different file
 * @property previewPanel - The Sandpack preview component (passed as prop to avoid re-mounting)
 * @property codeEditorPanel - The Monaco editor component (passed as prop to avoid re-mounting)
 * @property historyPanel - The version timeline / diff viewer component
 * @property viewingVersion - Old version being viewed (null = current)
 * @property onBackToCurrent - Callback to return to current version
 * @property onRestoreViewing - Callback to restore the version being viewed
 * @property creditsRemaining - Credits left (-1 = unlimited, undefined = loading)
 * @property isCreditsExhausted - Whether the user has 0 credits left
 * @property selectedModelId - Currently selected AI model ID
 * @property onModelChange - Callback when user switches model
 * @property userPlan - User's plan for model gating ("free" or "pro")
 * @property projectId - Project ID for export and other actions
 * @property creditsTotal - Total credits for the plan period
 * @property onRename - Callback when user renames the project
 * @property onDelete - Callback when user deletes the project
 */
export interface EditorLayoutProps {
  projectId: string;
  projectName: string;
  files: Record<string, string>;
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (message: string, images?: ImageAttachment[]) => void;
  onFilesChange: (files: Record<string, string>) => void;
  activeFile: string;
  onActiveFileChange: (filePath: string) => void;
  previewPanel: React.ReactNode;
  codeEditorPanel: React.ReactNode;
  historyPanel?: React.ReactNode;
  shopManagerPanel?: React.ReactNode;
  viewingVersion?: number | null;
  onBackToCurrent?: () => void;
  onRestoreViewing?: () => void;
  creditsRemaining?: number;
  creditsTotal?: number;
  isCreditsExhausted?: boolean;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  userPlan: "free" | "pro";
  onRename: (newName: string) => void;
  onDelete: () => void;
  projectType?: "website" | "webshop";
  /** Turso DB connection for webshop order badge polling */
  databaseUrl?: string;
  databaseToken?: string;
}

/** Minimum and maximum width for the chat panel in percentage */
const MIN_CHAT_PERCENT = 20;
const MAX_CHAT_PERCENT = 50;
const DEFAULT_CHAT_PERCENT = 30;

/** Absolute pixel minimum for the chat panel — prevents it from becoming unusable */
const MIN_CHAT_PX = 320;

/**
 * EditorLayout orchestrates the editor view with a full-width header
 * on top and two resizable panels below (chat on the left, preview/code
 * on the right). The tab switcher lives in the header, not the right panel.
 *
 * On mobile (<md), panels are shown one at a time — the header tabs
 * include a "Chat" option to switch between chat and preview/code.
 *
 * Preview and Code panels are passed as children to avoid
 * re-mounting Sandpack/Monaco on tab switches (they stay in DOM,
 * visibility is toggled via CSS).
 */
export function EditorLayout({
  projectId,
  projectName,
  files,
  messages,
  isStreaming,
  onSendMessage,
  previewPanel,
  codeEditorPanel,
  historyPanel,
  viewingVersion,
  onBackToCurrent,
  onRestoreViewing,
  creditsRemaining,
  creditsTotal,
  isCreditsExhausted,
  selectedModelId,
  onModelChange,
  userPlan,
  onRename,
  onDelete,
  projectType,
  shopManagerPanel,
  databaseUrl,
  databaseToken,
}: EditorLayoutProps) {
  const [activeTab, setActiveTab] = useState<EditorTabValue>("preview");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [chatWidthPercent, setChatWidthPercent] = useState(DEFAULT_CHAT_PERCENT);

  /** Register keyboard shortcuts (Cmd+P toggle, Cmd+B history) */
  useEditorShortcuts({ activeTab, onTabChange: setActiveTab });
  const [isDragging, setIsDragging] = useState(false);
  /**
   * Mobile-only panel toggle: "chat" shows chat, "content" shows preview/code.
   * On desktop both are always visible side by side.
   */
  const [mobilePanel, setMobilePanel] = useState<"chat" | "content">("chat");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setActiveTab("shop-manager");
    window.addEventListener("webagt:edit-product-image", handler);
    return () => window.removeEventListener("webagt:edit-product-image", handler);
  }, []);

  /**
   * Keep the chat panel width in sync when the browser window resizes.
   * If the current percentage would make the chat panel narrower than
   * MIN_CHAT_PX, bump the percentage up so it stays at least that wide.
   */
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        if (containerWidth <= 0) return;

        const minPercent = (MIN_CHAT_PX / containerWidth) * 100;
        setChatWidthPercent((prev) =>
          prev < minPercent ? Math.min(minPercent, MAX_CHAT_PERCENT) : prev
        );
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /**
   * Handle drag start on the resize handle.
   * Uses pointer capture so mouse events continue even over iframes.
   */
  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    },
    []
  );

  /**
   * Handle drag movement — compute new chat width as a percentage.
   * Enforces both percentage-based and pixel-based minimums so the
   * chat panel never gets too narrow regardless of window size.
   * Only runs while isDragging is true (pointer is captured).
   */
  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newPercent =
        ((event.clientX - containerRect.left) / containerRect.width) * 100;

      // Compute the pixel-based minimum as a percentage of the container
      const minPercentFromPx =
        (MIN_CHAT_PX / containerRect.width) * 100;

      // Clamp: respect both the percentage min and the pixel min
      const effectiveMin = Math.max(MIN_CHAT_PERCENT, minPercentFromPx);
      const clamped = Math.min(
        MAX_CHAT_PERCENT,
        Math.max(effectiveMin, newPercent)
      );
      setChatWidthPercent(clamped);
    },
    [isDragging]
  );

  /** Handle drag end — release pointer capture */
  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.currentTarget.releasePointerCapture(event.pointerId);
      setIsDragging(false);
    },
    []
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Full-width header bar */}
      <EditorHeader
        projectName={projectName}
        files={files}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        mobilePanel={mobilePanel}
        onMobilePanelChange={setMobilePanel}
        projectId={projectId}
        userPlan={userPlan}
        creditsRemaining={creditsRemaining}
        creditsTotal={creditsTotal}
        onRename={onRename}
        onDelete={onDelete}
        deviceMode={deviceMode}
        onDeviceModeChange={setDeviceMode}
        projectType={projectType}
        databaseUrl={databaseUrl}
        databaseToken={databaseToken}
      />

      {/* Version viewing banner — shown when browsing an old version */}
      {viewingVersion !== null && viewingVersion !== undefined && (
        <div className="flex items-center justify-between border-b border-blue-500/30 bg-blue-500/10 px-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Eye className="size-4 text-blue-500" />
            <span className="font-medium text-blue-500">
              Viewing v{viewingVersion}
            </span>
            <span className="text-muted-foreground">
              (read-only)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {onRestoreViewing && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 border-blue-500/30 text-xs hover:bg-blue-500/10"
                onClick={onRestoreViewing}
              >
                <RotateCcw className="size-3" />
                Restore this version
              </Button>
            )}
            {onBackToCurrent && (
              <Button
                variant="default"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={onBackToCurrent}
              >
                <ArrowLeft className="size-3" />
                Back to current
              </Button>
            )}
          </div>
        </div>
      )}

      {/* === Desktop layout: side-by-side resizable panels (md+) === */}
      <div
        ref={containerRef}
        className={cn(
          "hidden md:flex flex-1 overflow-hidden",
          isDragging && "select-none"
        )}
      >
        {/* Left panel — Chat (min-width prevents collapse on window resize) */}
        <div
          className="shrink-0 overflow-hidden"
          style={{ width: `${chatWidthPercent}%`, minWidth: MIN_CHAT_PX }}
        >
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={onSendMessage}
            creditsRemaining={creditsRemaining}
            isCreditsExhausted={isCreditsExhausted}
            selectedModelId={selectedModelId}
            onModelChange={onModelChange}
            userPlan={userPlan}

          />
        </div>

        {/* Drag handle */}
        <div
          className={cn(
            "panel-resize-handle shrink-0",
            isDragging && "panel-resize-handle--active"
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />

        {/* Right panel — Preview / Code / Shop Manager (fills remaining space) */}
        <div className="relative flex-1 overflow-hidden">
          {/* Shop Manager panel */}
          {activeTab === "shop-manager" && shopManagerPanel && (
            <div className="absolute inset-0 z-10 overflow-auto bg-background">
              {shopManagerPanel}
            </div>
          )}

          {/* Preview panel — kept mounted to avoid iframe remount */}
          <div
            className={cn(
              "absolute inset-0",
              activeTab === "preview" ? "z-10 visible" : "z-0 invisible"
            )}
          >
            {/*
             * Device frame wrapper — always renders a single tree so Sandpack
             * is never unmounted/remounted when switching device modes.
             * Desktop: outer wrapper is transparent, inner fills 100%.
             * Tablet/Phone: outer has muted bg, inner is constrained width with frame.
             */}
            <div
              className={cn(
                "h-full transition-all duration-200",
                deviceMode !== "desktop"
                  ? "flex items-start justify-center overflow-auto bg-muted/30 p-6"
                  : ""
              )}
            >
              <div
                className={cn(
                  "h-full max-w-full transition-all duration-200",
                  deviceMode !== "desktop"
                    ? "shrink-0 overflow-hidden rounded-lg border border-border shadow-lg"
                    : "w-full"
                )}
                style={
                  deviceMode !== "desktop"
                    ? { width: deviceMode === "tablet" ? 768 : 375 }
                    : undefined
                }
              >
                <PanelErrorBoundary name="Preview">
                  {previewPanel}
                </PanelErrorBoundary>
              </div>
            </div>
          </div>

          {/* Code editor panel — kept mounted to preserve Monaco state */}
          <div
            className={cn(
              "absolute inset-0",
              activeTab === "code" ? "z-10 visible" : "z-0 invisible"
            )}
          >
            <PanelErrorBoundary name="Code Editor">
              {codeEditorPanel}
            </PanelErrorBoundary>
          </div>

          {/* History panel — version timeline + diff viewer */}
          {historyPanel && (
            <div
              className={cn(
                "absolute inset-0 bg-background",
                activeTab === "history" ? "z-10 visible" : "z-0 invisible"
              )}
            >
              {historyPanel}
            </div>
          )}

          {/* Block iframe mouse capture during resize */}
          {isDragging && (
            <div className="absolute inset-0 z-50 cursor-col-resize" />
          )}
        </div>
      </div>

      {/* === Mobile layout: Chat or Preview only (<md), no code editor === */}
      <div className="flex flex-1 overflow-hidden md:hidden">
        {/* Chat panel — visible when mobilePanel is "chat" */}
        <div
          className={cn(
            "h-full w-full",
            mobilePanel === "chat" ? "block" : "hidden"
          )}
        >
          <ChatPanel
            messages={messages}
            isStreaming={isStreaming}
            onSendMessage={onSendMessage}
            creditsRemaining={creditsRemaining}
            isCreditsExhausted={isCreditsExhausted}
            selectedModelId={selectedModelId}
            onModelChange={onModelChange}
            userPlan={userPlan}

          />
        </div>

        {/* Preview panel — visible when mobilePanel is "content" */}
        <div
          className={cn(
            "h-full w-full",
            mobilePanel === "content" ? "block" : "hidden"
          )}
        >
          <PanelErrorBoundary name="Preview">
            {previewPanel}
          </PanelErrorBoundary>
        </div>
      </div>
    </div>
  );
}

/**
 * EditorLayoutSkeleton shows a loading state matching the editor layout.
 * Displayed while project data is being fetched from the API.
 */
export function EditorLayoutSkeleton() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header skeleton */}
      <div className="flex h-12 shrink-0 items-center border-b border-border px-3">
        <div className="flex items-center gap-3">
          <Skeleton className="size-7 rounded-full" />
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44 hidden sm:block" />
          </div>
        </div>
        <div className="mx-auto">
          <Skeleton className="h-8 w-48 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-md hidden sm:block" />
          <Skeleton className="size-7 rounded-full" />
        </div>
      </div>

      {/* Panel body skeleton — desktop */}
      <div className="hidden md:flex flex-1 overflow-hidden">
        <div className="flex w-[30%] shrink-0 flex-col border-r border-border">
          <div className="flex-1 space-y-4 p-4">
            <Skeleton className="ml-auto h-16 w-3/4 rounded-2xl" />
            <Skeleton className="h-24 w-3/4 rounded-2xl" />
            <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
          </div>
          <div className="border-t border-border p-3">
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <div className="flex-1 p-4">
            <Skeleton className="h-full w-full rounded-lg" />
          </div>
        </div>
      </div>

      {/* Panel body skeleton — mobile */}
      <div className="flex md:hidden flex-1 flex-col p-4">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    </div>
  );
}
