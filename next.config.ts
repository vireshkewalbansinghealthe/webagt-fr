/**
 * next.config.ts
 *
 * Next.js configuration with security headers.
 * Adds standard security headers to all responses to protect
 * against common web vulnerabilities (XSS, clickjacking, MIME sniffing).
 *
 * Used by: Next.js build system (automatic)
 */

import type { NextConfig } from "next";

/**
 * Security headers applied to all routes.
 * These follow OWASP best practices for web application security.
 */
const securityHeaders = [
  /** Prevents the page from being embedded in iframes (clickjacking protection) */
  { key: "X-Frame-Options", value: "DENY" },
  /** Prevents MIME type sniffing (forces browser to use declared Content-Type) */
  { key: "X-Content-Type-Options", value: "nosniff" },
  /** Controls how much referrer info is sent with requests */
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /** Disables unused browser features for security */
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: false,
  devIndicators: false,
  async headers() {
    return [
      {
        /** Apply security headers to all routes */
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
