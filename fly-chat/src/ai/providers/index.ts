/**
 * AI model registry adapted for Fly.io — uses plain env vars instead of Cloudflare Env bindings.
 */

import type { Env } from "../../types.js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";

export interface ModelConfig {
  provider: "anthropic" | "openai" | "google" | "deepseek";
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

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  "claude-sonnet-4-6": {
    provider: "anthropic",
    displayName: "Claude Sonnet 4.6",
    apiModelId: "claude-sonnet-4-6",
    creditCost: 2,
    tier: "premium",
    speed: "fast",
    quality: "high",
    description: "The best combination of speed and intelligence.",
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
    description: "The most intelligent model for building agents and coding.",
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
    description: "Fast and capable. Great for quick iterations.",
    supportsVision: true,
    maxOutputTokens: 64000,
  },
  "gpt-4o": {
    provider: "openai",
    displayName: "GPT-4o",
    apiModelId: "gpt-4o",
    creditCost: 2,
    tier: "premium",
    speed: "medium",
    quality: "high",
    description: "Versatile and reliable for full-stack features.",
    supportsVision: true,
    maxOutputTokens: 16384,
  },
  "gpt-4o-mini": {
    provider: "openai",
    displayName: "GPT-4o Mini",
    apiModelId: "gpt-4o-mini",
    creditCost: 1,
    tier: "fast",
    speed: "fast",
    quality: "good",
    description: "Blazing fast and affordable.",
    supportsVision: true,
    maxOutputTokens: 16384,
  },
  "gemini-2-flash": {
    provider: "google",
    displayName: "Gemini 2.0 Flash",
    apiModelId: "gemini-2.0-flash",
    creditCost: 1,
    tier: "fast",
    speed: "very-fast",
    quality: "good",
    description: "Fastest model available.",
    supportsVision: true,
    maxOutputTokens: 16384,
  },
  "gemini-2-pro": {
    provider: "google",
    displayName: "Gemini 2.0 Pro",
    apiModelId: "gemini-2.0-pro",
    creditCost: 2,
    tier: "premium",
    speed: "medium",
    quality: "high",
    description: "High quality with massive context.",
    supportsVision: true,
    maxOutputTokens: 16384,
  },
  "deepseek-v3": {
    provider: "deepseek",
    displayName: "DeepSeek V3",
    apiModelId: "deepseek-chat",
    creditCost: 1,
    tier: "fast",
    speed: "fast",
    quality: "good",
    description: "Cost-effective and capable.",
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
    description: "Reasoning model for complex logic.",
    supportsVision: false,
    maxOutputTokens: 16384,
  },
};

export const DEFAULT_MODEL = "gpt-4o-mini";

export function getModel(model: string, env: Env): LanguageModel {
  const config = MODEL_REGISTRY[model];
  if (!config) throw new Error(`Unknown model: ${model}`);

  switch (config.provider) {
    case "anthropic":
      return createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })(config.apiModelId);
    case "openai":
      return createOpenAI({ apiKey: env.OPENAI_API_KEY })(config.apiModelId);
    case "google":
      return createGoogleGenerativeAI({ apiKey: env.GOOGLE_AI_API_KEY })(config.apiModelId);
    case "deepseek":
      return createDeepSeek({ apiKey: env.DEEPSEEK_API_KEY })(config.apiModelId);
    default:
      throw new Error(`Provider not implemented: ${config.provider}`);
  }
}
