/**
 * Playwright auth setup — logs in via Clerk and saves session state.
 * Re-used by all test files so we only authenticate once.
 *
 * Requires env vars:
 *   TEST_USER_EMAIL — Clerk test account email
 *   TEST_USER_PASSWORD — Clerk test account password
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";

const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Missing TEST_USER_EMAIL or TEST_USER_PASSWORD env vars.\n" +
      "Create a test account in Clerk and set these in .env.test"
    );
  }

  await page.goto("/sign-in");
  await page.waitForLoadState("networkidle");

  // Clerk sign-in flow
  const emailInput = page.locator('input[name="identifier"]');
  await emailInput.waitFor({ state: "visible", timeout: 15_000 });
  await emailInput.fill(email);
  await page.locator('button:has-text("Continue")').click();

  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.waitFor({ state: "visible", timeout: 10_000 });
  await passwordInput.fill(password);
  await page.locator('button:has-text("Continue")').click();

  // Wait for redirect to dashboard
  await page.waitForURL("**/dashboard**", { timeout: 30_000 });
  await expect(page.locator("body")).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
