/**
 * Smoke tests — basic platform health checks.
 * Runs fast, validates core pages load and API responds.
 */

import { test, expect } from "@playwright/test";

test.describe("Platform Smoke Tests", () => {
  test("dashboard loads and shows projects", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();
    // Wait for either "Create Project" button or project cards to appear
    const createBtn = page.getByRole("button", { name: /create.*project/i });
    const projectCard = page.locator('a[href*="/project/"]').first();
    await expect(createBtn.or(projectCard)).toBeVisible({ timeout: 15_000 });
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/credit|plan|pro/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("body")).toBeVisible();
  });

  test("fly-chat health endpoint responds", async ({ request }) => {
    const res = await request.get("https://webagt-chat.fly.dev/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("worker API responds", async ({ request }) => {
    const res = await request.get("https://webagt-worker-v2.webagt.workers.dev/api/projects", {
      headers: { Authorization: "Bearer test" },
    });
    // Any response means the worker is alive (401/403 = auth rejected, 404 = route not found)
    expect([200, 401, 403, 404]).toContain(res.status());
  });
});
