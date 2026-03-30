"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  FolderPlus,
  Zap,
  Crown,
  ArrowRight,
  Check,
  X,
  PartyPopper,
} from "lucide-react";

const STORAGE_KEY = "webagt_onboarding_seen";

const STEPS = [
  {
    step: 1,
    icon: FolderPlus,
    iconBg: "bg-blue-500/10 text-blue-500",
    badge: "Step 1",
    title: "Create your first project",
    description:
      'Click the "New Project" button in the top right of the dashboard. Choose a website or webshop, pick a template (or start from scratch), and you\'re off!',
    highlight: "Look for the + New Project button →",
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
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen) return;

    const createdAt = user.createdAt;
    if (!createdAt) return;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (ageMs > sevenDays) {
      localStorage.setItem(STORAGE_KEY, "1");
      return;
    }

    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [isLoaded, isSignedIn, user]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setOpen(false);
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
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 border-border/60">

        {/* ── Welcome header ── */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 border-b border-border/50">
          <div className="flex items-start gap-3">
            <div className="text-3xl leading-none">👋</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1">
                Welcome to WebAGT
              </p>
              <h1 className="text-xl font-bold leading-snug">
                Hey {firstName}, great to have you here!
              </h1>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Let&apos;s get you started in 3 quick steps — it only takes a minute. 🚀
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-1.5 mt-4">
            {STEPS.map((s, i) => (
              <button
                key={s.step}
                onClick={() => setStep(i)}
                className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-300",
                  i <= step ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        {/* ── Step content ── */}
        <div className="p-6 space-y-4">

          {/* Icon + badge */}
          <div className="flex items-center gap-3">
            <div className={cn("p-2.5 rounded-xl", current.iconBg)}>
              <Icon className="size-5" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {current.badge} of {STEPS.length}
            </span>
          </div>

          {/* Title + description */}
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold leading-tight">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>

          {/* Highlight pill */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm font-medium">
            <Zap className="size-3.5 text-primary shrink-0" />
            {current.highlight}
          </div>

          {/* Step-specific visual */}
          {step === 0 && (
            <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderPlus className="size-4" />
                <span>My Projects</span>
              </div>
              <div className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm animate-pulse">
                <span>+</span> New Project
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-2">
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
          )}

          {step === 2 && (
            <div className="rounded-xl border bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 space-y-2.5">
              <div className="flex justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pb-1">
                <span>Free</span>
                <span className="text-amber-500">Pro ✦</span>
              </div>
              {[
                "Unlimited projects",
                "More AI credits",
                "Webshop + payments",
                "Custom domains",
                "Priority support",
              ].map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm">
                  <X className="size-3.5 text-muted-foreground/40 shrink-0" />
                  <span className="flex-1 text-muted-foreground">{f}</span>
                  <Check className="size-3.5 text-amber-500 shrink-0" />
                </div>
              ))}
            </div>
          )}

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
                    i === step ? "bg-primary w-4" : "bg-muted-foreground/30 w-1.5"
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
