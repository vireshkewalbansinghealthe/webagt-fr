/**
 * components/providers.tsx
 *
 * Client-side provider wrapper that combines ThemeProvider and ClerkProvider.
 * ThemeProvider wraps ClerkProvider so Clerk can read the resolved theme
 * and apply the correct baseTheme (dark or light) to all Clerk components,
 * including the "Manage Account" modal.
 *
 * Used by: app/layout.tsx
 */

"use client";

import { type ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { RateLimitProvider } from "@/components/rate-limit-provider";

/**
 * Inner wrapper that reads the current theme from ThemeProvider context
 * and passes the appropriate Clerk baseTheme to ClerkProvider.
 * Dark mode → uses Clerk's dark theme.
 * Light mode → uses Clerk's default (light) theme.
 */
function ClerkWithTheme({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  /**
   * Resolve "system" to the actual preference.
   * Falls back to "dark" during SSR (matches our default).
   */
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      (typeof window === "undefined" ||
        window.matchMedia("(prefers-color-scheme: dark)").matches));

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? dark : undefined,
      }}
    >
      {children}
    </ClerkProvider>
  );
}

/**
 * Props for the Providers component.
 *
 * @property children - App content to wrap with all providers
 */
export interface ProvidersProps {
  children: ReactNode;
}

/**
 * Providers wraps all client-side context providers in the correct order:
 * 1. ThemeProvider — manages dark/light/system theme state
 * 2. ClerkProvider — auth context with theme-aware appearance
 *
 * @param children - App content
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider defaultTheme="dark">
      <ClerkWithTheme>
        <RateLimitProvider>{children}</RateLimitProvider>
      </ClerkWithTheme>
    </ThemeProvider>
  );
}
