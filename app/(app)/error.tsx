/**
 * app/(app)/error.tsx
 *
 * Error boundary for the authenticated app area (dashboard, editor, settings).
 * Catches errors thrown by any page or component within the (app) route group.
 *
 * Shows a friendly error message with options to retry or go back
 * to the dashboard. Maintains the app shell (layout) around it.
 *
 * Used by: Next.js (automatic — wraps pages in the (app) group)
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * AppError renders an error state within the authenticated layout.
 * Unlike global-error.tsx, this keeps the app shell (nav, sidebar)
 * visible, so the user can still navigate.
 *
 * @param error - The error that was thrown
 * @param reset - Function to re-render the failed component tree
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="size-6 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred. Try again or go back to your dashboard."}
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="size-3.5" />
          Try again
        </Button>
        <Button asChild className="gap-2">
          <Link href="/dashboard">
            <ArrowLeft className="size-3.5" />
            Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
