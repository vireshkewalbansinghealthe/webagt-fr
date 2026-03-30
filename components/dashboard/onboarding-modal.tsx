"use client";

import { useState, useEffect } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createApiClient } from "@/lib/api-client";
import {
  Sparkles,
  FolderPlus,
  Zap,
  Crown,
  ArrowRight,
  Check,
  X,
  Send,
  MousePointer2,
} from "lucide-react";

const STEPS = [
  {
    step: 1,
    icon: FolderPlus,
    iconBg: "bg-blue-500/10 text-blue-500",
    badge: "Step 1",
    title: "Create your first project",
    description:
      'Click the "New Project" button in the top right of the dashboard. Choose a website or webshop, pick a template (or start from scratch), and you\'re off!',
    highlight: 'Look for the "+ New Project" button in the top right →',
    cta: null,
  },
  {
    step: 2,
    icon: Sparkles,
    iconBg: "bg-violet-500/10 text-violet-500",
    badge: "Step 2",
    title: "Build with AI",
    description:
      "Inside your project, describe what you want in the chat. The AI generates and updates your site in real time. Click any element in the live preview to edit it directly — no code needed.",
    highlight: "Type your idea in the chat — the AI does the rest.",
    cta: null,
  },
  {
    step: 3,
    icon: Crown,
    iconBg: "bg-amber-500/10 text-amber-500",
    badge: "Step 3",
    title: "Go Pro for unlimited power",
    description:
      "The free plan gives you 3 projects and limited AI credits. Upgrade to Pro for unlimited projects, more AI credits, webshop publishing, custom domains and priority support.",
    highlight: "Upgrade anytime — from the sidebar or billing page.",
    cta: "Upgrade to Pro",
  },
];

interface OnboardingModalProps {
  onCreateProject?: () => void;
}

export function OnboardingModal({ onCreateProject }: OnboardingModalProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    // Check KV (server-side) so the state persists across all devices/browsers
    const client = createApiClient(getToken);
    client.credits.getOnboardingSeen().then(({ seen }) => {
      if (!seen) {
        const t = setTimeout(() => setOpen(true), 800);
        return () => clearTimeout(t);
      }
    }).catch(() => {
      // If API fails, fall back to localStorage
      const seen = localStorage.getItem("webagt_onboarding_seen");
      if (!seen) setTimeout(() => setOpen(true), 800);
    });
  }, [isLoaded, isSignedIn, user, getToken]);

  const dismiss = () => {
    setOpen(false);
    // Mark seen in KV (persists across devices)
    const client = createApiClient(getToken);
    client.credits.markOnboardingSeen().catch(() => {
      // Fallback to localStorage if API call fails
      localStorage.setItem("webagt_onboarding_seen", "1");
    });
  };

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const firstName = user?.firstName || user?.username || "there";
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 border-border/60">

        {/* ── Welcome header ── */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-8 pt-7 pb-6 border-b border-border/50">
          <div className="flex items-start gap-4">
            <div className="text-4xl leading-none">👋</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
                Welcome to WebAGT
              </p>
              <h1 className="text-2xl font-bold leading-snug">
                Hey {firstName}, great to have you here!
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                Let&apos;s get you started in 3 quick steps — it only takes a minute. 🚀
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2 mt-5">
            {STEPS.map((s, i) => (
              <button
                key={s.step}
                onClick={() => setStep(i)}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-all duration-300",
                  i <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* ── Step content ── */}
        <div className="px-8 py-7 space-y-5">

          {/* Icon + badge */}
          <div className="flex items-center gap-3">
            <div className={cn("p-3 rounded-xl", current.iconBg)}>
              <Icon className="size-5" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {current.badge} of {STEPS.length}
            </span>
          </div>

          {/* Title + description */}
          <div className="space-y-2">
            <h2 className="text-xl font-bold leading-tight">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Step-specific visual */}
          {step === 0 && <Step1Visual />}
          {step === 1 && <Step2Visual />}
          {step === 2 && <Step3Visual />}

          {/* Highlight pill */}
          <div className="flex items-center gap-2 rounded-lg border border-yellow-400/40 bg-yellow-400/10 px-4 py-3 text-sm font-medium text-yellow-700 dark:text-yellow-300">
            <MousePointer2 className="size-3.5 shrink-0" />
            {current.highlight}
          </div>

          {/* ── Actions ── */}
          <div className="flex items-center gap-2 pt-1">
            {/* Step dots */}
            <div className="flex gap-1.5 flex-1">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-200",
                    i === step ? "bg-primary w-5" : "bg-muted-foreground/30 w-2"
                  )}
                />
              ))}
            </div>

            {isLast ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={dismiss}>
                  Maybe later
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-sm"
                  onClick={() => {
                    dismiss();
                    window.location.href = "/pricing";
                  }}
                >
                  <Crown className="size-3.5" />
                  Upgrade to Pro
                </Button>
              </div>
            ) : step === 0 ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={next}>
                  Skip
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    next();
                    onCreateProject?.();
                  }}
                >
                  <FolderPlus className="size-3.5" />
                  Create project
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ) : (
              <Button size="sm" className="gap-1.5" onClick={next}>
                Next
                <ArrowRight className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Step visuals ── */

function Step1Visual() {
  return (
    <div className="rounded-xl border bg-muted/20 p-4 space-y-3">
      {/* Fake dashboard header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-muted-foreground/30" />
          <div className="h-2 w-24 rounded bg-muted-foreground/20" />
        </div>
        {/* Highlighted button */}
        <div className="relative">
          {/* Yellow glow ring */}
          <div className="absolute -inset-1.5 rounded-xl bg-yellow-400/30 animate-pulse" />
          <div className="absolute -inset-1.5 rounded-xl border-2 border-yellow-400 animate-pulse" />
          <div className="relative flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-lg shadow-sm z-10">
            <FolderPlus className="size-3.5" />
            New Project
          </div>
        </div>
      </div>
      {/* Fake project grid */}
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-muted/40 h-14 flex items-center justify-center">
            <div className="size-4 rounded bg-muted-foreground/20" />
          </div>
        ))}
      </div>
      <p className="text-[11px] text-center text-yellow-600 dark:text-yellow-400 font-semibold flex items-center justify-center gap-1">
        <MousePointer2 className="size-3" />
        Click "New Project" to get started
      </p>
    </div>
  );
}

