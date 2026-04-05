/**
 * Playwright auth setup — bypasses Cloudflare Turnstile by using the
 * Clerk Frontend API to create a session directly, then injecting the
 * session token as a cookie.
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

const TEST_USERS = [
  { id: "user_3BvSIKf5Lg448ZoIuqnORV4jxkm", email: "e2e-tester-1@webagt.ai" },
  { id: "user_3BvSIKNS6oW59jmUAys8gYgUGcj", email: "e2e-tester-2@webagt.ai" },
  { id: "user_3BvSIOOxYbPAZv5U3LudsrWVu5k", email: "e2e-tester-3@webagt.ai" },
];

setup("authenticate", async ({ page, context }) => {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) {
    throw new Error("Missing CLERK_SECRET_KEY env var");
  }

  const userIndex = parseInt(process.env.TEST_USER_INDEX || "0");
  const user = TEST_USERS[userIndex] || TEST_USERS[0];
  const baseUrl = process.env.TEST_BASE_URL || "https://webagt.ai";

  console.log(`[auth] Creating sign-in token for ${user.email}...`);

  // Create a sign-in token via Clerk Backend API
  const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clerkSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: user.id }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Failed to create sign-in token: ${tokenRes.status}`);
  }

  const { token } = await tokenRes.json();

  // Go to the app first to set up the domain context
  await page.goto(baseUrl);
  await page.waitForLoadState("domcontentloaded");

  // Use Clerk's Frontend API to redeem the sign-in token directly
  // This bypasses the accounts.webagt.ai Cloudflare Turnstile
  const clerkFapiUrl = "https://clerk.webagt.ai";

  const redeemResult = await page.evaluate(
    async ({ token, fapiUrl }) => {
      const res = await fetch(`${fapiUrl}/v1/sign_in_tokens/${token}/redeem`, {
        method: "POST",
        credentials: "include",
      });
      return { status: res.status, ok: res.ok, data: await res.json().catch(() => null) };
    },
    { token, fapiUrl: clerkFapiUrl }
  );

  if (!redeemResult.ok) {
    // Try alternative FAPI domain
    const altResult = await page.evaluate(
      async ({ token }) => {
        // Clerk FAPI is usually at the same domain as the frontend
        const res = await fetch(`/api/auth/sign-in-token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        return { status: res.status, ok: res.ok };
      },
      { token }
    );

    if (!altResult.ok) {
      // Fallback: navigate directly and handle Turnstile
      console.log("[auth] FAPI redeem failed, trying direct navigation with longer timeout...");
      const ticketUrl = `https://accounts.webagt.ai/sign-in?__clerk_ticket=${token}`;
      await page.goto(ticketUrl);

      // Try to wait — if Turnstile appears, click the checkbox
      try {
        const turnstile = page.frameLocator('iframe[src*="turnstile"]').locator('input[type="checkbox"]');
        if (await turnstile.isVisible({ timeout: 3000 }).catch(() => false)) {
          await turnstile.click();
        }
      } catch { /* no turnstile */ }

      await page.waitForURL((u) => !u.href.includes("accounts."), { timeout: 60_000 });
    }
  }

  // Navigate to dashboard
  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForLoadState("networkidle");

  // Verify we're authenticated
  const currentUrl = page.url();
  if (currentUrl.includes("sign-in")) {
    throw new Error(`Authentication failed — still on sign-in page: ${currentUrl}`);
  }

  console.log(`[auth] Authenticated as ${user.email} — on ${currentUrl}`);

  // Save signed-in state
  await context.storageState({ path: authFile });
});
