/**
 * app/global-error.tsx
 *
 * Global error boundary for the entire application.
 * Next.js renders this when an unhandled error occurs in the root
 * layout or any page that doesn't have its own error boundary.
 *
 * Must include <html> and <body> tags since it replaces the root layout.
 *
 * Used by: Next.js (automatic — wraps the root layout)
 */

"use client";

import { useEffect } from "react";

/**
 * GlobalError renders a full-page error screen when the app crashes.
 * Includes a "Try again" button that calls the reset function
 * provided by Next.js to attempt re-rendering the failed component.
 *
 * @param error - The error that was thrown
 * @param reset - Function to re-render the failed component tree
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen items-center justify-center bg-[#1c1c1c] text-white antialiased">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10">
            <span className="text-2xl">!</span>
          </div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="max-w-sm text-sm text-neutral-400">
            An unexpected error occurred. Try refreshing the page.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
