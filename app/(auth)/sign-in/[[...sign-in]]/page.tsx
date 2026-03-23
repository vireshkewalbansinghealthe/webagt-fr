/**
 * app/(auth)/sign-in/[[...sign-in]]/page.tsx
 *
 * Sign-in page using Clerk's pre-built <SignIn /> component.
 *
 * The [[...sign-in]] catch-all route handles Clerk's multi-step
 * authentication flows (e.g., email verification, 2FA). Without
 * the catch-all, those sub-steps would 404.
 *
 * After successful sign-in, users are redirected to /dashboard
 * (configured via NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL in .env.local).
 *
 * Used by: app/(auth)/layout.tsx (centered layout)
 */

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return <SignIn />;
}
