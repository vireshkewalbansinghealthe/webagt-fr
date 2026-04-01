"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUser, useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ArrowRight, FolderPlus, Search, Crown, Sparkles, X } from "lucide-react";

interface TourStep {
  target: string;
  title: string;
  description: string;
  side: "top" | "bottom" | "left" | "right";
  icon: React.ReactNode;
  color: string; // tailwind bg class for the icon badge
}

const STEPS: TourStep[] = [
  {
    target: '[data-tour="create-project"]',
    title: "Create your first project",
    description:
      "Click here to start building. Choose a website or webshop, pick a template or describe your idea — the AI handles the rest.",
    side: "bottom",
    icon: <FolderPlus className="size-4" />,
    color: "bg-blue-500",
  },
  {
    target: '[data-tour="search"]',
    title: "Search & organize",
    description:
      "All your projects appear in the dashboard. Search by name, filter by type, and switch between grid and list view to stay organised.",
    side: "bottom",
    icon: <Search className="size-4" />,
    color: "bg-violet-500",
  },
  {
    target: '[data-tour="pricing-link"]',
    title: "Upgrade to Pro",
    description:
      "The free plan gives you 3 projects. Upgrade to Pro for unlimited projects, more AI credits, custom domains, and priority support.",
    side: "right",
    icon: <Crown className="size-4" />,
    color: "bg-amber-500",
  },
];

const PADDING = 12;
const TOOLTIP_GAP = 20;
const TOOLTIP_WIDTH = 300;
const OVERLAY = "rgba(0,0,0,0.78)";
const ARROW_SIZE = 10;

