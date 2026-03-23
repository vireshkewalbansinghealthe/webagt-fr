/**
 * worker/src/middleware/auth.ts
 *
 * JWT authentication middleware for the Cloudflare Worker.
 * Verifies Clerk-issued JWTs on every /api/* request by:
 *
 * 1. Extracting the Bearer token from the Authorization header
 * 2. Fetching Clerk's JWKS public keys (cached automatically by jose)
 * 3. Verifying the JWT signature, expiration, and issuer claims
 * 4. Extracting the userId from the `sub` claim
 * 5. Setting `userId` on the Hono context for downstream handlers
 *
 * If verification fails for any reason, the request is rejected
 * with a 401 Unauthorized response before reaching route handlers.
 *
 * Used by: worker/src/index.ts (applied to all /api/* routes)
 */

import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env, AppVariables } from "../types";

/**
 * Cache the JWKS key set per issuer URL to avoid re-creating it
 * on every request. jose internally handles key rotation and caching,
 * but we avoid re-instantiating the function itself.
 */
let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedJWKSUrl: string | null = null;

/**
 * Get or create a JWKS key resolver for the given URL.
 * Reuses the cached instance if the URL hasn't changed.
 *
 * @param jwksUrl - The Clerk JWKS endpoint URL
 * @returns A key resolver function compatible with jwtVerify
 */
function getJWKS(jwksUrl: string) {
  if (cachedJWKS && cachedJWKSUrl === jwksUrl) {
    return cachedJWKS;
  }

  cachedJWKS = createRemoteJWKSet(new URL(jwksUrl), {
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  });
  cachedJWKSUrl = jwksUrl;

  return cachedJWKS;
}

/**
 * Hono middleware that verifies Clerk JWTs.
 *
 * Expects an `Authorization: Bearer <token>` header.
 * On success, sets `c.set("userId", ...)` for downstream handlers.
 * On failure, returns 401 with a JSON error response.
 */
export const authMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: AppVariables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header", code: "UNAUTHORIZED" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const jwks = getJWKS(c.env.CLERK_JWKS_URL);

    const { payload } = await jwtVerify(token, jwks, {
      issuer: c.env.CLERK_ISSUER,
    });

    // Clerk stores the user ID in the `sub` (subject) claim
    const userId = payload.sub;

    if (!userId) {
      return c.json({ error: "JWT missing sub claim", code: "UNAUTHORIZED" }, 401);
    }

    console.log(`[auth] Authenticated user: ${userId}`);
    c.set("userId", userId);
    await next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "JWT verification failed";
    console.error("Auth Middleware Error:", message, error);
    return c.json({ error: message, code: "UNAUTHORIZED" }, 401);
  }
});
