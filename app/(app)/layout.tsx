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
import { useUser, useClerk, useAuth } from "@clerk/nextjs";
import { Navbar } from "@/components/landing";
import { UserAvatarButton } from "@/components/shared/user-avatar-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  House,
  ChartBar,
  Gear,
  Tag,
  Flask,
  Info,
  Headset,
  Envelope,
  List,
  X,
  ShieldCheck,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CreditsDisplay } from "@/components/editor/credits-display";
import { RateLimitBanner } from "@/components/rate-limit-provider";

/**
 * Navigation items displayed in the sidebar.
 * Each item has a label, path for route matching, and Phosphor icon.
 */
const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: House },
  { label: "Analytics", href: "/analytics", icon: ChartBar },
  { label: "Settings", href: "/settings", icon: Gear },
  { label: "Pricing", href: "/pricing", icon: Tag },
  { label: "Public Testing", href: "/testing", icon: Flask },
] as const;

const BOTTOM_NAV_ITEMS = [
  { label: "About", href: "/about", icon: Info },
  { label: "Help & Support", href: "/help", icon: Headset },
  { label: "Contact", href: "/contact", icon: Envelope },
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
  const { signOut, openUserProfile } = useClerk();
  const { isSignedIn, isLoaded } = useAuth();

  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const userDisplayName = user?.fullName || user?.firstName || userEmail.split("@")[0] || "Account";
  const isAdmin = user?.publicMetadata?.role === "admin";

  /** Pages that are publicly accessible — show marketing Navbar for unauthenticated visitors */
  const PUBLIC_PAGES = ["/pricing", "/about", "/contact", "/help"];
  const isPublicPage = PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));

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

  /** Non-logged-in visitors on public pages get the marketing Navbar (no sidebar) */
  if (isLoaded && !isSignedIn && isPublicPage) {
    return (
      <div className="relative min-h-screen bg-background text-foreground">
        <Navbar />
        <main className="pt-20">{children}</main>
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
          "fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col bg-sidebar transition-transform duration-200 md:static md:translate-x-0 border-r border-sidebar-border",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* ── Top: brand logo + mobile close ── */}
        <div className="flex h-14 shrink-0 items-center justify-between px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 group transition-opacity hover:opacity-80"
          >
            <div className="relative size-7 overflow-hidden rounded-lg border border-border bg-black shadow-sm group-hover:border-primary/40 transition-colors">
              <img src="/logo.svg" alt="WebAGT" className="size-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="font-outfit text-sm font-bold leading-none tracking-tight">WebAGT</span>
              <span className="font-outfit text-[9px] font-medium text-muted-foreground/70 leading-none mt-0.5 uppercase tracking-wider">
                Stop Coding. Start Building.
              </span>
            </div>
          </Link>
          <Button variant="ghost" size="icon-xs" className="md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>

        {/* ── Main nav ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* FEATURE section */}
          <div>
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">
              Feature
            </p>
            <div className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    {...(item.href === "/pricing" ? { "data-tour": "pricing-link" } : {})}
                    className={cn(
                      "relative flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 overflow-hidden",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn("size-5 shrink-0", isActive ? "text-foreground" : "text-muted-foreground/70")}
                      weight={isActive ? "fill" : "regular"}
                    />
                    {item.label}
                    {/* Right-edge accent bar on active item */}
                    {isActive && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* MORE section */}
          <div>
            <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/40">
              More
            </p>
            <div className="space-y-0.5">
              {BOTTOM_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "relative flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 overflow-hidden",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                    )}
                  >
                    <item.icon
                      className={cn("size-5 shrink-0", isActive ? "text-foreground" : "text-muted-foreground/70")}
                      weight={isActive ? "fill" : "regular"}
                    />
                    {item.label}
                    {isActive && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}

              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "relative flex items-center gap-3.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-150 overflow-hidden",
                    pathname.startsWith("/admin")
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                  )}
                >
                  <ShieldCheck
                    className={cn("size-5 shrink-0", pathname.startsWith("/admin") ? "text-primary" : "text-muted-foreground/70")}
                    weight={pathname.startsWith("/admin") ? "fill" : "regular"}
                  />
                  Admin
                  {pathname.startsWith("/admin") && (
                    <span className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
                  )}
                </Link>
              )}
            </div>
          </div>
        </nav>

        {/* ── Credits ── */}
        <CreditsDisplay />

        {/* ── User profile (bottom, clickable) ── */}
        <div className="px-3 py-3 border-t border-sidebar-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                suppressHydrationWarning
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-sidebar-accent/60 transition-colors text-left outline-none"
              >
                <UserAvatarButton className="size-8 shrink-0 pointer-events-none" />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold text-foreground leading-tight">
                    {userDisplayName}
                  </span>
                  {userEmail && (
                    <span className="truncate text-[11px] text-muted-foreground/70 leading-tight mt-0.5">
                      {userEmail}
                    </span>
                  )}
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
              <DropdownMenuItem onClick={() => openUserProfile()}>
                <UserCircle className="size-4 mr-2" />
                Manage account
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => signOut({ redirectUrl: "/" })}
              >
                <SignOut className="size-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar — mobile only: hamburger + logo + user avatar */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-4 md:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setSidebarOpen(true)}
            >
              <List className="size-5" />
            </Button>
            <Link href="/dashboard" className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="size-6 rounded-md border border-border" />
              <span className="font-outfit text-sm font-bold tracking-tight">WebAGT</span>
            </Link>
          </div>

          {/* Profile chip — right side on mobile */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 pl-1 pr-2.5 py-1">
              <UserAvatarButton className="size-6" />
              <span className="text-xs font-medium text-foreground max-w-[80px] truncate">
                {userDisplayName}
              </span>
            </div>
          </div>
        </header>

        {/* Page content — scrollable area with fade-in animation */}
        <main className="flex-1 overflow-y-auto animate-fade-in">{children}</main>
      </div>
      </div>
    </div>
  );
}
