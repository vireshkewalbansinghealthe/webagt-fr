/**
 * Full single-browser user flow:
 *
 *   1. Login via Clerk sign-in token
 *   2. If dashboard tour appears → follow all tips
 *   3. Create a new project with a random prompt from 100 options
 *   4. If editor tour appears → follow all tips
 *   5. Wait 1 min, then poll up to 8 times checking if generation is done
 *   6. POST result to /api/testing/bot-run for admin dashboard
 */

import { test, expect } from "@playwright/test";
import { PROMPTS } from "./prompts";
import { nanoid } from "nanoid";

test.use({ storageState: undefined });

const TEST_USERS = [
  { id: "user_3BvSIKf5Lg448ZoIuqnORV4jxkm", email: "e2e-tester-1@webagt.ai" },
  { id: "user_3BvSIKNS6oW59jmUAys8gYgUGcj", email: "e2e-tester-2@webagt.ai" },
  { id: "user_3BvSIOOxYbPAZv5U3LudsrWVu5k", email: "e2e-tester-3@webagt.ai" },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function completeTourIfVisible(page: import("@playwright/test").Page, variant: "dashboard" | "editor") {
  const welcomeButton =
    variant === "dashboard"
      ? page.getByRole("button", { name: /show me around/i })
      : page.getByRole("button", { name: /ja.*laat.*zien/i });

  const appeared = await welcomeButton.isVisible({ timeout: 3_000 }).catch(() => false);
  if (!appeared) return false;

  console.log(`[tour:${variant}] Tour detected — following tips`);
  await welcomeButton.click();
  await page.waitForTimeout(400);

  const nextLabel = variant === "dashboard" ? /^Next$/i : /^Volgende$/i;
  const doneLabel = variant === "dashboard" ? /Done/i : /Klaar/i;

  for (let i = 0; i < 20; i++) {
    const doneBtn = page.getByRole("button", { name: doneLabel });
    if (await doneBtn.isVisible({ timeout: 600 }).catch(() => false)) {
      await doneBtn.click();
      console.log(`[tour:${variant}] Completed (${i + 1} steps)`);
      return true;
    }
    const nextBtn = page.getByRole("button", { name: nextLabel });
    if (await nextBtn.isVisible({ timeout: 600 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(300);
      continue;
    }
    break;
  }
  return true;
}

async function reportBotRun(workerUrl: string, run: Record<string, unknown>) {
  try {
    await fetch(`${workerUrl}/api/testing/bot-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(run),
    });
  } catch {
    console.log("[report] Failed to report bot run (non-critical)");
  }
}

test("full flow: login → tour → create project → wait for generation", async ({ page }) => {
  test.setTimeout(12 * 60_000);

  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) throw new Error("Missing CLERK_SECRET_KEY");

  const userIndex = parseInt(process.env.TEST_USER_INDEX || "0");
  const user = TEST_USERS[userIndex] || TEST_USERS[0];
  const baseUrl = process.env.TEST_BASE_URL || "https://webagt.ai";
  const workerUrl = process.env.WORKER_URL || "https://webagt-worker-v2.vireshkewalbansing.workers.dev";

  // Pick a random prompt
  const prompt = pickRandom(PROMPTS);
  const runId = nanoid();
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  console.log(`[prompt] Sector: ${prompt.sector}`);
  console.log(`[prompt] Name: ${prompt.name}`);
  console.log(`[prompt] Description: ${prompt.description.slice(0, 80)}...`);

  // Report: running
  await reportBotRun(workerUrl, {
    id: runId, status: "running", projectName: prompt.name, projectUrl: "",
    sector: prompt.sector, prompt: prompt.description, userEmail: user.email, startedAt,
  });

  // ── 1. LOGIN ───────────────────────────────────────────────────────────────
  console.log(`[1/5] Logging in as ${user.email}...`);

  const tokenRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: user.id }),
  });
  if (!tokenRes.ok) throw new Error(`Clerk token failed: ${tokenRes.status}`);
  const { token } = await tokenRes.json();

  await page.goto(baseUrl);
  await page.waitForLoadState("domcontentloaded");

  const redeemResult = await page.evaluate(
    async ({ token, fapiUrl }) => {
      const res = await fetch(`${fapiUrl}/v1/sign_in_tokens/${token}/redeem`, {
        method: "POST", credentials: "include",
      });
      return { ok: res.ok };
    },
    { token, fapiUrl: "https://clerk.webagt.ai" },
  );

  if (!redeemResult.ok) {
    console.log("[1/5] FAPI redeem failed, trying ticket URL...");
    await page.goto(`https://accounts.webagt.ai/sign-in?__clerk_ticket=${token}`);
    try {
      const turnstile = page.frameLocator('iframe[src*="turnstile"]').locator('input[type="checkbox"]');
      if (await turnstile.isVisible({ timeout: 3_000 }).catch(() => false)) await turnstile.click();
    } catch {}
    await page.waitForURL((u) => !u.href.includes("accounts."), { timeout: 60_000 });
  }

  await page.goto(`${baseUrl}/dashboard`);
  await page.waitForLoadState("networkidle");
  if (page.url().includes("sign-in")) throw new Error("Auth failed");
  console.log(`[1/5] ✓ Logged in`);

  // ── 2. ENSURE CREDITS ≥ 400 ─────────────────────────────────────────────
  console.log("[2/5] Checking credits...");
  try {
    const creditsRes = await fetch(`${workerUrl}/api/testing/ensure-credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, min: 400 }),
    });
    const creditsData = await creditsRes.json() as { topped: boolean; remaining: number };
    if (creditsData.topped) {
      console.log(`[2/5] ✓ Credits topped up to 500 (were below 400)`);
    } else {
      console.log(`[2/5] ✓ Credits OK (${creditsData.remaining})`);
    }
  } catch (e) {
    console.log(`[2/5] ⚠ Could not check credits: ${e}`);
  }

  // ── DASHBOARD TOUR ─────────────────────────────────────────────────────
  await completeTourIfVisible(page, "dashboard");

  // ── 3. CREATE PROJECT ──────────────────────────────────────────────────────
  console.log("[3/5] Creating project...");

  const createBtn = page.getByRole("button", { name: /create.*project/i }).or(
    page.locator('[data-tour="create-project"]'),
  );
  await expect(createBtn.first()).toBeVisible({ timeout: 10_000 });
  await createBtn.first().click();

  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: "visible", timeout: 5_000 });

  await dialog.locator("button").filter({ hasText: "Website" }).first().click();
  await dialog.locator("#project-name").fill(prompt.name);
  await dialog.locator("#project-description").fill(prompt.description);

  console.log(`[3/5] Name: ${prompt.name} | Sector: ${prompt.sector}`);

  const submitBtn = dialog.getByRole("button", { name: /create project/i });
  await expect(submitBtn).toBeEnabled({ timeout: 2_000 });
  await submitBtn.click();

  await page.waitForURL("**/project/**", { timeout: 60_000 });
  const projectUrl = page.url();
  console.log(`[3/5] ✓ Editor opened: ${projectUrl}`);

  // Report: project URL known
  await reportBotRun(workerUrl, { id: runId, projectUrl });

  // ── 4. EDITOR TOUR ────────────────────────────────────────────────────────
  await page.waitForTimeout(3_000);
  await completeTourIfVisible(page, "editor");

  // ── 5. POLL: wait 1 min, check, max 8 times ───────────────────────────────
  const MAX_POLLS = 8;
  let finalStatus: "passed" | "failed" | "timeout" = "timeout";
  let filesText: string | null = null;
  let creditsText: string | null = null;

  for (let poll = 1; poll <= MAX_POLLS; poll++) {
    console.log(`[5/5] Poll #${poll}/${MAX_POLLS} — waiting 60 seconds...`);
    await page.waitForTimeout(60_000);

    await completeTourIfVisible(page, "editor");

    const stillGenerating = await page.locator('textarea[placeholder*="generating"]').first()
      .isVisible({ timeout: 1_000 }).catch(() => false);

    if (stillGenerating) {
      console.log(`[5/5] Poll #${poll}/${MAX_POLLS} — still generating...`);
      continue;
    }

    // Not generating anymore — check results
    const filesChanged = page.locator("text=/\\d+ files? changed/i");
    const creditBadge = page.locator("text=/\\d+\\s*cr/");

    filesText = (await filesChanged.count()) > 0 ? await filesChanged.last().textContent() : null;
    creditsText = (await creditBadge.count()) > 0 ? await creditBadge.last().textContent() : null;

    // Check for error messages
    const errorEl = page.locator("text=/GENERATION FAILED|error|failed/i").first();
    const hasError = await errorEl.isVisible({ timeout: 500 }).catch(() => false);

    if (hasError) {
      const errorText = await errorEl.textContent().catch(() => "unknown error");
      console.log(`[5/5] ✗ Generation failed: ${errorText}`);
      finalStatus = "failed";
    } else {
      console.log(`[5/5] ✓ Generation complete after ${poll} min`);
      if (filesText) console.log(`[5/5]   ${filesText}`);
      if (creditsText) console.log(`[5/5]   Credits: ${creditsText}`);
      finalStatus = "passed";
    }
    break;
  }

  const durationMs = Date.now() - startMs;

  // Extract Sandpack preview URL from the iframe
  // Sandpack renders an iframe with class "sp-preview-iframe" pointing to a *.csb.app URL
  let previewUrl: string | undefined;
  try {
    const iframe = page.locator("iframe.sp-preview-iframe").first();
    if (await iframe.isVisible({ timeout: 5_000 }).catch(() => false)) {
      previewUrl = await iframe.getAttribute("src") || undefined;
      if (previewUrl) console.log(`[preview] ${previewUrl}`);
    }
  } catch {}

  // Report final result
  await reportBotRun(workerUrl, {
    id: runId, status: finalStatus, projectUrl, previewUrl,
    durationMs, filesChanged: filesText, creditsUsed: creditsText,
    completedAt: new Date().toISOString(),
    error: finalStatus === "failed" ? "Generation failed" : undefined,
  });

  console.log(`\n✓ Run ${runId} — ${finalStatus} in ${(durationMs / 60_000).toFixed(1)} min`);
  console.log(`  Project: ${projectUrl}`);

  expect(finalStatus).not.toBe("timeout");
});
