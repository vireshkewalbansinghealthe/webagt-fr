/**
 * app/layout.tsx
 *
 * Root layout for the entire application. This is the outermost wrapper
 * that every page shares. It provides:
 *
 * 1. <Providers> — Combined client-side wrapper that includes:
 *    - ThemeProvider (dark/light/system theme switching)
 *    - ClerkProvider (auth context with theme-aware appearance)
 * 2. Font loading — Geist Sans and Geist Mono from Google Fonts.
 * 3. Global CSS — Tailwind v4 styles and custom properties.
 * 4. HTML metadata — Page title and description for SEO.
 * 5. Anti-flash script — Inline script prevents wrong theme on load.
 *
 * All three route groups ((marketing), (auth), (app)) render inside
 * {children} here, inheriting the ClerkProvider and font setup.
 *
 * Used by: Next.js (automatic — wraps every page)
 */

import type { Metadata } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/cookie-consent";
import "./globals.css";

/**
 * Geist Sans — Primary body font.
 * Clean, modern sans-serif designed for readability on screens.
 */
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

/**
 * Outfit — Display font for logo and headers.
 */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

/**
 * Geist Mono — Code and monospace font.
 */
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Page metadata for SEO and browser tabs.
 */
export const metadata: Metadata = {
  title: "WebAGT — From Prompt to Live Storefront",
  description:
    "WebAGT turns a prompt into a polished storefront with real code, Turso data, and Stripe-powered checkout.",
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
    ],
  },
};

/**
 * Inline script that runs before React hydration to prevent
 * a flash of the wrong theme. Reads the stored theme from
 * localStorage (or defaults to "dark") and applies the class
 * to <html> immediately.
 */
const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('theme') || 'dark';
    var d = t === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t;
    if (d === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
      >
        <Providers>
          {children}
          <Toaster />
          <CookieConsent />
        </Providers>
      </body>
    </html>
  );
}
