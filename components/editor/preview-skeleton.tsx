/**
 * components/editor/preview-skeleton.tsx
 *
 * Loading skeleton displayed while Sandpack is being lazy-loaded.
 * Shows a fake browser chrome (URL bar + loading indicator)
 * to give users a visual cue that the preview is loading.
 *
 * Used by: components/editor/preview-panel.tsx (as dynamic import fallback)
 */

import { Skeleton } from "@/components/ui/skeleton";

/**
 * PreviewSkeleton renders a browser-like loading state
 * that matches the dimensions and style of the Sandpack preview.
 */
export function PreviewSkeleton() {
  return (
    <div className="flex h-full flex-col bg-background">
      {/* Fake browser URL bar */}
      <div className="flex h-10 items-center gap-2 border-b border-border px-3">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-muted" />
          <div className="size-2.5 rounded-full bg-muted" />
          <div className="size-2.5 rounded-full bg-muted" />
        </div>
        <Skeleton className="h-6 flex-1 rounded-md" />
      </div>

      {/* Fake page content */}
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-4 w-64 rounded-md" />
        <Skeleton className="mt-4 h-32 w-full max-w-md rounded-lg" />
      </div>
    </div>
  );
}
