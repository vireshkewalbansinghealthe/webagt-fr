"use client";

/**
 * components/editor/editor-tour.tsx
 *
 * 8-step spotlight tour for first-time editor visitors.
 * Shown automatically after the first AI generation completes.
 * Uses the same spotlight/tooltip pattern as the dashboard SpotlightTour.
 *
 * Steps:
 *  1. Chat panel       – talk to the AI
 *  2. Chat input       – how to send a prompt
 *  3. Visual editor    – click-to-edit text/images
 *  4. Preview / tabs   – switch between preview, code, history, shop
 *  5. History tab      – restore old versions
 *  6. Shop Manager     – product/order management (webshop only)
 *  7. Device toggle    – responsive preview
 *  8. Export           – publish & deploy
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  X,
  MessageSquare,
  Sparkles,
  Wand2,
  Monitor,
  History,
  ShoppingBag,
  Smartphone,
  Rocket,
  Layers,
} from "lucide-react";

const STORAGE_KEY = "webagt_editor_tour_seen";

interface TourStep {
  target: string;
  title: string;
  description: string;
  side: "top" | "bottom" | "left" | "right";
  icon: React.ReactNode;
  color: string;
  /** If set, only show this step when this condition is true */
  condition?: () => boolean;
}

const ALL_STEPS: TourStep[] = [
  {
    target: '[data-tour="editor-chat"]',
    title: "Je AI-assistent",
    description:
      "Dit is het chatvenster. Beschrijf hier wat je wilt bouwen of aanpassen — de AI genereert meteen de bijbehorende code en laadt je preview opnieuw.",
    side: "right",
    icon: <MessageSquare className="size-4" />,
    color: "bg-blue-500",
  },
  {
    target: '[data-tour="editor-chat-input"]',
    title: "Stuur een prompt",
    description:
      "Typ hier je instructie en druk op Enter (of de knop). Je kunt ook een afbeelding toevoegen als referentie. De AI past alleen de relevante onderdelen aan.",
    side: "top",
    icon: <Sparkles className="size-4" />,
    color: "bg-violet-500",
  },
  {
    target: '[data-tour="editor-visual-edit"]',
    title: "Visuele Editor",
    description:
      "Klik op dit icoontje en klik daarna direct op tekst in de preview om die aan te passen — zonder een prompt. Ideaal voor snelle tekst- of kleurwijzigingen.",
    side: "top",
    icon: <Wand2 className="size-4" />,
    color: "bg-pink-500",
  },
  {
    target: '[data-tour="editor-tabs"]',
    title: "Preview, Code & meer",
    description:
      "Wissel tussen de Live Preview, de broncode, de versiegeschiedenis en de Shop Manager. De preview herlaadt automatisch na iedere AI-generatie.",
    side: "bottom",
    icon: <Layers className="size-4" />,
    color: "bg-sky-500",
  },
  {
    target: '[data-tour="editor-history-tab"]',
    title: "Versiegeschiedenis",
    description:
      "Elke succesvolle generatie slaat een versie op. Open de History-tab om eerder gegenereerde versies te bekijken, te vergelijken of te herstellen.",
    side: "bottom",
    icon: <History className="size-4" />,
    color: "bg-amber-500",
  },
  {
    target: '[data-tour="editor-shop-tab"]',
    title: "Shop Manager",
    description:
      "Beheer producten, prijzen, voorraad, bestellingen en Stripe-betalingen vanuit de Shop Manager — je volledige webshop-backend in één overzicht.",
    side: "bottom",
    icon: <ShoppingBag className="size-4" />,
    color: "bg-emerald-500",
    condition: () => !!document.querySelector('[data-tour="editor-shop-tab"]'),
  },
  {
    target: '[data-tour="editor-device"]',
    title: "Responsive preview",
    description:
      "Bekijk je site op desktop, tablet of mobiel formaat. Zo zie je meteen of het ontwerp op alle schermgroottes goed uitkomt.",
    side: "bottom",
    icon: <Smartphone className="size-4" />,
    color: "bg-teal-500",
    condition: () => !!document.querySelector('[data-tour="editor-device"]'),
  },
  {
    target: '[data-tour="editor-export"]',
    title: "Publiceren & exporteren",
    description:
      "Klaar? Exporteer je code als zip of publiceer direct naar een live URL. Pro-gebruikers kunnen ook een eigen domein koppelen.",
    side: "bottom",
    icon: <Rocket className="size-4" />,
    color: "bg-rose-500",
  },
];

const PADDING = 10;
const TOOLTIP_GAP = 18;
const TOOLTIP_W = 310;
const OVERLAY = "rgba(0,0,0,0.80)";
const ARROW = 10;

