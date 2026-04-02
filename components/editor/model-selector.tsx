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
import { Zap, Sparkles, Lock, Check } from "lucide-react";
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
          title={selectedModel?.name ?? "Select model"}
          className={cn(
            "flex size-6 items-center justify-center rounded transition-colors",
            "text-muted-foreground/40 hover:text-muted-foreground/80 hover:bg-accent/50",
            open && "text-muted-foreground/80 bg-accent/50",
            "disabled:pointer-events-none disabled:opacity-30"
          )}
        >
          <TierIcon tier={tier} className="size-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-[200px] p-1 shadow-lg"
        align="start"
        sideOffset={6}
      >
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
