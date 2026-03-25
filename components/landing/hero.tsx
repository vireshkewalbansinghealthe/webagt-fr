/**
 * components/landing/hero.tsx
 *
 * Hero section matching Lovable's landing page design.
 * Features:
 * - Full-viewport mesh gradient background (blue → purple → pink)
 * - Announcement badge: "New · Introducing a smarter experience →"
 * - Large white headline: "Build something Lovable"
 * - Subtitle: "Create apps and websites by chatting with AI"
 * - Large dark chat input card with:
 *   - Textarea-style placeholder
 *   - Bottom bar: "+" icon, "Plan" button, submit arrow
 * - The CTA links to /sign-up since generation requires auth
 *
 * Used by: app/(marketing)/page.tsx
 */

import Link from "next/link";
import { ArrowRight } from "lucide-react";
/**
 * Hero renders the main landing section with the gradient background,
 * headline, and the signature dark chat input card.
 */
export function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6">
      {/* Mesh gradient background — blue/purple/pink flowing gradients */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Base gradient layer */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#1a0533] via-[#0f0a2e] to-[#1c1c1c]" />

        {/* Blue blob — top center */}
        <div className="absolute -top-[20%] left-1/2 h-[70%] w-[80%] -translate-x-1/2 rounded-full bg-[#3b47d6] opacity-40 blur-[120px]" />

        {/* Purple blob — center */}
        <div className="absolute top-[10%] left-[20%] h-[50%] w-[60%] rounded-full bg-[#6b3fa0] opacity-30 blur-[120px]" />

        {/* Pink/magenta blob — bottom left */}
        <div className="absolute bottom-[0%] left-[5%] h-[60%] w-[50%] rounded-full bg-[#d63384] opacity-30 blur-[120px]" />

        {/* Pink blob — bottom right */}
        <div className="absolute bottom-[5%] right-[10%] h-[50%] w-[45%] rounded-full bg-[#e84393] opacity-25 blur-[120px]" />

        {/* Hot pink accent — bottom center */}
        <div className="absolute bottom-[10%] left-1/2 h-[40%] w-[40%] -translate-x-1/2 rounded-full bg-[#ff006e] opacity-20 blur-[100px]" />
      </div>

      {/* Content — centered on top of gradient */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">
        {/* Headline */}
        <h1 className="font-outfit text-5xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl md:text-7xl">
          Build Real Webshops with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">AI</span>
        </h1>

        {/* Subtitle */}
        <p className="mt-6 text-xl text-white/70 font-medium">
          The all-in-one platform to generate fully functional shops with Turso DB and Stripe Connect.
        </p>

        {/* CTA input card */}
        <div className="mt-10 w-full">
          <Link href="/sign-up" className="group block transform transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#0a0a0a]/80 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all duration-150 hover:border-white/20">
              <div className="px-8 pb-4 pt-8">
                <p className="text-left text-lg font-medium text-white/40">
                  Build a premium watch store with Stripe checkout...
                </p>
              </div>
              <div className="flex items-center justify-end px-5 pb-5">
                <div className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black shadow-md transition-all duration-150 group-hover:bg-white/90">
                  Start building <ArrowRight className="size-4" />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick-start suggestion chips */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[
            "A luxury watch store",
            "A minimalist fashion shop",
            "A coffee subscription shop",
          ].map((label) => (
            <Link
              key={label}
              href={`/sign-up?prompt=${encodeURIComponent(label)}`}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/60 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
