/**
 * proxy.ts
 *
 * Next.js middleware powered by Clerk for route protection.
 * This file runs before every request and determines whether
 * the user needs to be authenticated to access the route.
 *
 * Protected routes (/dashboard, /project/*, /settings) redirect
 * unauthenticated users to /sign-in. Public routes (/, /sign-in,
 * /sign-up, /pricing) are accessible to everyone.
 *
 * IMPORTANT: This file must live in the project root (not inside app/).
 * Next.js automatically picks up middleware from middleware.ts or proxy.ts
 * when configured via next.config.ts.
 *
 * Used by: Next.js middleware system (automatic)
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes that require the user to be signed in.
 * Any request matching these patterns will trigger Clerk's auth check.
 * Unauthenticated users are redirected to the sign-in page.
 */
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/project(.*)",
  "/settings(.*)",
]);

/**
 * Clerk middleware handler.
 *
 * For each incoming request:
 * 1. Clerk attaches auth context (userId, sessionId, etc.)
 * 2. If the route is protected, auth.protect() enforces authentication
 * 3. Unauthenticated requests to protected routes redirect to /sign-in
 * 4. Public routes pass through without any auth check
 */
export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

/**
 * Next.js route matcher configuration.
 *
 * Tells Next.js which requests should pass through middleware.
 * We exclude static assets and Next.js internals for performance —
 * no need to run auth checks on images, fonts, or CSS files.
 */
export const config = {
  matcher: [
    // Skip Next.js internals and all static files (images, fonts, etc.)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run middleware on API routes
    "/(api|trpc)(.*)",
  ],
};
