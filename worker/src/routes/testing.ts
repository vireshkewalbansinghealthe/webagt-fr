/**
 * worker/src/routes/testing.ts
 *
 * Hono router for the public test form and admin tracking.
 * Stores structured test results, bug reports, and improvement suggestions in KV.
 */

import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Env, AppVariables } from "../types";

const testingRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

interface TestItemResult {
  testId: string;
  category: string;
  testCase: string;
  status: "working" | "not_working" | "skipped";
  bugReport?: string;
  screenshot?: string; // base64 JPEG data URL
}

interface TestSubmission {
  id: string;
  testNumber?: string;
  userId: string;
  userName: string;
  userEmail: string;
  results: TestItemResult[];
  submittedAt: string;
}

interface StandaloneFeedback {
  id: string;
  type: "bug" | "improvement";
  userId: string;
  userName: string;
  userEmail: string;
  content: string;
  screenshot?: string; // base64 JPEG data URL
  status: "pending" | "fixed" | "wont_fix" | "planned";
  submittedAt: string;
  fixedAt?: string;
}

// ---------------------------------------------------------------------------
// PUBLIC (Logged in users)
// ---------------------------------------------------------------------------

/**
 * Submit a full test run (structured from spreadsheet).
 */
testingRoutes.post("/submit", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{ testNumber?: string; results: TestItemResult[]; userName: string; userEmail: string }>();
  
  const id = nanoid();
  const submission: TestSubmission = {
    id,
    testNumber: body.testNumber,
    userId,
    userName: body.userName,
    userEmail: body.userEmail,
    results: body.results,
    submittedAt: new Date().toISOString(),
  };

  // Save to KV
  await c.env.METADATA.put(`testing:submission:${id}`, JSON.stringify(submission));
  
  // Update submission list index
  const existingList = await c.env.METADATA.get<string[]>("testing:submissions", "json") || [];
  await c.env.METADATA.put("testing:submissions", JSON.stringify([id, ...existingList]));

  return c.json({ success: true, id });
});

/**
 * Submit a standalone bug or improvement.
 */
testingRoutes.post("/feedback", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{ type: "bug" | "improvement"; content: string; screenshot?: string; userName: string; userEmail: string }>();
  
  const id = nanoid();
  const feedback: StandaloneFeedback = {
    id,
    type: body.type,
    userId,
    userName: body.userName,
    userEmail: body.userEmail,
    content: body.content,
    screenshot: body.screenshot,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };

  // Save to KV
  await c.env.METADATA.put(`testing:feedback:${id}`, JSON.stringify(feedback));
  
  // Update feedback list index
  const existingList = await c.env.METADATA.get<string[]>("testing:feedback_list", "json") || [];
  await c.env.METADATA.put("testing:feedback_list", JSON.stringify([id, ...existingList]));

  return c.json({ success: true, id });
});

// ---------------------------------------------------------------------------
// BOT TEST RUNS (E2E automation — no auth required, uses API key)
// ---------------------------------------------------------------------------

