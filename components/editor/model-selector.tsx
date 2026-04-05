/**
 * components/editor/model-selector.tsx
 *
 * Minimal icon-toggle model selector.
 * Renders as a small muted icon showing the current tier.
 * Click opens a compact floating list of models.
 *
 * Used by: components/editor/chat-panel.tsx
 */

"use client";

import { useState } from "react";
import { Zap, Sparkles, Lock, Check, ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { MODELS, TIER_ORDER, getModelById } from "@/lib/models";
import type { ModelInfo } from "@/lib/models";

export interface ModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  userPlan: "free" | "pro";
  disabled?: boolean;
}

function TierIcon({ tier, className }: { tier: "lite" | "premium"; className?: string }) {
  return tier === "lite"
    ? <Zap className={className} />
    : <Sparkles className={className} />;
}

export function ModelSelector({
  selectedModelId,
  onModelChange,
  userPlan,
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedModel = getModelById(selectedModelId);
  const tier = selectedModel?.tier ?? "lite";

  function handleSelect(model: ModelInfo) {
    if (model.tier === "premium" && userPlan === "free") return;
    onModelChange(model.id);
    setOpen(false);
  }

  const groupedTiers = TIER_ORDER.map((t) => ({
    tier: t,
    models: MODELS.filter((m) => m.tier === t),
  }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors",
            "text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/50",
            open && "text-muted-foreground bg-accent/50",
            "disabled:pointer-events-none disabled:opacity-30"
          )}
        >
          <TierIcon tier={tier} className="size-3 shrink-0" />
          <span className="text-[11px] leading-none">
            {selectedModel?.name ?? "Choose AI model"}
          </span>
          <ChevronDown className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[220px] p-1 shadow-lg"
        align="start"
        sideOffset={6}
      >
        <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
          Choose AI model
        </p>
        <div className="mx-1 mb-1 border-t border-border/30" />
        {groupedTiers.map((group, gIdx) => (
          <div key={group.tier}>
            {gIdx > 0 && (
              <div className="mx-1 my-1 border-t border-border/40" />
            )}

            {group.models.map((model) => {
              const isSelected = model.id === selectedModelId;
              const isLocked = model.tier === "premium" && userPlan === "free";

              return (
                <button
                  key={model.id}
                  onClick={() => handleSelect(model)}
                  disabled={isLocked}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left transition-colors",
                    "hover:bg-accent/60",
                    isSelected && "bg-accent/40",
                    isLocked && "cursor-not-allowed opacity-35"
                  )}
                >
                  <TierIcon
                    tier={model.tier}
                    className={cn(
                      "size-3 shrink-0",
                      model.tier === "lite"
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground/50"
                    )}
                  />

                  <span
                    className={cn(
                      "flex-1 truncate text-xs",
                      isSelected ? "font-medium text-foreground" : "text-foreground/75"
                    )}
                  >
                    {model.name}
                  </span>

                  {model.savingLabel && !isLocked && (
                    <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-medium bg-emerald-500/15 text-emerald-500">
                      {model.savingLabel}
                    </span>
                  )}

                  {isSelected && (
                    <Check className="size-3 shrink-0 text-foreground/50" />
                  )}
                  {isLocked && (
                    <Lock className="size-3 shrink-0 text-muted-foreground/40" />
                  )}
                </button>
              );
            })}
        </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}
