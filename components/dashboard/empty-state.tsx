/**
 * components/dashboard/empty-state.tsx
 *
 * Empty state displayed when a user has no projects yet.
 * Shows a folder icon, encouraging heading, description, and
 * a CTA button to create their first project.
 *
 * This is the first thing new users see after signing up and
 * navigating to the dashboard.
 *
 * Used by: app/(app)/dashboard/page.tsx
 */

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateProps {
  onCreateProject: () => void;
}

export function EmptyState({ onCreateProject }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      {/* Animated icon */}
      <div className="relative flex size-20 items-center justify-center rounded-2xl bg-muted">
        <Sparkles className="size-9 text-muted-foreground" />
        {/* Subtle glow behind icon */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/10 via-cyan-500/10 to-pink-500/10 blur-md -z-10 scale-110" />
      </div>

      <h2 className="mt-6 text-xl font-semibold">No projects yet</h2>
      <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
        Create your first project to start building with AI. Describe your idea
        and watch it come to life.
      </p>

      {/* Animated magic border wrapper */}
      <div data-tour="create-project" className="relative mt-8 p-[2px] rounded-xl" style={{ isolation: "isolate" }}>
        {/* Rotating conic-gradient border */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background:
              "conic-gradient(from var(--angle, 0deg), #a855f7, #06b6d4, #ec4899, #f59e0b, #22c55e, #a855f7)",
            animation: "ai-border-spin 3s linear infinite",
          }}
        />
        {/* Blurred glow copy */}
        <div
          className="absolute inset-0 rounded-xl opacity-60 blur-[6px]"
          style={{
            background:
              "conic-gradient(from var(--angle, 0deg), #a855f7, #06b6d4, #ec4899, #f59e0b, #22c55e, #a855f7)",
            animation: "ai-border-spin 3s linear infinite",
          }}
        />
        {/* Inner button — sits on top of the border */}
        <div className="relative z-10 rounded-[10px] p-[2px]" style={{ background: "var(--background)" }}>
          <Button
            size="lg"
            className="gap-2 px-8 text-base font-semibold rounded-[8px]"
            onClick={onCreateProject}
          >
            <Sparkles className="size-4" />
            Create Project
          </Button>
        </div>
      </div>

      {/* Keyframes injected inline */}
      <style>{`
        @property --angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes ai-border-spin {
          to { --angle: 360deg; }
        }
      `}</style>
    </div>
  );
}
