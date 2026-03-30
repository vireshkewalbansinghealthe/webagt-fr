/**
 * components/landing/navbar.tsx
 *
 * Sticky navigation bar for the landing page, matching Lovable's design.
 * Features:
 * - Logo "Web AGT" on the left
 * - Auth-aware buttons on the right:
 *   - Logged out: "Log in" (outline) + "Get started" (filled)
 *   - Logged in: "Dashboard" button
 * - Transparent background with backdrop-blur for glass effect
 * - No border — blends cleanly into the gradient background
 *
 * This is a Server Component with Clerk client islands for auth state.
 *
 * Used by: app/(marketing)/page.tsx
 */

import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { NavUserInfo } from "./nav-user-info";

/**
 * Navbar renders the top navigation bar on the landing page.
 * Matches Lovable's clean, minimal navbar sitting on top of the gradient.
 */
export function Navbar() {
  return (
    <header className="fixed top-0 z-50 w-full">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 text-lg font-bold tracking-tight text-white group"
        >
          <div className="relative size-9 overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl transition-all duration-300 group-hover:scale-105 group-hover:border-white/20">
            <img src="/logo.svg" alt="WebAGT" className="size-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="font-outfit text-base font-bold leading-none tracking-tight">
              WebAGT
            </span>
            <span className="font-outfit text-[10px] font-medium text-white/50 leading-none mt-1 uppercase tracking-widest">
              Stop Coding. Start Building.
            </span>
          </div>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-6 mr-4">
          <Link
            href="/pricing"
            className="text-sm font-medium text-white/60 hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <SignedIn>
            <Link
              href="/dashboard"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
            <Link
              href="/analytics"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Analytics
            </Link>
            <Link
              href="/settings"
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              Settings
            </Link>
          </SignedIn>
        </div>

        {/* Auth buttons / profile */}
        <div className="flex items-center gap-3">
          <SignedOut>
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:brightness-100"
              asChild
            >
              <Link href="/sign-in">Log in</Link>
            </Button>
            <Button
              size="sm"
              className="bg-white text-black hover:bg-white/90"
              asChild
            >
              <Link href="/sign-up">Get started</Link>
            </Button>
          </SignedOut>

          <SignedIn>
            <NavUserInfo />
          </SignedIn>
        </div>
      </nav>
    </header>
  );
}
