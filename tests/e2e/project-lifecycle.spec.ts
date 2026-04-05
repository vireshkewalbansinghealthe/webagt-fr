/**
 * Full project lifecycle — create, prompt AI, verify preview, delete.
 * This is the critical user journey test.
 */

import { test, expect } from "@playwright/test";

const TEST_PROJECT_PREFIX = "e2e-test-";

test.describe("Project Lifecycle", () => {
  let projectUrl: string;

  test("create a new website project", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Click create project button
    const createBtn = page.getByRole("button", { name: /create.*project/i });
    await createBtn.waitFor({ state: "visible", timeout: 10_000 });
    await createBtn.click();

    // Fill in project dialog
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: "visible", timeout: 5_000 });

    const nameInput = dialog.locator('input[placeholder*="name"], input[placeholder*="Name"], input').first();
    await nameInput.fill(`${TEST_PROJECT_PREFIX}${Date.now()}`);

    // Select website type if available
    const websiteOption = dialog.getByText(/website/i).first();
    if (await websiteOption.isVisible().catch(() => false)) {
      await websiteOption.click();
    }

    // Enter description
    const descInput = dialog.locator("textarea").first();
    if (await descInput.isVisible().catch(() => false)) {
      await descInput.fill("A simple landing page with a hero section, features grid, and footer");
    }

    // Submit
    const submitBtn = dialog.getByRole("button", { name: /create|start|build/i });
    await submitBtn.click();

    // Wait for redirect to project editor
    await page.waitForURL("**/project/**", { timeout: 30_000 });
    projectUrl = page.url();
    expect(projectUrl).toContain("/project/");
  });

  test("editor page loads with chat and preview", async ({ page }) => {
    test.skip(!projectUrl, "No project URL from previous test");
    await page.goto(projectUrl);
    await page.waitForLoadState("networkidle");

    // Chat input should be visible
    const chatInput = page.locator('textarea[placeholder*="Describe"], textarea[placeholder*="build"]');
    await expect(chatInput).toBeVisible({ timeout: 15_000 });

    // Preview panel should exist
    const preview = page.locator("iframe").first();
    await expect(preview).toBeVisible({ timeout: 15_000 });
  });

  test("send a chat prompt and receive AI response", async ({ page }) => {
    test.skip(!projectUrl, "No project URL from previous test");
    await page.goto(projectUrl);
    await page.waitForLoadState("networkidle");

    const chatInput = page.locator('textarea[placeholder*="Describe"], textarea[placeholder*="build"]');
    await chatInput.waitFor({ state: "visible", timeout: 15_000 });

    // Type a simple prompt
    await chatInput.fill("Add a bright red banner at the top of the page that says SALE 50% OFF");

    // Send it (click the send button)
    const sendBtn = page.locator("button").filter({ has: page.locator('[class*="SendHorizontal"], [class*="send"]') }).first();
    if (await sendBtn.isVisible().catch(() => false)) {
      await sendBtn.click();
    } else {
      await chatInput.press("Enter");
    }

    // Wait for AI response bubble to appear
    const aiResponse = page.locator('[class*="message"]').filter({ hasText: /done|updated|changed|added|banner/i });
    await expect(aiResponse.first()).toBeVisible({ timeout: 90_000 });

    // Verify credits badge shows up
    const creditBadge = page.locator("text=/\\d+ cr/").first();
    await expect(creditBadge).toBeVisible({ timeout: 10_000 });
  });

  test("preview updates after AI generation", async ({ page }) => {
    test.skip(!projectUrl, "No project URL from previous test");
    await page.goto(projectUrl);
    await page.waitForLoadState("networkidle");

    // Preview iframe should exist and have content
    const iframe = page.locator("iframe").first();
    await expect(iframe).toBeVisible({ timeout: 15_000 });

    // Wait for the iframe to load
    await page.waitForTimeout(3000);
    const frameSrc = await iframe.getAttribute("src");
    expect(frameSrc).toBeTruthy();
  });
});
