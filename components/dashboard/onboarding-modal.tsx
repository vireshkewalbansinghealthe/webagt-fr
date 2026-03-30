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
} from "lucide-react";

const STORAGE_KEY = "webagt_onboarding_seen";

const STEPS = [
  {
    step: 1,
    icon: FolderPlus,
    color: "from-blue-500 to-blue-600",
    iconBg: "bg-blue-500/10 text-blue-500",
    badge: "Step 1",
    title: "Create your first project",
    description:
      'Click the "New Project" button in the top right of the dashboard. Choose between a website or webshop, pick a template (or start from scratch), and you\'re off.',
    highlight: "Look for the + New Project button →",
    cta: null,
  },
  {
    step: 2,
    icon: Sparkles,
    color: "from-violet-500 to-violet-600",
    iconBg: "bg-violet-500/10 text-violet-500",
    badge: "Step 2",
    title: "Build with AI",
    description:
      "Once inside your project, describe what you want in the chat. The AI will generate, style and update your site in real time. Click elements in the live preview to edit them directly.",
    highlight: "Type your idea in the chat — the AI does the rest.",
    cta: null,
  },
  {
    step: 3,
    icon: Crown,
    color: "from-amber-500 to-orange-500",
    iconBg: "bg-amber-500/10 text-amber-500",
    badge: "Step 3",
    title: "Go Pro for unlimited power",
    description:
      "The free plan includes 3 projects and limited AI credits. Upgrade to Pro for unlimited projects, more AI credits, webshop publishing, custom domains and priority support.",
    highlight: "Upgrade anytime from the sidebar or billing page.",
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

    // Show only for new users who haven't seen it yet
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen) return;

    // Consider user "new" if created within the last 7 days
    const createdAt = user.createdAt;
    if (!createdAt) return;
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (ageMs > sevenDays) {
      // Existing user — mark as seen so we don't bother them
      localStorage.setItem(STORAGE_KEY, "1");
      return;
    }

    // Small delay so the dashboard loads first
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

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden gap-0 border-border/60">
        {/* Progress bar */}
        <div className="flex gap-1 p-4 pb-0">
          {STEPS.map((s, i) => (
            <div
              key={s.step}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-300",
                i <= step ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
        >
          <X className="size-4" />
        </button>

        {/* Content */}
        <div className="p-6 pt-4 space-y-5">
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
          <div className="space-y-2">
            <h2 className="text-xl font-bold leading-tight">{current.title}</h2>
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
                  Build me a modern parfum webshop with dark theme…
                </div>
              </div>
              <div className="flex items-start gap-2 flex-row-reverse">
                <div className="size-6 rounded-full bg-violet-500/20 shrink-0 flex items-center justify-center mt-0.5">
                  <Zap className="size-3 text-violet-500" />
                </div>
                <div className="bg-violet-500/10 rounded-lg px-3 py-2 text-xs text-violet-700 dark:text-violet-300 flex-1 text-right">
                  Generating your webshop with hero, products, cart…
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="rounded-xl border bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 space-y-2.5">
              {[
                { label: "Unlimited projects", free: false, pro: true },
                { label: "More AI credits", free: false, pro: true },
                { label: "Webshop + payments", free: false, pro: true },
                { label: "Custom domains", free: false, pro: true },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3 text-sm">
                  <div className="w-5 flex justify-center">
                    <X className="size-3.5 text-muted-foreground/50" />
                  </div>
                  <span className="flex-1 text-muted-foreground">{f.label}</span>
                  <div className="w-5 flex justify-center">
                    <Check className="size-3.5 text-amber-500" />
                  </div>
                </div>
              ))}
              <div className="flex justify-between text-[10px] font-semibold uppercase tracking-widest text-muted-foreground pt-1">
                <span className="w-5 text-center">Free</span>
                <span className="flex-1" />
                <span className="w-5 text-center text-amber-500">Pro</span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            {/* Step dots */}
            <div className="flex gap-1.5 flex-1">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={cn(
                    "size-1.5 rounded-full transition-all",
                    i === step ? "bg-primary w-4" : "bg-muted-foreground/30"
                  )}
                />
              ))}
            </div>

            {isLast && current.cta ? (
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
                  {current.cta}
                </Button>
              </div>
            ) : step === 0 ? (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={next}>
                  Skip intro
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
