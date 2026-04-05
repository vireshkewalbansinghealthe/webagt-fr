/**
 * Smoke tests — basic platform health checks.
 * Runs fast, validates core pages load and API responds.
 */

import { test, expect } from "@playwright/test";

test.describe("Platform Smoke Tests", () => {
  test("dashboard loads and shows projects", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).toBeVisible();
    // Either shows project cards or the empty state
    const hasProjects = page.locator('[class*="grid"]').first();
    const emptyState = page.getByText(/create.*project|no projects|start building/i);
    await expect(hasProjects.or(emptyState)).toBeVisible({ timeout: 15_000 });
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

  test("worker health endpoint responds", async ({ request }) => {
    const res = await request.get("https://webagt-worker-v2.webagt.workers.dev/health");
    expect(res.ok()).toBeTruthy();
  });
});