export function SpotlightTour() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(-1); // -1 = welcome
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;
    const client = createApiClient(getToken);
    client.credits
      .getOnboardingSeen()
      .then(({ seen }) => {
        if (!seen) setTimeout(() => setActive(true), 500);
      })
      .catch(() => {
        if (!localStorage.getItem("webagt_onboarding_seen"))
          setTimeout(() => setActive(true), 500);
      });
  }, [isLoaded, isSignedIn, user, getToken]);

  const measureTarget = useCallback(() => {
    if (!active || step < 0) return;
    const el = document.querySelector(STEPS[step].target);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
    setHasMeasured(true);
  }, [active, step]);

  useEffect(() => {
    if (step < 0) return;
    setHasMeasured(false);
    // Small delay so DOM has settled after step change
    const t = setTimeout(measureTarget, 100);
    window.addEventListener("resize", measureTarget);
    window.addEventListener("scroll", measureTarget, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measureTarget);
      window.removeEventListener("scroll", measureTarget, true);
    };
  }, [measureTarget, step]);

  const dismiss = useCallback(() => {
    setActive(false);
    const client = createApiClient(getToken);
    client.credits.markOnboardingSeen().catch(() => {
      localStorage.setItem("webagt_onboarding_seen", "1");
    });
  }, [getToken]);

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else dismiss();
  };

  if (!active || !mounted) return null;

  // ── Welcome screen ──────────────────────────────────────────────────────────
  if (step === -1) {
    const firstName = user?.firstName || user?.username || "there";
    return createPortal(
      <>
        <style>{`
          @keyframes tour-fade-up {
            from { opacity: 0; transform: translateY(16px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)    scale(1);    }
          }
          .tour-welcome { animation: tour-fade-up 0.35s cubic-bezier(.22,1,.36,1) both; }
        `}</style>

        <div
          style={{ position: "fixed", inset: 0, zIndex: 9998, background: OVERLAY, backdropFilter: "blur(2px)" }}
          className="flex items-center justify-center p-4"
        >
          <div className="tour-welcome w-full max-w-[360px] rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden">
            {/* Top accent strip */}
            <div className="h-1 w-full bg-gradient-to-r from-primary via-primary/70 to-primary/30" />

            <div className="p-8 text-center">
              <div className="mx-auto mb-5 size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Sparkles className="size-7 text-primary" />
              </div>

              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1.5">
                Welcome to WebAGT
              </p>
              <h2 className="text-2xl font-bold leading-tight mb-3">
                Hey {firstName}! 👋
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                Great to have you here. Want a quick 30-second tour so you know your way around?
              </p>

              <div className="flex flex-col gap-2.5">
                <Button className="w-full gap-2 h-10" onClick={() => setStep(0)}>
                  <Sparkles className="size-4" />
                  Show me around
                  <ArrowRight className="size-4" />
                </Button>
                <button
                  onClick={dismiss}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ── Spotlight steps ─────────────────────────────────────────────────────────
  // Wait until measurement has been attempted before deciding to skip
  if (!hasMeasured) return null;

  if (!rect) {
    // Target not in DOM — skip to next step or dismiss
    if (step < STEPS.length - 1) {
      setTimeout(() => setStep((s) => s + 1), 100);
    } else {
      dismiss();
    }
    return null;
  }

  const { side } = STEPS[step];
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const sTop    = rect.top    - PADDING;
  const sLeft   = rect.left   - PADDING;
  const sRight  = rect.right  + PADDING;
  const sBottom = rect.bottom + PADDING;
  const sW      = sRight - sLeft;
  const sH      = sBottom - sTop;

  // ── Tooltip position ────────────────────────────────────────────────────────
  let tooltipTop  = 0;
  let tooltipLeft = 0;
  let arrowStyle: React.CSSProperties = {};

  if (side === "bottom") {
    tooltipTop  = sBottom + TOOLTIP_GAP;
    tooltipLeft = Math.max(16, Math.min(rect.left - PADDING, vw - TOOLTIP_WIDTH - 16));
    // Arrow points up at the top-left area of the card
    const arrowX = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipLeft - ARROW_SIZE, TOOLTIP_WIDTH - 32));
    arrowStyle = {
      position: "absolute",
      top: -ARROW_SIZE,
      left: arrowX,
      width: 0,
      height: 0,
      borderLeft: `${ARROW_SIZE}px solid transparent`,
      borderRight: `${ARROW_SIZE}px solid transparent`,
      borderBottom: `${ARROW_SIZE}px solid hsl(var(--border) / 0.4)`,
    };
  } else if (side === "top") {
    tooltipTop  = sTop - TOOLTIP_GAP - 180;
    tooltipLeft = Math.max(16, Math.min(rect.left - PADDING, vw - TOOLTIP_WIDTH - 16));
    const arrowX = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipLeft - ARROW_SIZE, TOOLTIP_WIDTH - 32));
    arrowStyle = {
      position: "absolute",
      bottom: -ARROW_SIZE,
      left: arrowX,
      width: 0,
      height: 0,
      borderLeft: `${ARROW_SIZE}px solid transparent`,
      borderRight: `${ARROW_SIZE}px solid transparent`,
      borderTop: `${ARROW_SIZE}px solid hsl(var(--border) / 0.4)`,
    };
  } else if (side === "right") {
    tooltipLeft = sRight + TOOLTIP_GAP;
    tooltipTop  = Math.max(16, Math.min(rect.top - PADDING, vh - 220));
    const arrowY = Math.max(16, Math.min(rect.top + rect.height / 2 - tooltipTop - ARROW_SIZE, 180));
    arrowStyle = {
      position: "absolute",
      left: -ARROW_SIZE,
      top: arrowY,
      width: 0,
      height: 0,
      borderTop: `${ARROW_SIZE}px solid transparent`,
      borderBottom: `${ARROW_SIZE}px solid transparent`,
      borderRight: `${ARROW_SIZE}px solid hsl(var(--border) / 0.4)`,
    };
  } else {
    tooltipLeft = sLeft - TOOLTIP_GAP - TOOLTIP_WIDTH;
    tooltipTop  = Math.max(16, Math.min(rect.top - PADDING, vh - 220));
    const arrowY = Math.max(16, Math.min(rect.top + rect.height / 2 - tooltipTop - ARROW_SIZE, 180));
    arrowStyle = {
      position: "absolute",
      right: -ARROW_SIZE,
      top: arrowY,
      width: 0,
      height: 0,
      borderTop: `${ARROW_SIZE}px solid transparent`,
      borderBottom: `${ARROW_SIZE}px solid transparent`,
      borderLeft: `${ARROW_SIZE}px solid hsl(var(--border) / 0.4)`,
    };
  }

  const currentStep = STEPS[step];

  return createPortal(
    <>
      <style>{`
        @keyframes tour-ping {
          0%   { transform: scale(1);    opacity: 0.55; }
          100% { transform: scale(1.18); opacity: 0;    }
        }
        @keyframes tour-slide-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        .tour-tooltip { animation: tour-slide-in 0.22s cubic-bezier(.22,1,.36,1) both; }
        .tour-ping    { animation: tour-ping 1.6s ease-out infinite; }
      `}</style>

      {/* 4-panel dark overlay */}
      <div style={{ position:"fixed", inset:0, bottom: vh - sTop,  background: OVERLAY, zIndex:9998 }} />
      <div style={{ position:"fixed", top: sBottom, left:0, right:0, bottom:0, background: OVERLAY, zIndex:9998 }} />
      <div style={{ position:"fixed", top: sTop, left:0, width: sLeft, height: sH, background: OVERLAY, zIndex:9998 }} />
      <div style={{ position:"fixed", top: sTop, left: sRight, right:0, height: sH, background: OVERLAY, zIndex:9998 }} />

      {/* Ping ring (subtle glow that pulses outward) */}
      <div
        className="tour-ping"
        style={{
          position: "fixed",
          top: sTop - 6,
          left: sLeft - 6,
          width: sW + 12,
          height: sH + 12,
          borderRadius: 14,
          border: "2px solid rgba(255,255,255,0.5)",
          zIndex: 9999,
          pointerEvents: "none",
        }}
      />

      {/* Spotlight ring — bright, solid white */}
      <div
        style={{
          position: "fixed",
          top: sTop,
          left: sLeft,
          width: sW,
          height: sH,
          borderRadius: 10,
          border: "2px solid rgba(255,255,255,0.95)",
          boxShadow:
            "0 0 0 1px rgba(255,255,255,0.15), " +
            "0 0 16px 4px rgba(255,255,255,0.18), " +
            "inset 0 0 0 1px rgba(255,255,255,0.08)",
          zIndex: 10000,
          pointerEvents: "none",
        }}
      />

      {/* Tooltip card */}
      <div
        className="tour-tooltip"
        style={{
          position: "fixed",
          top: tooltipTop,
          left: tooltipLeft,
          width: TOOLTIP_WIDTH,
          zIndex: 10001,
        }}
      >
        {/* Arrow */}
        <div style={arrowStyle} />

        <div className="rounded-xl border border-white/10 bg-zinc-900 shadow-2xl overflow-hidden">
          {/* Colored top accent */}
          <div className={`h-0.5 w-full ${currentStep.color}`} />

          <div className="p-4">
            {/* Header row */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`${currentStep.color} rounded-md p-1.5 text-white`}>
                  {currentStep.icon}
                </div>
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Step {step + 1} / {STEPS.length}
                </span>
              </div>
              <button
                onClick={dismiss}
                className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                aria-label="Skip tour"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <h3 className="text-sm font-bold mb-1.5">{currentStep.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {currentStep.description}
            </p>

            {/* Footer */}
            <div className="flex items-center gap-2">
              {/* Step dots */}
              <div className="flex gap-1.5 flex-1 items-center">
                {STEPS.map((s, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === step
                        ? `${s.color} w-5`
                        : i < step
                        ? "bg-muted-foreground/50 w-2"
                        : "bg-muted-foreground/20 w-2"
                    }`}
                  />
                ))}
              </div>
              <Button size="sm" onClick={next} className="gap-1.5 h-7 text-xs px-3">
                {step === STEPS.length - 1 ? "Done ✓" : "Next"}
                {step < STEPS.length - 1 && <ArrowRight className="size-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