export function EditorTour({
  /** Pass true when the first generation is done (isStreaming flipped to false with content) */
  triggerShow,
}: {
  triggerShow: boolean;
}) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(-1); // -1 = welcome card
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const [hasMeasured, setHasMeasured] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // On first mount: show the tour if it has never been seen, regardless of generation
  useEffect(() => {
    if (shownRef.current) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    shownRef.current = true;
    // Delay so editor UI has fully rendered
    const t = setTimeout(() => setActive(true), 1200);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fallback: also show when first generation finishes (in case mount already happened)
  useEffect(() => {
    if (!triggerShow || shownRef.current) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    shownRef.current = true;
    const t = setTimeout(() => setActive(true), 800);
    return () => clearTimeout(t);
  }, [triggerShow]);

  // Filter steps to only those whose target exists (and optional condition passes)
  const steps = ALL_STEPS.filter((s) => {
    if (s.condition && !s.condition()) return false;
    return true; // targets checked at render time
  });

  const measureTarget = useCallback(() => {
    if (!active || step < 0 || step >= steps.length) return;
    const el = document.querySelector(steps[step].target);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
    setHasMeasured(true);
  }, [active, step, steps]);

  useEffect(() => {
    if (step < 0) return;
    setHasMeasured(false);
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
    localStorage.setItem(STORAGE_KEY, "1");
  }, []);

  const next = () => {
    if (step < steps.length - 1) setStep((s) => s + 1);
    else dismiss();
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
    else setStep(-1);
  };

  if (!active || !mounted) return null;

  // ── Welcome screen ────────────────────────────────────────────────────────
  if (step === -1) {
    return createPortal(
      <>
        <style>{`
          @keyframes etour-fade-up {
            from { opacity:0; transform:translateY(18px) scale(0.96); }
            to   { opacity:1; transform:translateY(0)    scale(1); }
          }
          .etour-welcome { animation: etour-fade-up 0.38s cubic-bezier(.22,1,.36,1) both; }
        `}</style>
        <div
          style={{ position:"fixed", inset:0, zIndex:9998, background:OVERLAY, backdropFilter:"blur(3px)" }}
          className="flex items-center justify-center p-4"
        >
          <div className="etour-welcome w-full max-w-[380px] rounded-2xl border border-white/10 bg-popover shadow-2xl overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-primary via-violet-500 to-pink-500" />
            <div className="p-8 text-center">
              <div className="mx-auto mb-5 size-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Rocket className="size-8 text-primary" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-1.5">
                Je project is gegenereerd!
              </p>
              <h2 className="text-2xl font-bold leading-tight mb-3">
                Welkom in de Editor 🎉
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mb-8">
                Wil je een snelle rondleiding van <strong>{steps.length} stappen</strong> zodat je weet wat alles doet? Duurt minder dan een minuut.
              </p>
              <div className="flex flex-col gap-2.5">
                <Button className="w-full gap-2 h-11 text-base" onClick={() => setStep(0)}>
                  <Sparkles className="size-4" />
                  Ja, laat me zien!
                  <ArrowRight className="size-4" />
                </Button>
                <button
                  onClick={dismiss}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                >
                  Overslaan
                </button>
              </div>
            </div>
          </div>
        </div>
      </>,
      document.body
    );
  }

  // ── Spotlight steps ───────────────────────────────────────────────────────
  if (!hasMeasured) return null;

  if (!rect) {
    // Target not in DOM — skip to next
    if (step < steps.length - 1) {
      setTimeout(() => setStep((s) => s + 1), 100);
    } else {
      dismiss();
    }
    return null;
  }

  const currentStep = steps[step];

  // Step index out of range (steps may be filtered) — skip to end
  if (!currentStep) {
    dismiss();
    return null;
  }

  const { side } = currentStep;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const sTop    = rect.top    - PADDING;
  const sLeft   = rect.left   - PADDING;
  const sRight  = rect.right  + PADDING;
  const sBottom = rect.bottom + PADDING;
  const sW      = sRight - sLeft;
  const sH      = sBottom - sTop;

  let tooltipTop  = 0;
  let tooltipLeft = 0;
  let arrowStyle: React.CSSProperties = {};

  if (side === "bottom") {
    tooltipTop  = sBottom + TOOLTIP_GAP;
    tooltipLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 16));
    const arrowX = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipLeft - ARROW, TOOLTIP_W - 32));
    arrowStyle = { position:"absolute", top:-ARROW, left:arrowX, width:0, height:0,
      borderLeft:`${ARROW}px solid transparent`, borderRight:`${ARROW}px solid transparent`,
      borderBottom:`${ARROW}px solid rgba(255,255,255,0.12)` };
  } else if (side === "top") {
    tooltipTop  = Math.max(16, sTop - TOOLTIP_GAP - 220);
    tooltipLeft = Math.max(16, Math.min(rect.left + rect.width / 2 - TOOLTIP_W / 2, vw - TOOLTIP_W - 16));
    const arrowX = Math.max(16, Math.min(rect.left + rect.width / 2 - tooltipLeft - ARROW, TOOLTIP_W - 32));
    arrowStyle = { position:"absolute", bottom:-ARROW, left:arrowX, width:0, height:0,
      borderLeft:`${ARROW}px solid transparent`, borderRight:`${ARROW}px solid transparent`,
      borderTop:`${ARROW}px solid rgba(255,255,255,0.12)` };
  } else if (side === "right") {
    tooltipLeft = Math.min(sRight + TOOLTIP_GAP, vw - TOOLTIP_W - 16);
    tooltipTop  = Math.max(16, Math.min(rect.top + rect.height / 2 - 110, vh - 240));
    const arrowY = Math.max(16, rect.top + rect.height / 2 - tooltipTop - ARROW);
    arrowStyle = { position:"absolute", left:-ARROW, top:arrowY, width:0, height:0,
      borderTop:`${ARROW}px solid transparent`, borderBottom:`${ARROW}px solid transparent`,
      borderRight:`${ARROW}px solid rgba(255,255,255,0.12)` };
  } else {
    tooltipLeft = Math.max(16, sLeft - TOOLTIP_GAP - TOOLTIP_W);
    tooltipTop  = Math.max(16, Math.min(rect.top + rect.height / 2 - 110, vh - 240));
    const arrowY = Math.max(16, rect.top + rect.height / 2 - tooltipTop - ARROW);
    arrowStyle = { position:"absolute", right:-ARROW, top:arrowY, width:0, height:0,
      borderTop:`${ARROW}px solid transparent`, borderBottom:`${ARROW}px solid transparent`,
      borderLeft:`${ARROW}px solid rgba(255,255,255,0.12)` };
  }

  return createPortal(
    <>
      <style>{`
        @keyframes etour-ping {
          0%   { transform:scale(1);    opacity:0.5; }
          100% { transform:scale(1.16); opacity:0;   }
        }
        @keyframes etour-slide {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .etour-card { animation: etour-slide 0.22s cubic-bezier(.22,1,.36,1) both; }
        .etour-ping { animation: etour-ping 1.7s ease-out infinite; }
      `}</style>

      {/* 4-panel dark overlay */}
      <div style={{ position:"fixed", top:0, left:0, right:0, height:sTop,      background:OVERLAY, zIndex:9998 }} />
      <div style={{ position:"fixed", top:sBottom, left:0, right:0, bottom:0,   background:OVERLAY, zIndex:9998 }} />
      <div style={{ position:"fixed", top:sTop, left:0,      width:sLeft, height:sH, background:OVERLAY, zIndex:9998 }} />
      <div style={{ position:"fixed", top:sTop, left:sRight, right:0,    height:sH, background:OVERLAY, zIndex:9998 }} />

      {/* Pulsing ring */}
      <div className="etour-ping" style={{
        position:"fixed", top:sTop-6, left:sLeft-6, width:sW+12, height:sH+12,
        borderRadius:14, border:"2px solid rgba(255,255,255,0.45)", zIndex:9999, pointerEvents:"none"
      }} />

      {/* Spotlight ring */}
      <div style={{
        position:"fixed", top:sTop, left:sLeft, width:sW, height:sH,
        borderRadius:10, border:"2px solid rgba(255,255,255,0.9)",
        boxShadow:"0 0 0 1px rgba(255,255,255,0.12), 0 0 18px 4px rgba(255,255,255,0.14)",
        zIndex:10000, pointerEvents:"none"
      }} />

      {/* Tooltip */}
      <div className="etour-card" style={{
        position:"fixed", top:tooltipTop, left:tooltipLeft, width:TOOLTIP_W, zIndex:10001
      }}>
        <div style={arrowStyle} />
        <div className="rounded-xl border border-white/15 bg-zinc-900 shadow-2xl overflow-hidden">
          <div className={cn("h-1 w-full", currentStep.color)} />
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={cn("rounded-md p-1.5 text-white", currentStep.color)}>
                  {currentStep.icon}
                </div>
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                  Stap {step + 1} / {steps.length}
                </span>
              </div>
              <button
                onClick={dismiss}
                className="rounded-md p-1 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Tour sluiten"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <h3 className="text-sm font-bold mb-1.5 text-white">{currentStep.title}</h3>
            <p className="text-xs text-white/60 leading-relaxed mb-4">
              {currentStep.description}
            </p>

            {/* Footer */}
            <div className="flex items-center gap-2">
              {/* Progress dots */}
              <div className="flex gap-1.5 flex-1 items-center">
                {steps.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                      i === step
                        ? cn(s.color, "w-5")
                        : i < step
                        ? "bg-white/40 w-2"
                        : "bg-white/20 w-2"
                    )}
                  />
                ))}
              </div>
              {step > 0 && (
                <button
                  onClick={prev}
                  className="flex items-center justify-center size-7 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors text-sm"
                >
                  ←
                </button>
              )}
              <Button size="sm" onClick={next} className="gap-1.5 h-7 text-xs px-3 bg-white text-zinc-900 hover:bg-white/90">
                {step === steps.length - 1 ? "Klaar ✓" : "Volgende"}
                {step < steps.length - 1 && <ArrowRight className="size-3" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
