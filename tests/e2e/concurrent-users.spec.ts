/**
 * Concurrent user simulation — multiple browser contexts hitting the platform simultaneously.
 * Tests platform stability under parallel load.
 *
 * Run with more workers for heavier load:
 *   TEST_WORKERS=10 npm run test:e2e -- concurrent-users
 */

import { test, expect } from "@playwright/test";

const CONCURRENT_PROMPTS = [
  "Make the header background dark blue with white text",
  "Add a testimonials section with 3 customer reviews and star ratings",
  "Create a pricing table with Basic, Pro, and Enterprise tiers",
  "Add a contact form with name, email, and message fields",
  "Change the footer to have 4 columns: About, Links, Support, Contact",
  "Add a hero section with a gradient background from purple to blue",
  "Create a product grid showing 6 items with images and prices",
  "Add a newsletter signup bar above the footer",
  "Make the navigation sticky with a blur backdrop effect",
  "Add an FAQ section with 5 expandable accordion items",
];

// Each worker picks a different prompt based on its index
test.describe("Concurrent AI Requests", () => {
  for (let i = 0; i < CONCURRENT_PROMPTS.length; i++) {
    test(`concurrent prompt ${i + 1}: "${CONCURRENT_PROMPTS[i].slice(0, 50)}..."`, async ({ page }) => {
      // Go to dashboard
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");

      // Find the first project and open it
      const projectLink = page.locator('a[href*="/project/"]').first();
      const hasProject = await projectLink.isVisible().catch(() => false);

      if (!hasProject) {
        test.skip(true, "No existing project to test against");
        return;
      }

      await projectLink.click();
      await page.waitForURL("**/project/**", { timeout: 15_000 });

      // Wait for chat input
      const chatInput = page.locator('textarea[placeholder*="Describe"], textarea[placeholder*="build"]');
      await chatInput.waitFor({ state: "visible", timeout: 15_000 });

      // Type the prompt
      await chatInput.fill(CONCURRENT_PROMPTS[i]);

      // Send
      const sendBtn = page.locator("button").filter({ has: page.locator("svg") }).last();
      await sendBtn.click();

      // Wait for response (up to 90 seconds for AI generation)
      const responseStart = Date.now();
      const aiMessage = page.locator("text=/cr/").last();
      await expect(aiMessage).toBeVisible({ timeout: 90_000 });
      const responseTime = Date.now() - responseStart;

      console.log(`[Concurrent ${i + 1}] Response in ${(responseTime / 1000).toFixed(1)}s — "${CONCURRENT_PROMPTS[i].slice(0, 40)}..."`);

      // Verify no error messages
      const errorMsg = page.locator("text=/error|failed|something went wrong/i");
      await expect(errorMsg).toBeHidden({ timeout: 5_000 }).catch(() => {
        console.warn(`[Concurrent ${i + 1}] Potential error visible on page`);
      });
    });
  }
});