export interface BotTestRun {
  id: string;
  status: "running" | "passed" | "failed" | "timeout";
  projectName: string;
  projectUrl: string;     // e.g. https://webagt.ai/project/abc123
  previewUrl?: string;    // live preview URL if available
  sector: string;
  prompt: string;
  userEmail: string;
  durationMs?: number;
  filesChanged?: string;
  creditsUsed?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

/**
 * POST /api/testing/bot-run — Submit or update a bot test run result.
 * Called by Playwright E2E tests after each run completes.
 */
testingRoutes.post("/bot-run", async (c) => {
  const body = await c.req.json<Partial<BotTestRun> & { id: string }>();

  const existing = await c.env.METADATA.get<BotTestRun>(`testing:bot-run:${body.id}`, "json");

  const run: BotTestRun = existing
    ? { ...existing, ...body }
    : {
        id: body.id!,
        status: body.status || "running",
        projectName: body.projectName || "",
        projectUrl: body.projectUrl || "",
        previewUrl: body.previewUrl,
        sector: body.sector || "",
        prompt: body.prompt || "",
        userEmail: body.userEmail || "",
        durationMs: body.durationMs,
        filesChanged: body.filesChanged,
        creditsUsed: body.creditsUsed,
        error: body.error,
        startedAt: body.startedAt || new Date().toISOString(),
        completedAt: body.completedAt,
      };

  await c.env.METADATA.put(`testing:bot-run:${run.id}`, JSON.stringify(run));

  // Update index (prepend new, skip duplicates)
  const ids = (await c.env.METADATA.get<string[]>("testing:bot-runs", "json")) || [];
  if (!ids.includes(run.id)) {
    await c.env.METADATA.put("testing:bot-runs", JSON.stringify([run.id, ...ids]));
  }

  return c.json({ success: true, id: run.id });
});

/**
 * POST /api/testing/ensure-credits — Top up credits for E2E test accounts only.
 * Hardcoded to the 3 test user IDs. Rejects all other users.
 */
const TEST_USER_IDS = new Set([
  "user_3BvSIKf5Lg448ZoIuqnORV4jxkm",
  "user_3BvSIKNS6oW59jmUAys8gYgUGcj",
  "user_3BvSIOOxYbPAZv5U3LudsrWVu5k",
]);

testingRoutes.post("/ensure-credits", async (c) => {
  const { userId, min } = await c.req.json<{ userId: string; min: number }>();

  if (!TEST_USER_IDS.has(userId)) {
    return c.json({ error: "Not a test account" }, 403);
  }

  const stored = await c.env.METADATA.get<any>(`credits:${userId}`, "json");
  const remaining = stored?.remaining ?? 0;

  if (remaining >= min) {
    return c.json({ topped: false, remaining });
  }

  const now = new Date();
  const tomorrow = new Date(now.getTime() + 86400000);
  const updated = {
    remaining: 500,
    total: 500,
    plan: "pro",
    periodStart: now.toISOString(),
    periodEnd: tomorrow.toISOString(),
  };

  await c.env.METADATA.put(`credits:${userId}`, JSON.stringify(updated));
  return c.json({ topped: true, remaining: 500 });
});

/**
 * POST /api/testing/sign-in-token — Create a Clerk sign-in token for a test account.
 * Returns a URL that logs the user in directly, bypassing MFA / new-device verification.
 */
testingRoutes.post("/sign-in-token", async (c) => {
  const { userId } = await c.req.json<{ userId: string }>();

  if (!TEST_USER_IDS.has(userId)) {
    return c.json({ error: "Not a test account" }, 403);
  }

  const secretKey = c.env.CLERK_SECRET_KEY;
  if (!secretKey) return c.json({ error: "CLERK_SECRET_KEY not configured" }, 500);

  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
  });

  if (!res.ok) {
    const text = await res.text();
    return c.json({ error: `Clerk error: ${text}` }, 500);
  }

  const data = await res.json<{ url: string; token: string }>();
  return c.json({ url: data.url });
});

// ---------------------------------------------------------------------------
// ADMIN ONLY
// ---------------------------------------------------------------------------

/**
 * List all submissions and feedback (Admin only).
 */
testingRoutes.get("/admin/results", async (c) => {
  const [submissionIds, feedbackIds, botRunIds] = await Promise.all([
    c.env.METADATA.get<string[]>("testing:submissions", "json") || [],
    c.env.METADATA.get<string[]>("testing:feedback_list", "json") || [],
    c.env.METADATA.get<string[]>("testing:bot-runs", "json") || [],
  ]);

  const [submissions, feedback, botRuns] = await Promise.all([
    Promise.all((submissionIds || []).slice(0, 100).map(id => c.env.METADATA.get<TestSubmission>(`testing:submission:${id}`, "json"))),
    Promise.all((feedbackIds || []).slice(0, 100).map(id => c.env.METADATA.get<StandaloneFeedback>(`testing:feedback:${id}`, "json"))),
    Promise.all((botRunIds || []).slice(0, 200).map(id => c.env.METADATA.get<BotTestRun>(`testing:bot-run:${id}`, "json"))),
  ]);

  return c.json({
    submissions: submissions.filter(Boolean),
    feedback: feedback.filter(Boolean),
    botRuns: botRuns.filter(Boolean),
  });
});

/**
 * Update feedback status (fixed, planned, etc.).
 */
testingRoutes.patch("/admin/feedback/:id", async (c) => {
  const { id } = c.req.param();
  const { status } = await c.req.json<{ status: StandaloneFeedback["status"] }>();
  
  const feedback = await c.env.METADATA.get<StandaloneFeedback>(`testing:feedback:${id}`, "json");
  if (!feedback) return c.json({ error: "Feedback not found" }, 404);

  feedback.status = status;
  if (status === "fixed") feedback.fixedAt = new Date().toISOString();
  
  await c.env.METADATA.put(`testing:feedback:${id}`, JSON.stringify(feedback));
  return c.json({ success: true, feedback });
});

export { testingRoutes };
