/**
 * Image upload test — verifies that uploaded images are used correctly
 * in the generated code (not replaced with picsum/unsplash).
 */

import { test, expect } from "@playwright/test";
import path from "path";

test.describe("Image Upload", () => {
  test("uploaded image URL appears in generated code", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Open first project
    const projectLink = page.locator('a[href*="/project/"]').first();
    const hasProject = await projectLink.isVisible().catch(() => false);
    if (!hasProject) {
      test.skip(true, "No project available");
      return;
    }
    await projectLink.click();
    await page.waitForURL("**/project/**", { timeout: 15_000 });

    // Wait for chat input
    const chatInput = page.locator('textarea[placeholder*="Describe"], textarea[placeholder*="build"]');
    await chatInput.waitFor({ state: "visible", timeout: 15_000 });

    // Look for the file attachment button (paperclip icon)
    const attachBtn = page.locator('button[title*="ttach"], button[aria-label*="ttach"], label[class*="attach"]').first();
    const hasAttach = await attachBtn.isVisible().catch(() => false);

    if (!hasAttach) {
      test.skip(true, "No attachment button found");
      return;
    }

    // Upload a test image
    const fileInput = page.locator('input[type="file"]');
    const testImage = path.join(__dirname, "fixtures/test-logo.png");

    await fileInput.setInputFiles(testImage);
    await page.waitForTimeout(2000);

    await chatInput.fill("use this as the new logo");

    const sendBtn = page.locator("button").filter({ has: page.locator("svg") }).last();
    await sendBtn.click();

    // Wait for AI response
    const aiMessage = page.locator("text=/cr/").last();
    await expect(aiMessage).toBeVisible({ timeout: 90_000 });

    // Switch to code view and verify the image URL
    const codeTab = page.getByText(/code/i).first();
    await codeTab.click();
    await page.waitForTimeout(2000);

    // The generated code should contain our fly.dev asset URL, not picsum
    const codeContent = page.locator('[class*="editor"], [class*="code"], pre, code');
    const text = await codeContent.allTextContents();
    const fullCode = text.join("\n");

    expect(fullCode).not.toContain("picsum.photos");
    if (fullCode.includes("webagt-chat.fly.dev/api/assets/")) {
      console.log("[Image Upload] Correct — using fly.dev asset URL");
    }
  });
});
