/**
 * components/editor/model-selector.tsx
 *
 * Simplified model selector showing two tiers:
 *   • Lite    — DeepSeek models (fast & affordable)
 *   • Premium — Anthropic models (high quality)
 *
 * Used by: components/editor/chat-panel.tsx
 */

"use client";

import { useState } from "react";
import { ChevronDown, Zap, Lock, Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MODELS, TIER_LABELS, TIER_ORDER, getModelById } from "@/lib/models";
import type { ModelInfo } from "@/lib/models";

export interface ModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  userPlan: "free" | "pro";
  disabled?: boolean;
}

const TIER_DESCRIPTION: Record<string, string> = {
  lite: "Fast & affordable",
  premium: "Highest quality",
};

const TIER_COLOR: Record<string, string> = {
  lite: "text-blue-500",
  premium: "text-amber-500",
};

function SpeedDots({ speed }: { speed: ModelInfo["speed"] }) {
  const count = speed === "very-fast" ? 3 : speed === "fast" ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <Zap
          key={i}
          className={cn(
            "size-2.5",
            i < count
              ? "fill-yellow-400 text-yellow-400"
              : "fill-muted text-muted stroke-muted"
          )}
        />
      ))}
    </span>
  );
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
    label: TIER_LABELS[t],
    description: TIER_DESCRIPTION[t],
    models: MODELS.filter((m) => m.tier === t),
  }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-7 gap-1.5 px-2.5 text-xs font-medium",
            "text-muted-foreground hover:text-foreground hover:bg-secondary/80",
            open && "bg-secondary/80 text-foreground"
          )}
        >
          {/* Tier badge */}
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              tier === "lite"
                ? "bg-blue-500/10 text-blue-500"
                : "bg-amber-500/10 text-amber-500"
            )}
          >
            {TIER_LABELS[tier]}
          </span>
          <span className="max-w-[120px] truncate sm:max-w-[160px]">
            {selectedModel?.name ?? "Select model"}
          </span>
          <ChevronDown
            className={cn(
              "size-3 shrink-0 transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[300px] p-0" align="start" sideOffset={4}>
        <div className="max-h-[420px] overflow-y-auto py-1.5">
          {groupedTiers.map((group, gIdx) => (
            <div key={group.tier}>
              {/* Tier header */}
              <div className="flex items-baseline gap-2 px-3 py-1.5">
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    TIER_COLOR[group.tier]
                  )}
                >
                  {group.label}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {group.description}
                </span>
              </div>

              {/* Models in tier */}
              {group.models.map((model) => {
                const isSelected = model.id === selectedModelId;
                const isLocked = model.tier === "premium" && userPlan === "free";

                return (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model)}
                    disabled={isLocked}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors",
                      isSelected ? "bg-secondary/60" : "hover:bg-secondary/40",
                      isLocked && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {/* Check / empty */}
                    <div className="flex size-4 shrink-0 items-center justify-center">
                      {isSelected && <Check className="size-3.5 text-primary" />}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-medium truncate",
                            isSelected && "text-primary"
                          )}
                        >
                          {model.name}
                        </span>
                        {isLocked && (
                          <Badge
                            variant="outline"
                            className="h-4 shrink-0 gap-0.5 px-1 py-0 text-[10px]"
                          >
                            <Lock className="size-2.5" />
                            Pro
                          </Badge>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <SpeedDots speed={model.speed} />
                        <span className="text-border">·</span>
                        <span>
                          {model.creditCost}{" "}
                          {model.creditCost === 1 ? "credit" : "credits"}
                        </span>
                        <span className="text-border">·</span>
                        <span className="truncate">{model.description}</span>
                      </div>
                    </div>
                  </button>
                );
              })}

              {/* Divider */}
              {gIdx < groupedTiers.length - 1 && (
                <div className="mx-3 my-1 border-t border-border/60" />
              )}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border/60 px-3 py-2 text-[10px] text-muted-foreground/60">
          Lite models are free to use · Premium requires a Pro plan
        </div>
      </PopoverContent>
    </Popover>
  );
}
