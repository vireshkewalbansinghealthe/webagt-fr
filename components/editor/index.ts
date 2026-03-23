/**
 * components/editor/index.ts
 *
 * Barrel exports for all editor components.
 * Provides a single import point for the editor view components.
 *
 * Note: PreviewPanel and CodeEditorPanel are typically imported
 * via next/dynamic with ssr: false, so they're exported here
 * for reference but may not be directly imported from this barrel.
 *
 * Used by: app/(app)/project/[projectId]/page.tsx
 */

export { EditorLayout, EditorLayoutSkeleton } from "./editor-layout";
export { EditorHeader } from "./editor-header";
export { ProjectMenu } from "./project-menu";
export { EditorTabs } from "./editor-tabs";
export type { EditorTabValue } from "./editor-tabs";
export { ChatPanel } from "./chat-panel";
export { ChatInput } from "./chat-input";
export { MessageBubble } from "./message-bubble";
export { PreviewPanel } from "./preview-panel";
export { CodeEditorPanel } from "./code-editor-panel";
export { FileExplorer } from "./file-explorer";
export { PreviewSkeleton } from "./preview-skeleton";
export { EditorSkeleton } from "./editor-skeleton";
export { VersionTimeline } from "./version-timeline";
export { VersionDiff } from "./version-diff";
export { CreditsDisplay } from "./credits-display";
export { UpgradeCTA } from "./upgrade-cta";
export { ModelSelector } from "./model-selector";
export { ExportButton } from "./export-button";
export { PanelErrorBoundary } from "./panel-error-boundary";
export { GenerationProgress } from "./generation-progress";
export { DeviceToggle } from "./device-toggle";
export type { DeviceMode } from "./device-toggle";
