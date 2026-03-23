/**
 * lib/utils.ts
 *
 * Shared utility functions used across the entire application.
 * The main export is `cn()` — a helper that combines clsx (conditional
 * class joining) with tailwind-merge (intelligent Tailwind class deduplication).
 *
 * Example:
 *   cn("p-4 text-red-500", isActive && "bg-blue-500", "p-8")
 *   // → "text-red-500 bg-blue-500 p-8"  (p-4 merged away by tailwind-merge)
 *
 * Used by: virtually every component in the project (shadcn/ui components rely on this)
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names with intelligent Tailwind CSS class merging.
 *
 * Uses clsx to conditionally join classNames, then passes the result
 * through tailwind-merge to resolve conflicting Tailwind utilities
 * (e.g., "p-4 p-8" becomes "p-8").
 *
 * @param inputs - Any number of class values (strings, arrays, objects, conditionals)
 * @returns A single merged className string with conflicts resolved
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
