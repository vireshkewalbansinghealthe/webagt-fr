/**
 * Clerk JWT verification middleware for Fly.io (no Cloudflare bindings).
 * Uses jose library to verify JWTs against Clerk's JWKS endpoint.
 */

import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env, AppVariables } from "../types.js";

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;

export const authMiddleware = createMiddleware<{
  Variables: AppVariables;
}>(async (c, next) => {
  const env = c.get("env" as any) as Env;

  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Missing or invalid Authorization header", code: "AUTH_FAILED" }, 401);
  }

  const token = authHeader.slice(7);

  try {
    if (!jwksCache) {
      jwksCache = createRemoteJWKSet(new URL(env.CLERK_JWKS_URL));
    }

    const { payload } = await jwtVerify(token, jwksCache, {
      issuer: env.CLERK_ISSUER,
    });

    const userId = payload.sub;
    if (!userId) {
      return c.json({ error: "Invalid token: missing sub claim", code: "AUTH_FAILED" }, 401);
    }

    c.set("userId", userId);

    const metadata = payload.metadata as Record<string, any> | undefined;
    if (metadata?.role) {
      c.set("userRole", metadata.role);
    }
  } catch (err: any) {
    console.error("[auth] JWT verification failed:", err.message);
    return c.json({ error: "Invalid or expired token", code: "AUTH_FAILED" }, 401);
  }

  await next();
});