function Step2Visual() {
  return (
    <div className="rounded-xl border bg-muted/20 overflow-hidden">
      {/* Chat messages */}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2">
          <div className="size-6 rounded-full bg-primary/20 shrink-0 flex items-center justify-center mt-0.5">
            <Sparkles className="size-3 text-primary" />
          </div>
          <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground flex-1">
            Build me a modern parfum webshop with a dark luxury theme…
          </div>
        </div>
        <div className="flex items-start gap-2 flex-row-reverse">
          <div className="size-6 rounded-full bg-violet-500/20 shrink-0 flex items-center justify-center mt-0.5">
            <Zap className="size-3 text-violet-500" />
          </div>
          <div className="bg-violet-500/10 rounded-lg px-3 py-2 text-xs text-violet-700 dark:text-violet-300 flex-1 text-right">
            ✨ Generating your webshop — hero, products, cart…
          </div>
        </div>
      </div>
      {/* Highlighted chat input */}
      <div className="relative border-t border-border/50 p-3">
        <div className="absolute -inset-0.5 bg-yellow-400/20 rounded-b-xl animate-pulse" />
        <div className="absolute inset-3 rounded-lg border-2 border-yellow-400 animate-pulse pointer-events-none" />
        <div className="relative flex items-center gap-2 bg-background rounded-lg border border-border px-3 py-2">
          <span className="text-xs text-muted-foreground flex-1">Describe what you want to build…</span>
          <Send className="size-3.5 text-muted-foreground" />
        </div>
        <p className="text-[11px] text-center text-yellow-600 dark:text-yellow-400 font-semibold mt-2 flex items-center justify-center gap-1">
          <MousePointer2 className="size-3" />
          Type your idea here and press Enter
        </p>
      </div>
    </div>
  );
}

function Step3Visual() {
  const features = [
    "Unlimited projects",
    "More AI credits",
    "Webshop + payments",
    "Custom domains",
    "Priority support",
  ];

  return (
    <div className="rounded-xl border bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5 space-y-3">
      <div className="flex justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pb-1 border-b border-border/40">
        <span>Free</span>
        <span className="text-amber-500">Pro ✦</span>
      </div>
      {features.map((f) => (
        <div key={f} className="flex items-center gap-3 text-sm">
          <X className="size-3.5 text-muted-foreground/40 shrink-0" />
          <span className="flex-1 text-muted-foreground">{f}</span>
          <Check className="size-3.5 text-amber-500 shrink-0" />
        </div>
      ))}
      {/* Highlighted upgrade button */}
      <div className="relative pt-2">
        <div className="absolute -inset-1 rounded-xl bg-yellow-400/25 animate-pulse" />
        <div className="absolute -inset-1 rounded-xl border-2 border-yellow-400 animate-pulse" />
        <div className="relative flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-semibold py-2.5 rounded-lg shadow-sm cursor-pointer z-10">
          <Crown className="size-4" />
          Upgrade to Pro — unlock everything
        </div>
        <p className="text-[11px] text-center text-yellow-600 dark:text-yellow-400 font-semibold mt-2 flex items-center justify-center gap-1">
          <MousePointer2 className="size-3" />
          Click to upgrade from the sidebar anytime
        </p>
      </div>
    </div>
  );
}
