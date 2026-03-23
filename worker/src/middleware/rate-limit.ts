/**
 * worker/src/middleware/rate-limit.ts
 *
 * Simple rate limiting middleware using Cloudflare KV.
 * Tracks request counts per user per endpoint category per minute.
 *
 * KV key format: ratelimit:{userId}:{category}:{minuteTimestamp}
 * TTL: 60 seconds (auto-expires after the minute window)
 *
 * Rate limits per category:
 * - chat: 10 req/min (free), 30 req/min (pro) — AI generation
 * - export: 5 req/min — ZIP export downloads
 * - general: 60 req/min — all other API endpoints
 *
 * Returns 429 Too Many Requests if the limit is exceeded.
 *
 * Used by: worker/src/index.ts (applied to /api/* routes)
 */

import { createMiddleware } from "hono/factory";
import type { Env, AppVariables } from "../types";
import { getCredits } from "../services/credits";

/**
 * Rate limit configuration per category.
 * Maps category names to max requests per minute.
 */
const RATE_LIMITS = {
  chat: { free: 10, pro: 30 },
  export: { free: 5, pro: 5 },
  general: { free: 60, pro: 60 },
} as const;

/**
 * Determines the rate limit category based on the request path.
 * Used to apply different limits to different endpoint groups.
 *
 * @param path - The request URL path
 * @returns The rate limit category
 */
function getCategory(path: string): keyof typeof RATE_LIMITS {
  if (path.includes("/chat")) return "chat";
  if (path.includes("/export")) return "export";
  return "general";
}

/**
 * Rate limiting middleware.
 * Checks the current request count for the user and category,
 * increments it, and returns 429 if the limit is exceeded.
 *
 * Uses KV with a 60-second TTL for automatic cleanup.
 * The minute timestamp creates a natural sliding window.
 */
export const rateLimitMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const userId = c.var.userId;
  if (!userId) {
    // Auth middleware should have set userId — skip if missing
    await next();
    return;
  }

  const category = getCategory(c.req.path);
  const minuteKey = Math.floor(Date.now() / 60000);
  const kvKey = `ratelimit:${userId}:${category}:${minuteKey}`;

  // Get current request count
  const current = await c.env.METADATA.get(kvKey);
  const count = current ? parseInt(current, 10) : 0;

  // Determine the user's plan for plan-specific limits
  const credits = await getCredits(userId, c.env);
  const plan = credits.plan;
  const limit = RATE_LIMITS[category][plan];

  if (count >= limit) {
    // Calculate seconds remaining in the current minute window
    const secondsIntoMinute = Math.floor(Date.now() / 1000) % 60;
    const retryAfter = 60 - secondsIntoMinute;

    c.header("Retry-After", String(retryAfter));

    return c.json(
      {
        error: "Too many requests. Please try again in a minute.",
        code: "RATE_LIMITED",
        retryAfter,
      },
      429
    );
  }

  // Increment the counter with 60-second TTL
  await c.env.METADATA.put(kvKey, String(count + 1), {
    expirationTtl: 60,
  });

  // Add rate limit headers to the response
  await next();

  c.header("X-RateLimit-Limit", String(limit));
  c.header("X-RateLimit-Remaining", String(Math.max(0, limit - count - 1)));
});
