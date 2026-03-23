/**
 * components/editor/panel-error-boundary.tsx
 *
 * Reusable error boundary for editor panels (preview, code editor, chat).
 * Catches errors within a specific panel without crashing the entire
 * editor view. Shows a friendly inline error message with retry.
 *
 * React error boundaries must be class components because the
 * static getDerivedStateFromError and componentDidCatch lifecycle
 * methods are only available on class components.
 *
 * Usage:
 * <PanelErrorBoundary name="Preview">
 *   <PreviewPanel />
 * </PanelErrorBoundary>
 *
 * Used by: components/editor/editor-layout.tsx
 */

"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Props for the PanelErrorBoundary component.
 *
 * @property name - Display name for the panel (e.g., "Preview", "Code Editor")
 * @property children - The panel content to wrap
 */
interface PanelErrorBoundaryProps {
  name: string;
  children: ReactNode;
}

/**
 * State for the error boundary.
 *
 * @property hasError - Whether an error has been caught
 * @property error - The caught error (for display)
 */
interface PanelErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * PanelErrorBoundary wraps editor panels to catch rendering errors.
 * When an error occurs, it shows an inline error message instead
 * of crashing the entire editor. The user can click "Try again"
 * to attempt re-rendering the panel.
 */
export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  constructor(props: PanelErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  /**
   * Called when a child component throws an error during rendering.
   * Updates state to show the error UI on the next render.
   */
  static getDerivedStateFromError(error: Error): PanelErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Called after an error is caught. Logs the error for debugging.
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.name}] Panel error:`, error, errorInfo);
  }

  /**
   * Resets the error state so the panel re-renders.
   */
  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="flex size-10 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="size-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {this.props.name} failed to load
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="size-3" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
