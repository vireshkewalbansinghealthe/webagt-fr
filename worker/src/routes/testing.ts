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
// ADMIN ONLY
// ---------------------------------------------------------------------------

/**
 * List all submissions and feedback (Admin only).
 */
testingRoutes.get("/admin/results", async (c) => {
  // adminMiddleware already ran
  const [submissionIds, feedbackIds] = await Promise.all([
    c.env.METADATA.get<string[]>("testing:submissions", "json") || [],
    c.env.METADATA.get<string[]>("testing:feedback_list", "json") || [],
  ]);

  const [submissions, feedback] = await Promise.all([
    Promise.all((submissionIds || []).slice(0, 100).map(id => c.env.METADATA.get<TestSubmission>(`testing:submission:${id}`, "json"))),
    Promise.all((feedbackIds || []).slice(0, 100).map(id => c.env.METADATA.get<StandaloneFeedback>(`testing:feedback:${id}`, "json"))),
  ]);

  return c.json({
    submissions: submissions.filter(Boolean),
    feedback: feedback.filter(Boolean),
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
