/**
 * worker/src/types.ts
 *
 * TypeScript type definitions for the Cloudflare Worker environment.
 * The Env interface defines all bindings (KV, R2) and secrets
 * that the Worker has access to at runtime.
 *
 * These are configured in wrangler.jsonc and injected by the
 * Cloudflare runtime. During local dev, secrets come from .dev.vars.
 *
 * Used by: every route handler and middleware in the worker
 */

/**
 * Minimal KV namespace interface — compatible with both Cloudflare KV bindings
 * and Node.js/Vercel Redis adapters (duck-typing via structural compatibility).
 * Using a permissive return type to satisfy both Cloudflare and custom implementations.
 */
export interface IKVNamespace {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get<T = any>(key: string, type?: "json" | "text" | "arrayBuffer" | "stream"): Promise<T | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: { expirationTtl?: number }
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }>;
}

/**
 * Minimal R2 object body interface — returned by R2Bucket.get().
 */
export interface IR2ObjectBody {
  key: string;
  size: number;
  body: ReadableStream | null;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Minimal R2 bucket interface — compatible with Cloudflare R2 bindings
 * and Node.js/Vercel Redis adapters.
 */
export interface IR2Bucket {
  get(key: string): Promise<IR2ObjectBody | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream | Blob | null
  ): Promise<IR2ObjectBody>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
  }): Promise<{ objects: { key: string }[]; truncated: boolean }>;
}

/**
 * Worker environment bindings.
 *
 * @property METADATA - KV namespace for project metadata, chat history, credits
 * @property FILES - R2 bucket for storing generated project files
 * @property CLERK_ISSUER - Clerk JWT issuer URL for token verification
 * @property CLERK_JWKS_URL - Clerk JWKS endpoint for fetching public keys
 * @property ANTHROPIC_API_KEY - Anthropic API key for Claude models
 * @property GOOGLE_AI_API_KEY - Google AI API key for Gemini models
 * @property OPENAI_API_KEY - OpenAI API key for GPT models
 * @property DEEPSEEK_API_KEY - DeepSeek API key for DeepSeek V3/R1 models
 * @property CLERK_WEBHOOK_SECRET - Svix signing secret for Clerk billing webhooks
 */
export interface Env {
  METADATA: IKVNamespace;
  FILES: IR2Bucket;
  CLERK_ISSUER: string;
  CLERK_JWKS_URL: string;
  ANTHROPIC_API_KEY: string;
  GOOGLE_AI_API_KEY: string;
  OPENAI_API_KEY: string;
  DEEPSEEK_API_KEY: string;
  
  /** Turso API configuration for generating user databases */
  TURSO_API_TOKEN: string;
  TURSO_API_URL: string;
  TURSO_ORG_SLUG?: string;
  
  /** Stripe integration for Webshops */
  STRIPE_SECRET_KEY?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY_TEST?: string;
  STRIPE_PUBLISHABLE_KEY_TEST?: string;
  STRIPE_WEBHOOK_SECRET_TEST?: string;
  STRIPE_SECRET_KEY_LIVE?: string;
  STRIPE_PUBLISHABLE_KEY_LIVE?: string;
  STRIPE_WEBHOOK_SECRET_LIVE?: string;
  STRIPE_CLIENT_ID?: string;
  PLATFORM_COMMISSION_PERCENT?: string;
  /** Svix signing secret for verifying Clerk billing webhooks */
  CLERK_WEBHOOK_SECRET: string;
  /** Frontend URL for CORS — defaults to localhost:3000 in dev */
  FRONTEND_URL?: string;
  
  /** Coolify Deployment */
  COOLIFY_API_KEY?: string;
  COOLIFY_URL?: string;
  DEPLOYMENT_GITHUB_TOKEN?: string;
  DEPLOYMENT_REPO?: string;
  RESEND_API_KEY?: string;
  PLATFORM_EMAIL_FROM?: string;
  PLATFORM_REPLY_TO_FALLBACK?: string;
  PUBLIC_WORKER_URL?: string;
}

/**
 * Extended Hono context variables.
 * These are set by middleware and available to all route handlers.
 *
 * @property userId - Clerk user ID extracted from the JWT `sub` claim
 */
export interface AppVariables {
  userId: string;
}
