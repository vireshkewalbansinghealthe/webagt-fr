/**
 * components/editor/model-selector.tsx
 *
 * Dropdown selector for choosing which AI model generates code.
 * Shows all 8 models grouped by provider (Anthropic, OpenAI, Google, DeepSeek)
 * with speed badges, quality badges, credit cost, and lock icons.
 *
 * ┌────────────────────────────────────────────────────┐
 * │  ⚡ Claude Sonnet 4.5                            ▼  │
 * └────────────────────────────────────────────────────┘
 *                     │
 *                     ▼
 * ┌────────────────────────────────────────────────────┐
 * │  ANTHROPIC                                          │
 * │  ✓ Claude Sonnet 4.5    ⚡ Medium  ★★★  2cr        │
 * │    Claude Haiku 3.5     ⚡⚡ Fast   ★★   1cr        │
 * │  ───────────────────────────────────────            │
 * │  OPENAI                                             │
 * │    GPT-4o               ⚡ Medium  ★★★  2cr  🔒     │
 * │    ...                                              │
 * └────────────────────────────────────────────────────┘
 *
 * Used by: components/editor/chat-panel.tsx
 */

"use client";

import { useState } from "react";
import { ChevronDown, Zap, Star, Lock, Check, ImageOff } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MODELS,
  PROVIDER_LABELS,
  PROVIDER_ORDER,
  getModelById,
  getSpeedBolts,
  getSpeedLabel,
  getQualityStars,
  getQualityLabel,
} from "@/lib/models";
import type { ModelInfo } from "@/lib/models";

/**
 * Props for the ModelSelector component.
 *
 * @property selectedModelId - Currently selected model ID
 * @property onModelChange - Callback when the user selects a different model
 * @property userPlan - The user's current plan ("free" or "pro")
 * @property disabled - Whether the selector is disabled (e.g., during streaming)
 */
export interface ModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  userPlan: "free" | "pro";
  disabled?: boolean;
}

/**
 * Renders speed indicator lightning bolts.
 * More bolts = faster model.
 *
 * @param count - Number of lightning bolts (1-3)
 */
function SpeedIndicator({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0">
      {Array.from({ length: count }).map((_, i) => (
        <Zap key={i} className="size-3 fill-yellow-500 text-yellow-500" />
      ))}
    </span>
  );
}

/**
 * Renders quality indicator stars.
 * More stars = higher quality output.
 *
 * @param count - Number of stars (2-3)
 */
function QualityIndicator({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-0">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="size-3 fill-orange-400 text-orange-400" />
      ))}
    </span>
  );
}

/**
 * ModelSelector is a dropdown that lets users choose their AI model.
 * Models are grouped by provider with section headers.
 * Premium models are locked for free users with a lock icon.
 *
 * @param selectedModelId - ID of the currently selected model
 * @param onModelChange - Called when user picks a new model
 * @param userPlan - "free" or "pro" — controls premium model access
 * @param disabled - Disables the entire selector
 */
export function ModelSelector({
  selectedModelId,
  onModelChange,
  userPlan,
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedModel = getModelById(selectedModelId);
  const displayName = selectedModel?.name ?? "Select model";

  /**
   * Groups models by provider in the specified order.
   * Returns an array of [providerKey, models[]] tuples.
   */
  const groupedModels = PROVIDER_ORDER.map((provider) => ({
    provider,
    label: PROVIDER_LABELS[provider],
    models: MODELS.filter((m) => m.provider === provider),
  }));

  /**
   * Handles model selection. If the model is premium and user is free,
   * don't select it (the lock icon is shown instead).
   */
  function handleSelect(model: ModelInfo) {
    const isLocked = model.tier === "premium" && userPlan === "free";
    if (isLocked) return;

    onModelChange(model.id);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Trigger button — shows selected model name */}
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "h-7 gap-1.5 px-2.5 text-xs font-medium text-muted-foreground",
            "hover:text-foreground hover:bg-secondary/80",
            open && "bg-secondary/80 text-foreground"
          )}
        >
          {selectedModel && (
            <SpeedIndicator count={getSpeedBolts(selectedModel.speed)} />
          )}
          <span className="max-w-[120px] truncate sm:max-w-[160px]">
            {displayName}
          </span>
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-150",
              open && "rotate-180"
            )}
          />
        </Button>
      </PopoverTrigger>

      {/* Dropdown content — grouped by provider */}
      <PopoverContent
        className="w-[320px] p-0"
        align="start"
        sideOffset={4}
      >
        <div className="max-h-[400px] overflow-y-auto py-1">
          {groupedModels.map((group, groupIndex) => (
            <div key={group.provider}>
              {/* Provider section header */}
              <div className="px-3 py-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </span>
              </div>

              {/* Models in this provider group */}
              {group.models.map((model) => {
                const isSelected = model.id === selectedModelId;
                const isLocked =
                  model.tier === "premium" && userPlan === "free";

                return (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model)}
                    disabled={isLocked}
                    className={cn(
                      "flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-left transition-colors duration-100",
                      isSelected
                        ? "bg-secondary/60"
                        : "hover:bg-secondary/40",
                      isLocked && "opacity-60 cursor-not-allowed"
                    )}
                  >
                    {/* Check mark or empty space */}
                    <div className="flex size-4 shrink-0 items-center justify-center pt-0.5">
                      {isSelected && (
                        <Check className="size-3.5 text-primary" />
                      )}
                    </div>

                    {/* Model info */}
                    <div className="flex-1 min-w-0">
                      {/* Name + lock icon */}
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-sm font-medium",
                            isSelected && "text-primary"
                          )}
                        >
                          {model.name}
                        </span>
                        {isLocked && (
                          <Badge
                            variant="outline"
                            className="h-4 gap-0.5 px-1 py-0 text-[10px]"
                          >
                            <Lock className="size-2.5" />
                            Pro
                          </Badge>
                        )}
                        {!model.supportsVision && (
                          <Badge
                            variant="outline"
                            className="h-4 gap-0.5 px-1 py-0 text-[10px] text-muted-foreground"
                          >
                            <ImageOff className="size-2.5" />
                            No vision
                          </Badge>
                        )}
                      </div>

                      {/* Badges row: speed + quality + credits */}
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-0.5">
                          <SpeedIndicator
                            count={getSpeedBolts(model.speed)}
                          />
                          <span className="ml-0.5">
                            {getSpeedLabel(model.speed)}
                          </span>
                        </span>

                        <span className="text-border">·</span>

                        <span className="inline-flex items-center gap-0.5">
                          <QualityIndicator
                            count={getQualityStars(model.quality)}
                          />
                          <span className="ml-0.5">
                            {getQualityLabel(model.quality)}
                          </span>
                        </span>

                        <span className="text-border">·</span>

                        <span>
                          {model.creditCost}{" "}
                          {model.creditCost === 1 ? "credit" : "credits"}
                        </span>
                      </div>

                      {/* Description — shown below badges */}
                      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground/70">
                        {model.description}
                      </p>
                    </div>
                  </button>
                );
              })}

              {/* Separator between provider groups (except last) */}
              {groupIndex < groupedModels.length - 1 && (
                <div className="mx-3 my-1 border-t border-border" />
              )}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
