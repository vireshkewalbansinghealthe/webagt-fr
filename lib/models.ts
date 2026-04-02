/**
 * lib/models.ts
 *
 * Frontend model registry for the model selector UI.
 * Two tiers: Lite (DeepSeek — fast & affordable) and Premium (Anthropic — high quality).
 *
 * Used by: components/editor/model-selector.tsx
 */

export interface ModelInfo {
  id: string;
  name: string;
  provider: "anthropic" | "deepseek";
  tier: "lite" | "premium";
  speed: "very-fast" | "fast" | "medium";
  quality: "good" | "high";
  creditCost: number;
  description: string;
  supportsVision: boolean;
}

export const MODELS: ModelInfo[] = [
  // --- Lite (DeepSeek) ---
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "deepseek",
    tier: "lite",
    speed: "fast",
    quality: "good",
    creditCost: 1,
    description: "Cost-effective and capable. Great for everyday coding tasks.",
    supportsVision: false,
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    tier: "lite",
    speed: "medium",
    quality: "high",
    creditCost: 1,
    description: "Reasoning model. Excellent for complex logic and debugging.",
    supportsVision: false,
  },

  // --- Premium (Anthropic) ---
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    tier: "premium",
    speed: "very-fast",
    quality: "good",
    creditCost: 1,
    description: "Fast and capable. Great for quick iterations and simple changes.",
    supportsVision: true,
  },
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    tier: "premium",
    speed: "fast",
    quality: "high",
    creditCost: 2,
    description: "The best combination of speed and intelligence. Ideal for complex features.",
    supportsVision: true,
  },
  {
    id: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    tier: "premium",
    speed: "medium",
    quality: "high",
    creditCost: 4,
    description: "The most intelligent model for building agents and coding.",
    supportsVision: true,
  },
];

export const DEFAULT_MODEL_ID = "deepseek-v3";

export const TIER_LABELS: Record<string, string> = {
  lite: "Lite",
  premium: "Premium",
};

export const TIER_ORDER: Array<"lite" | "premium"> = ["lite", "premium"];

export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export function getSpeedLabel(speed: ModelInfo["speed"]): string {
  switch (speed) {
    case "very-fast": return "Fastest";
    case "fast":      return "Fast";
    case "medium":    return "Medium";
  }
}

export function getSpeedBolts(speed: ModelInfo["speed"]): number {
  switch (speed) {
    case "very-fast": return 3;
    case "fast":      return 2;
    case "medium":    return 1;
  }
}

export function getQualityLabel(quality: ModelInfo["quality"]): string {
  switch (quality) {
    case "high": return "High";
    case "good": return "Good";
  }
}

export function getQualityStars(quality: ModelInfo["quality"]): number {
  switch (quality) {
    case "high": return 3;
    case "good": return 2;
  }
}

// Legacy exports kept for any existing references
export const PROVIDER_LABELS: Record<string, string> = { anthropic: "Anthropic", deepseek: "DeepSeek" };
export const PROVIDER_ORDER: Array<"anthropic" | "deepseek"> = ["deepseek", "anthropic"];

/**
 * Calculate the credit cost for a generation based on prompt character length.
 *
 * Longer prompts require more tokens to process, increasing provider costs.
 * We scale the credit cost to keep a healthy margin regardless of prompt size.
 *
 * Thresholds (character count → approximate tokens):
 *   < 1500 chars  (~375 tokens)  → base cost           (short)
 *   < 4000 chars  (~1000 tokens) → base + 1            (medium)
 *   < 8000 chars  (~2000 tokens) → base + 2            (long)
 *   ≥ 8000 chars  (~2000+ tokens)→ base + 3            (very long)
 *
 * Each attached image adds ~1000 tokens, so +1 per image.
 *
 * @param promptLength - Character count of the user's message
 * @param baseCost - The model's base credit cost (from modelConfig.creditCost)
 * @param imageCount - Number of attached images (default 0)
 */
export function calculateCreditCost(
  promptLength: number,
  baseCost: number,
  imageCount = 0,
): number {
  let cost = baseCost;
  if (promptLength >= 8000) cost += 3;
  else if (promptLength >= 4000) cost += 2;
  else if (promptLength >= 1500) cost += 1;
  // Each image adds roughly 1000 tokens of context
  cost += imageCount;
  return cost;
}
