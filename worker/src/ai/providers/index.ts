/**
 * worker/src/ai/providers/index.ts
 *
 * AI model registry and factory for multi-model support using the Vercel AI SDK.
 * Instead of 4 custom provider files with raw fetch + SSE parsing (~780 lines),
 * we use the AI SDK's `streamText()` which handles all provider differences
 * behind a single `getModel()` function.
 *
 * Supports 8 models across 4 providers:
 * - Anthropic: Claude Sonnet 4.5, Claude Haiku 3.5
 * - OpenAI: GPT-4o, GPT-4o Mini
 * - Google: Gemini 2.0 Flash, Gemini 2.0 Pro
 * - DeepSeek: DeepSeek V3, DeepSeek R1
 *
 * Adding a new model only requires:
 * 1. Add entry to MODEL_REGISTRY (with maxOutputTokens)
 * 2. Add case to getModel() switch (if new provider)
 * 3. If new provider: `npm install @ai-sdk/<provider>` and add import
 *
 * Used by: worker/src/routes/chat.ts
 */

import type { Env } from "../../types";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

/**
 * Metadata for a single model in the registry.
 *
 * @property provider - Which AI service powers this model
 * @property displayName - Human-readable name for the UI
 * @property apiModelId - Exact model ID sent to the provider API
 * @property creditCost - How many credits each generation costs
 * @property tier - "fast" (free users) or "premium" (Pro only)
 * @property speed - Relative speed indicator for the UI
 * @property quality - Relative quality indicator for the UI
 * @property description - Short description shown in model selector
 * @property supportsVision - Whether the model can analyze images
 * @property maxOutputTokens - Maximum tokens the model can generate per response
 */
export interface ModelConfig {
  provider: "anthropic" | "deepseek";
  displayName: string;
  apiModelId: string;
  creditCost: number;
  tier: "fast" | "premium";
  speed: "very-fast" | "fast" | "medium";
  quality: "good" | "high";
  description: string;
  supportsVision: boolean;
  maxOutputTokens: number;
}

/**
 * Registry of all supported AI models with their provider and metadata.
 * Maps model IDs to their display info, provider, and credit cost.
 *
 * Model IDs match what's stored in project metadata and what the
 * model selector sends in chat requests.
 *
 * Credit costs:
 * - 1 credit: Fast tier models (Haiku, GPT-4o-mini, Flash, DeepSeek V3/R1)
 * - 2 credits: Premium tier models (Sonnet, GPT-4o, Gemini Pro)
 */
export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  "claude-sonnet-4-6": {
    provider: "anthropic",
    displayName: "Claude Sonnet 4.6",
    apiModelId: "claude-sonnet-4-6",
    creditCost: 2,
    tier: "premium",
    speed: "fast",
    quality: "high",
    description:
      "The best combination of speed and intelligence. Ideal for complex features.",
    supportsVision: true,
    maxOutputTokens: 64000,
  },
  "claude-opus-4-6": {
    provider: "anthropic",
    displayName: "Claude Opus 4.6",
    apiModelId: "claude-opus-4-6",
    creditCost: 4,
    tier: "premium",
    speed: "medium",
    quality: "high",
    description:
      "The most intelligent model for building agents and coding.",
    supportsVision: true,
    maxOutputTokens: 128000,
  },
  "claude-haiku-4-5": {
    provider: "anthropic",
    displayName: "Claude Haiku 4.5",
    apiModelId: "claude-haiku-4-5-20251001",
    creditCost: 1,
    tier: "fast",
    speed: "very-fast",
    quality: "good",
    description:
      "Fast and capable. Great for quick iterations and simple changes.",
    supportsVision: true,
    maxOutputTokens: 64000,
  },
  "deepseek-v3": {
    provider: "deepseek",
    displayName: "DeepSeek V3",
    apiModelId: "deepseek-chat",
    creditCost: 1,
    tier: "fast",
    speed: "fast",
    quality: "good",
    description:
      "Cost-effective and capable. Great for everyday coding tasks.",
    supportsVision: false,
    maxOutputTokens: 8192,
  },
  "deepseek-r1": {
    provider: "deepseek",
    displayName: "DeepSeek R1",
    apiModelId: "deepseek-reasoner",
    creditCost: 1,
    tier: "fast",
    speed: "medium",
    quality: "high",
    description:
      "Reasoning model. Excellent for complex logic and debugging.",
    supportsVision: false,
    maxOutputTokens: 16384,
  },
};

/**
 * Default model used when no model is specified.
 * GPT-4o Mini is the default — fast, affordable, and reliable.
 */
export const DEFAULT_MODEL = "deepseek-v3";

/**
 * Returns an AI SDK LanguageModel instance for the given model ID.
 * Uses the create* functions from each provider package to construct
 * model instances that work with `streamText()`.
 *
 * Why explicit API keys? Cloudflare Workers don't have process.env.
 * The create* functions default to reading process.env.ANTHROPIC_API_KEY etc.,
 * which doesn't exist in Workers. We pass keys from Hono's env bindings.
 *
 * @param model - The model ID (e.g., "claude-sonnet-4-5", "deepseek-v3")
 * @param env - Worker environment with API keys
 * @returns An AI SDK LanguageModel instance
 * @throws Error if the model is not found in the registry
 */
export function getModel(model: string, env: Env): LanguageModel {
  const config = MODEL_REGISTRY[model];
  if (!config) throw new Error(`Unknown model: ${model}`);

  switch (config.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(config.apiModelId);
    case "deepseek":
      return createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY })(config.apiModelId);
    default:
      throw new Error(`Provider not implemented: ${config.provider}`);
  }
}
