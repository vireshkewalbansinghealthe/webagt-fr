/**
 * app/(marketing)/page.tsx
 *
 * Landing page — the first thing visitors see at "/".
 * Matches Lovable's design: full-viewport gradient background with
 * a centered hero section (headline, subtitle, chat-style CTA input).
 *
 * The navbar floats on top of the gradient with transparent background.
 * No scrolling needed — everything is above the fold.
 *
 * Lives in the (marketing) route group so it's publicly accessible
 * without authentication.
 *
 * Used by: app/(marketing)/layout.tsx
 */

import { Navbar, Hero } from "@/components/landing";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Navbar />
      <Hero />
    </div>
  );
}
