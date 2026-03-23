/**
 * components/ui/sonner.tsx
 *
 * Toast notification provider using Sonner (shadcn-recommended).
 * Renders toasts in the bottom-right corner with custom icons
 * and styling that matches our design system.
 *
 * Reads the current theme from our ThemeProvider context
 * so toasts match the active dark/light mode.
 *
 * Usage: import { toast } from "sonner" and call toast.success(),
 * toast.error(), etc. anywhere in the app.
 *
 * Used by: app/layout.tsx (mounted once at the root)
 */

"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { useTheme } from "@/components/theme-provider";

/**
 * Toaster renders the toast container at the bottom-right.
 * Resolves the theme from our ThemeProvider context so
 * toasts adapt when the user toggles dark/light mode.
 *
 * @param props - Additional Sonner props (position, duration, etc.)
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  /** Resolve "system" to the actual OS preference */
  const resolvedTheme =
    theme === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  return (
    <Sonner
      theme={resolvedTheme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
