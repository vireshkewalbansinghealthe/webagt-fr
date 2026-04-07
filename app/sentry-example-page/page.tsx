"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1c1c1c] text-white">
      <div className="flex flex-col items-center gap-6 p-8 text-center">
        <h1 className="text-2xl font-bold">Sentry Test Page</h1>
        <p className="text-sm text-neutral-400 max-w-md">
          Click the button below to send a test error to Sentry and verify the integration is working.
        </p>
        <button
          onClick={() => {
            Sentry.captureException(new Error("Sentry test error from webagt-frontend"));
            alert("Test error sent to Sentry! Check your Sentry dashboard.");
          }}
          className="rounded-md bg-white px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
        >
          Throw Test Error
        </button>
        <a href="/" className="text-xs text-neutral-500 hover:text-white transition-colors">
          ← Back to home
        </a>
      </div>
    </div>
  );
}
