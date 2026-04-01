"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const EXAMPLES = [
  "Build a luxury watch store with Stripe checkout",
  "Create a SaaS landing page with pricing table",
  "Make a fashion webshop with product catalog",
  "Design a portfolio site with animations",
  "Build a coffee subscription shop with orders",
  "Create a restaurant site with online booking",
];

export function Hero() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % EXAMPLES.length);
        setVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center px-6 overflow-hidden">

      {/* ── Animated dark background ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Base matches dashboard background */}
        <div className="absolute inset-0 bg-[#1c1c1c]" />

        {/* Very subtle animated color blobs — just a whisper of color */}
        <div className="absolute -top-[10%] left-[30%] h-[55%] w-[70%] -translate-x-1/2 rounded-full bg-[#3b2d8a] opacity-12 blur-[160px]" style={{ animation: "blob1 20s ease-in-out infinite" }} />
        <div className="absolute top-[10%] right-[0%] h-[45%] w-[50%] rounded-full bg-[#5b2fa0] opacity-10 blur-[160px]" style={{ animation: "blob2 24s ease-in-out infinite" }} />
        <div className="absolute bottom-[0%] left-[0%] h-[50%] w-[45%] rounded-full bg-[#7b1f6a] opacity-10 blur-[150px]" style={{ animation: "blob3 28s ease-in-out infinite" }} />
        <div className="absolute bottom-[5%] right-[10%] h-[40%] w-[40%] rounded-full bg-[#1a3070] opacity-10 blur-[150px]" style={{ animation: "blob4 22s ease-in-out infinite" }} />

      </div>

        {/* Subtle animated gradient accent line below content */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{
            background: "conic-gradient(from var(--angle, 0deg), #a855f7, #06b6d4, #ec4899, #f59e0b, #22c55e, #a855f7)",
            backgroundSize: "200% 100%",
            animation: "ai-border-spin 6s linear infinite",
            opacity: 0.4,
          }}
        />
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center text-center">

        {/* Headline — smaller, more intimate */}
        <h1 className="font-outfit text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-white">
          What will you build today?
        </h1>

        {/* Subtitle */}
        <p className="mt-3 text-base text-white/50 font-medium max-w-md">
          Describe your idea and AI builds it — with database, payments, and live preview.
        </p>

        {/* CTA input card with animated example */}
        <div className="mt-8 w-full">
          <Link href="/sign-up" className="group block transform transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]">
              <div className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-[#141414]/95 shadow-[0_0_60px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-all duration-150 hover:border-white/15">
              <div className="px-8 pb-4 pt-8 min-h-[64px] flex items-center">
                <p
                  className="text-left text-lg font-medium text-white/35 transition-all duration-400"
                  style={{
                    opacity: visible ? 1 : 0,
                    transform: visible ? "translateY(0px)" : "translateY(-8px)",
                    transition: "opacity 0.35s ease, transform 0.35s ease",
                  }}
                >
                  {EXAMPLES[index]}…
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

      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes blob1 {
          0%, 100% { transform: translate(-50%, 0%) scale(1); }
          33%       { transform: translate(-45%, -8%) scale(1.08); }
          66%       { transform: translate(-55%, 5%) scale(0.94); }
        }
        @keyframes blob2 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          40%       { transform: translate(6%, 10%) scale(1.1); }
          70%       { transform: translate(-4%, -6%) scale(0.92); }
        }
        @keyframes blob3 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          35%       { transform: translate(8%, -10%) scale(1.06); }
          65%       { transform: translate(-5%, 8%) scale(0.96); }
        }
        @keyframes blob4 {
          0%, 100% { transform: translate(0%, 0%) scale(1); }
          50%       { transform: translate(-10%, -8%) scale(1.12); }
        }
        @keyframes blob5 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          30%       { transform: translate(-48%, -55%) scale(1.15); }
          70%       { transform: translate(-52%, -45%) scale(0.9); }
        }
      `}</style>
    </section>
  );
}
