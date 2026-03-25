"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "webagt_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function accept() {
    try { localStorage.setItem(STORAGE_KEY, "accepted"); } catch {}
    setVisible(false);
  }

  function decline() {
    try { localStorage.setItem(STORAGE_KEY, "declined"); } catch {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-[9999] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 animate-fade-in",
      )}
    >
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center sm:gap-4">
        {/* Icon */}
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Cookie className="size-4 text-primary" />
        </div>

        {/* Text */}
        <p className="flex-1 text-sm text-muted-foreground leading-snug">
          We use cookies to improve your experience.{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Learn more
          </a>
        </p>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={decline}
            className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            Decline
          </Button>
          <Button
            size="sm"
            onClick={accept}
            className="h-8 px-4 text-xs"
          >
            Accept
          </Button>
        </div>

        {/* Close */}
        <button
          onClick={decline}
          className="absolute right-3 top-3 rounded-md p-0.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors sm:hidden"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
