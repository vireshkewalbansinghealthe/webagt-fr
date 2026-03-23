/**
 * components/ui/card.tsx
 *
 * Customized shadcn/ui Card component matching Lovable's design system.
 * Key design choices:
 * - Glassmorphism effect with backdrop-blur-sm for depth
 * - Semi-transparent borders (white/10 dark, black/5 light)
 * - Subtle shadow for visual elevation on dark backgrounds
 * - 150ms transitions for smooth hover states
 *
 * Used by: landing page feature cards, pricing cards, project cards, settings panels
 */

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Card container with glassmorphism styling.
 * The backdrop-blur creates a frosted glass effect when overlapping other content.
 */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border border-black/5 dark:border-white/10 py-6 shadow-sm backdrop-blur-sm transition-all duration-150",
        className
      )}
      {...props}
    />
  )
}

/**
 * Card header — contains title, description, and optional action button.
 * Uses CSS grid for automatic layout of title + action pairs.
 */
function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

/**
 * Card title — semibold heading text within the card header.
 */
function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

/**
 * Card description — muted secondary text within the card header.
 */
function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

/**
 * Card action — positioned in the top-right corner of the card header.
 * Used for dropdown menus, icon buttons, or other quick actions.
 */
function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

/**
 * Card content — main body area with horizontal padding.
 */
function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

/**
 * Card footer — bottom section for buttons, links, or supplementary info.
 */
function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
