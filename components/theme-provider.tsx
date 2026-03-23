/**
 * components/theme-provider.tsx
 *
 * Theme provider that manages dark/light/system mode.
 * Persists the user's preference in localStorage and a cookie
 * (cookie enables SSR to render the correct theme on first load).
 *
 * The provider reads the stored theme on mount and applies
 * the appropriate class ("dark" or nothing) to the <html> element.
 * System mode follows the OS preference via matchMedia.
 *
 * Usage:
 *   <ThemeProvider>
 *     <App />
 *   </ThemeProvider>
 *
 *   const { theme, setTheme } = useTheme();
 *
 * Used by: app/layout.tsx
 */

"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

/** Supported theme values */
export type Theme = "light" | "dark" | "system";

/** localStorage and cookie key for persisting theme preference */
const THEME_KEY = "theme";

/**
 * Context shape for theme state and setter.
 */
interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
});

/**
 * Resolves "system" to the actual theme based on OS preference.
 *
 * @param theme - The user's theme setting
 * @returns "dark" or "light"
 */
function resolveTheme(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return theme;
}

/**
 * Applies the resolved theme to the <html> element.
 * Adds or removes the "dark" class.
 *
 * @param resolved - The resolved theme ("dark" or "light")
 */
function applyTheme(resolved: "dark" | "light") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * Props for the ThemeProvider component.
 *
 * @property children - App content to wrap
 * @property defaultTheme - Initial theme before localStorage is read
 */
interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

/**
 * ThemeProvider manages the app's color theme.
 * Reads from localStorage on mount, listens for system theme changes,
 * and persists the user's choice to both localStorage and a cookie.
 *
 * @param children - App content
 * @param defaultTheme - Fallback theme (defaults to "dark")
 */
export function ThemeProvider({
  children,
  defaultTheme = "dark",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);

  /**
   * On mount, read the stored theme from localStorage.
   * Apply it immediately to prevent flash of wrong theme.
   */
  useEffect(() => {
    const stored = localStorage.getItem(THEME_KEY) as Theme | null;
    const initial = stored || defaultTheme;
    setThemeState(initial);
    applyTheme(resolveTheme(initial));
  }, [defaultTheme]);

  /**
   * Listen for OS theme changes when in "system" mode.
   * Updates the applied theme without changing the stored preference.
   */
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      applyTheme(event.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [theme]);

  /**
   * Sets the theme, persists to localStorage and cookie,
   * and applies the resolved class to <html>.
   */
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    // Set cookie for SSR (1 year expiry)
    document.cookie = `${THEME_KEY}=${newTheme};path=/;max-age=31536000;SameSite=Lax`;
    applyTheme(resolveTheme(newTheme));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access the current theme and setter.
 *
 * @returns The theme context value with theme and setTheme
 */
export function useTheme() {
  return useContext(ThemeContext);
}
