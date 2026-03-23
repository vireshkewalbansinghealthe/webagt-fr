/**
 * lib/models.ts
 *
 * Frontend model registry for the model selector UI.
 * Mirrors the worker's MODEL_REGISTRY but includes UI-specific
 * metadata like speed indicators, quality badges, and descriptions.
 *
 * This file is the single source of truth for model display info
 * on the frontend. The worker has its own registry for API routing.
 *
 * Used by: components/editor/model-selector.tsx
 */

/**
 * Metadata for a single model displayed in the model selector.
 *
 * @property id - Unique model ID sent to the API (e.g., "claude-sonnet-4-6")
 * @property name - Human-readable display name
 * @property provider - Provider group for UI section headers
 * @property tier - "fast" (free) or "premium" (Pro only)
 * @property speed - Relative speed indicator
 * @property quality - Relative quality indicator
 * @property creditCost - Credits consumed per generation
 * @property description - Short description shown in the dropdown
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: "anthropic" | "openai" | "google" | "deepseek";
  tier: "fast" | "premium";
  speed: "very-fast" | "fast" | "medium";
  quality: "good" | "high";
  creditCost: number;
  description: string;
  supportsVision: boolean;
}

/**
 * All supported AI models grouped by provider.
 * Order matches the Phase 7 spec — providers listed as:
 * Anthropic → OpenAI → Google → DeepSeek
 */
export const MODELS: ModelInfo[] = [
  // --- Anthropic ---
  {
    id: "claude-sonnet-4-6",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    tier: "premium",
    speed: "fast",
    quality: "high",
    creditCost: 2,
    description:
      "The best combination of speed and intelligence. Ideal for complex features.",
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
    description:
      "The most intelligent model for building agents and coding.",
    supportsVision: true,
  },
  {
    id: "claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    tier: "fast",
    speed: "very-fast",
    quality: "good",
    creditCost: 1,
    description:
      "Fast and capable. Great for quick iterations and simple changes.",
    supportsVision: true,
  },

  // --- OpenAI ---
  {
    id: "gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    tier: "premium",
    speed: "medium",
    quality: "high",
    creditCost: 2,
    description: "Versatile and reliable. Excellent for full-stack features.",
    supportsVision: true,
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    tier: "fast",
    speed: "fast",
    quality: "good",
    creditCost: 1,
    description: "Blazing fast and affordable. Perfect for small tweaks.",
    supportsVision: true,
  },

  // --- Google ---
  {
    id: "gemini-2-flash",
    name: "Gemini 2.0 Flash",
    provider: "google",
    tier: "fast",
    speed: "very-fast",
    quality: "good",
    creditCost: 1,
    description: "Fastest model available. Ideal for rapid prototyping.",
    supportsVision: true,
  },
  {
    id: "gemini-2-pro",
    name: "Gemini 2.0 Pro",
    provider: "google",
    tier: "premium",
    speed: "medium",
    quality: "high",
    creditCost: 2,
    description:
      "High quality with massive context. Great for large projects.",
    supportsVision: true,
  },

  // --- DeepSeek ---
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "deepseek",
    tier: "fast",
    speed: "fast",
    quality: "good",
    creditCost: 1,
    description:
      "Cost-effective and capable. Great for everyday coding tasks.",
    supportsVision: false,
  },
  {
    id: "deepseek-r1",
    name: "DeepSeek R1",
    provider: "deepseek",
    tier: "fast",
    speed: "medium",
    quality: "high",
    creditCost: 1,
    description:
      "Reasoning model. Excellent for complex logic and debugging.",
    supportsVision: false,
  },
];

/**
 * Default model ID used when none is specified.
 */
export const DEFAULT_MODEL_ID = "gpt-4o-mini";

/**
 * Provider display names for section headers in the model selector.
 */
export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  deepseek: "DeepSeek",
};

/**
 * Provider ordering for the model selector dropdown.
 */
export const PROVIDER_ORDER: Array<
  "anthropic" | "openai" | "google" | "deepseek"
> = ["anthropic", "openai", "google", "deepseek"];

/**
 * Returns the speed label for a given speed value.
 * Used in the model selector to show lightning bolt indicators.
 */
export function getSpeedLabel(speed: ModelInfo["speed"]): string {
  switch (speed) {
    case "very-fast":
      return "Fastest";
    case "fast":
      return "Fast";
    case "medium":
      return "Medium";
  }
}

/**
 * Returns the speed icon count (number of lightning bolts).
 */
export function getSpeedBolts(speed: ModelInfo["speed"]): number {
  switch (speed) {
    case "very-fast":
      return 3;
    case "fast":
      return 2;
    case "medium":
      return 1;
  }
}

/**
 * Returns the quality label for a given quality value.
 */
export function getQualityLabel(quality: ModelInfo["quality"]): string {
  switch (quality) {
    case "high":
      return "High";
    case "good":
      return "Good";
  }
}

/**
 * Returns the quality star count.
 */
export function getQualityStars(quality: ModelInfo["quality"]): number {
  switch (quality) {
    case "high":
      return 3;
    case "good":
      return 2;
  }
}

/**
 * Finds a model by ID from the MODELS array.
 * Returns undefined if not found.
 */
export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}
