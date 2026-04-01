export interface Env {
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GOOGLE_AI_API_KEY: string;
  DEEPSEEK_API_KEY: string;

  CLERK_ISSUER: string;
  CLERK_JWKS_URL: string;

  CF_ACCOUNT_ID: string;
  CF_API_TOKEN: string;
  CF_KV_NAMESPACE_ID: string;

  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;

  TURSO_API_TOKEN: string;
  TURSO_API_URL: string;
  TURSO_ORG_SLUG?: string;

  PUBLIC_WORKER_URL?: string;
  FRONTEND_URL?: string;
  PORT?: string;
}

export interface AppVariables {
  userId: string;
  userRole?: string;
}

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

function optional(name: string): string {
  return process.env[name] || "";
}

export function loadEnv(): Env {
  return {
    ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),
    OPENAI_API_KEY: optional("OPENAI_API_KEY"),
    GOOGLE_AI_API_KEY: optional("GOOGLE_AI_API_KEY"),
    DEEPSEEK_API_KEY: optional("DEEPSEEK_API_KEY"),
    CLERK_ISSUER: required("CLERK_ISSUER"),
    CLERK_JWKS_URL: required("CLERK_JWKS_URL"),
    CF_ACCOUNT_ID: required("CF_ACCOUNT_ID"),
    CF_API_TOKEN: required("CF_API_TOKEN"),
    CF_KV_NAMESPACE_ID: required("CF_KV_NAMESPACE_ID"),
    R2_ACCESS_KEY_ID: required("R2_ACCESS_KEY_ID"),
    R2_SECRET_ACCESS_KEY: required("R2_SECRET_ACCESS_KEY"),
    R2_BUCKET_NAME: required("R2_BUCKET_NAME"),
    TURSO_API_TOKEN: required("TURSO_API_TOKEN"),
    TURSO_API_URL: optional("TURSO_API_URL") || "https://api.turso.tech/v1",
    TURSO_ORG_SLUG: optional("TURSO_ORG_SLUG") || undefined,
    PUBLIC_WORKER_URL: optional("PUBLIC_WORKER_URL") || undefined,
    FRONTEND_URL: optional("FRONTEND_URL") || undefined,
    PORT: optional("PORT") || "3001",
  };
}
