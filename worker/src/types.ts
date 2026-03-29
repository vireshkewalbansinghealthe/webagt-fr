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
  METADATA: KVNamespace;
  FILES: R2Bucket;
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

  /** Supabase project URL (e.g. https://xxxx.supabase.co) — for asset storage */
  SUPABASE_URL?: string;
  /** Supabase service_role secret key — used server-side to upload assets */
  SUPABASE_SERVICE_KEY?: string;
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
