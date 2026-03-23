/**
 * app/(marketing)/layout.tsx
 *
 * Layout for the marketing route group (public-facing pages).
 * Currently a simple pass-through — navbar and footer will be
 * added in Phase 2 when we build the landing page components.
 *
 * The (marketing) route group doesn't add a URL segment — the
 * root "/" path maps to app/(marketing)/page.tsx.
 *
 * No authentication required for any routes in this group.
 *
 * Used by: app/(marketing)/page.tsx (landing page), pricing, etc.
 */

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
