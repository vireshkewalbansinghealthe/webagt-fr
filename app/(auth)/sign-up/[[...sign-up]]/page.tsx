/**
 * app/(auth)/sign-up/[[...sign-up]]/page.tsx
 *
 * Sign-up page using Clerk's pre-built <SignUp /> component.
 *
 * The [[...sign-up]] catch-all route handles Clerk's multi-step
 * registration flows (e.g., email verification, profile setup).
 * Without the catch-all, those sub-steps would 404.
 *
 * After successful sign-up, users are redirected to /dashboard
 * (configured via NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL in .env.local).
 *
 * Used by: app/(auth)/layout.tsx (centered layout)
 */

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return <SignUp />;
}
