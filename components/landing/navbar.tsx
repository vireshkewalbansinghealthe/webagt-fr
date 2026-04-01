"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { NavUserInfo } from "./nav-user-info";
import { cn } from "@/lib/utils";
import {
  Tag,
  Info,
  Question,
  Envelope,
  Gauge,
  Gear,
  SquaresFour,
} from "@phosphor-icons/react";

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing", icon: Tag },
  { href: "/about",   label: "About",   icon: Info },
  { href: "/help",    label: "Help",     icon: Question },
  { href: "/contact", label: "Contact",  icon: Envelope },
];

const SIGNED_IN_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: SquaresFour },
  { href: "/analytics", label: "Analytics", icon: Gauge },
  { href: "/settings",  label: "Settings",  icon: Gear },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <style>{`
        @property --angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes ai-border-spin {
          to { --angle: 360deg; }
        }
        .get-started-btn {
          position: relative;
          border-radius: 6px;
        }
        .get-started-btn::before {
          content: "";
          position: absolute;
          inset: -2px;
          border-radius: 8px;
          background: conic-gradient(from var(--angle), #a855f7, #06b6d4, #ec4899, #f59e0b, #22c55e, #a855f7);
          animation: ai-border-spin 3s linear infinite;
          z-index: -1;
        }
      `}</style>

      <header
        className={cn(
          "fixed top-0 z-50 w-full transition-all duration-300",
          scrolled
            ? "bg-[#1c1c1c]/95 backdrop-blur-md border-b border-white/[0.06] shadow-lg"
            : "bg-transparent"
        )}
      >
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
          <div className="hidden sm:flex items-center gap-1 mr-4">
            <SignedIn>
              {SIGNED_IN_LINKS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/55 hover:text-white hover:bg-white/8 transition-all"
                >
                  <Icon className="size-3.5 shrink-0" weight="regular" />
                  {label}
                </Link>
              ))}
            </SignedIn>

            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/55 hover:text-white hover:bg-white/8 transition-all"
              >
                <Icon className="size-3.5 shrink-0" weight="regular" />
                {label}
              </Link>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-3">
            <SignedOut>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white hover:bg-white/8"
                asChild
              >
                <Link href="/sign-in">Log in</Link>
              </Button>

              {/* Animated "Get started" button */}
              <div className="get-started-btn">
                <Button
                  size="sm"
                  className="relative z-10 bg-white text-black hover:bg-white/90 rounded-[6px]"
                  asChild
                >
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </div>
            </SignedOut>

            <SignedIn>
              <NavUserInfo />
            </SignedIn>
          </div>
        </nav>
      </header>
    </>
  );
}
