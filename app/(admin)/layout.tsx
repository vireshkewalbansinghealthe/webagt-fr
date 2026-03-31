"use client";

export const dynamic = "force-dynamic";

/**
 * app/(admin)/layout.tsx
 *
 * Layout for the admin route group (/admin/*).
 * Checks that the signed-in user has publicMetadata.role === "admin".
 * Non-admins are immediately redirected to /dashboard.
 *
 * Renders an admin sidebar + main content area.
 */

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Users,
  Shield,
  BarChart3,
  ArrowLeft,
  Settings2,
  ScrollText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const NAV_ITEMS = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Project Logs", href: "/admin/logs", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = isLoaded && user?.publicMetadata?.role === "admin";

  useEffect(() => {
    if (!isLoaded) return;
    if (!isAdmin) {
      router.replace("/dashboard");
    }
  }, [isLoaded, isAdmin, router]);

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        {/* Header */}
        <div className="flex h-16 items-center gap-2.5 px-5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Shield className="size-4 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none">Admin</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">
              WebAGT Console
            </span>
          </div>
        </div>

        <Separator />

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
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

        <Separator />

        {/* Back to app */}
        <div className="px-3 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
