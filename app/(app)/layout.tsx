/**
 * app/(app)/layout.tsx
 *
 * Layout for the authenticated app route group.
 * Provides a sidebar + main content structure:
 *
 * ┌─────────────┬───────────────────────────┐
 * │  Sidebar    │  Main Content Area        │
 * │  (240px)    │  (flex-1)                 │
 * │             │                           │
 * │  - Logo     │  Page content renders     │
 * │  - Nav      │  here via {children}      │
 * │  - Credits  │                           │
 * │  - User     │                           │
 * └─────────────┴───────────────────────────┘
 *
 * The sidebar collapses on mobile and is toggled with a hamburger button.
 * All routes under (app) require authentication — enforced by Clerk middleware.
 *
 * Routes in this group: /dashboard, /project/[id], /settings
 *
 * Used by: dashboard, project editor, settings pages
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { UserAvatarButton } from "@/components/shared/user-avatar-button";
import {
  LayoutDashboard,
  BarChart3,
  Settings,
  CreditCard,
  HelpCircle,
  Info,
  Mail,
  Menu,
  X,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreditsDisplay } from "@/components/editor/credits-display";
import { RateLimitBanner } from "@/components/rate-limit-provider";

/**
 * Navigation items displayed in the sidebar.
 * Each item has a label, path for route matching, and Lucide icon.
 */
const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Pricing", href: "/pricing", icon: CreditCard },
] as const;

const BOTTOM_NAV_ITEMS = [
  { label: "About", href: "/about", icon: Info },
  { label: "Help & Support", href: "/help", icon: HelpCircle },
  { label: "Contact", href: "/contact", icon: Mail },
] as const;

/**
 * AppLayout provides the sidebar navigation and main content area.
 * Uses CSS grid for the desktop layout and absolute positioning
 * for the mobile slide-out sidebar.
 *
 * When the user is on a project editor page (/project/[id]),
 * the sidebar is hidden and children get the full viewport —
 * the editor has its own panel-based layout.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useUser();

  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const userDisplayName = user?.fullName || user?.firstName || userEmail.split("@")[0] || "Account";
  const isAdmin = user?.publicMetadata?.role === "admin";

  /**
   * Editor pages get full-width layout (no sidebar).
   * The editor has its own chat panel + preview/code panels.
   */
  const isEditorPage = pathname.startsWith("/project/");

  if (isEditorPage) {
    return (
      <div className="flex h-screen flex-col bg-background text-foreground">
        <RateLimitBanner />
        <div className="flex flex-1 overflow-hidden">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <RateLimitBanner />
      <div className="flex flex-1 overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Sidebar header — logo + close button on mobile */}
        <div className="flex h-16 items-center justify-between px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group transition-opacity duration-150 hover:opacity-90"
          >
            <div className="relative size-7 overflow-hidden rounded-lg border border-border bg-black shadow-sm group-hover:border-primary/50 transition-colors">
              <img src="/logo.svg" alt="WebAGT" className="size-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-outfit text-sm font-bold leading-none tracking-tight">
                WebAGT
              </span>
              <span className="font-outfit text-[9px] font-medium text-muted-foreground leading-none mt-0.5 uppercase tracking-wider">
                Stop Coding. Start Building.
              </span>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon-xs"
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <Separator />

        {/* Navigation links */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Credits display — fetches real data from API */}
        <div className="px-3 pb-2 space-y-1">
          {BOTTOM_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div className="px-3 pb-1">
            <Link
              href="/admin"
              onClick={() => setSidebarOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                pathname.startsWith("/admin")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <Shield className="size-4" />
              Admin Console
            </Link>
          </div>
        )}

        <CreditsDisplay />

        <Separator />

        {/* User profile row */}
        <div className="flex items-center gap-3 px-4 py-3">
          <UserAvatarButton className="size-8" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-foreground leading-tight">
              {userDisplayName}
            </span>
            {userEmail && (
              <span className="truncate text-[11px] text-muted-foreground leading-tight mt-0.5">
                {userEmail}
              </span>
            )}
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — mobile hamburger + page content header */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-6 md:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </Button>
          <span className="flex items-center gap-2 text-sm font-semibold">
            <img src="/logo.svg" alt="" className="size-5 rounded" />
            WebAGT
          </span>
        </header>

        {/* Page content — scrollable area with fade-in animation */}
        <main className="flex-1 overflow-y-auto animate-fade-in">{children}</main>
      </div>
      </div>
    </div>
  );
}
