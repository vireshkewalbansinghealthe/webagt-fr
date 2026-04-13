#!/usr/bin/env npx tsx
/**
 * Load Test Script — Concurrent Project Generation
 *
 * Simulates multiple users generating projects at the same time.
 * Uses real Clerk auth tokens and the actual API endpoints.
 *
 * Usage:
 *   npx tsx scripts/load-test.ts --token <CLERK_SESSION_TOKEN> --concurrent 5
 *   npx tsx scripts/load-test.ts --token <TOKEN> --concurrent 10 --target https://webagt-worker-dev.webagt.workers.dev
 *
 * Options:
 *   --token, -t       Clerk session JWT (required)
 *   --concurrent, -c  Number of concurrent generations (default: 3)
 *   --target          Worker URL (default: http://localhost:8787)
 *   --type            Project type: webshop | website (default: webshop)
 *   --cleanup         Delete test projects after completion (default: true)
 *   --timeout         Max wait per generation in seconds (default: 600)
 */

const PROMPTS = [
  "Make me a modern webshop for selling handmade candles with a warm cozy aesthetic",
  "Create a plant shop with a lush green theme and 8 realistic products",
  "Build a sneaker store with a dark streetwear vibe and product filtering",
  "Design a coffee bean webshop with a minimalist brown/cream palette",
  "Make a pet accessories store with playful colors and a slide-out cart",
  "Create a vintage vinyl record shop with a retro 70s design",
  "Build a luxury watch store with an elegant black and gold theme",
  "Design a bakery webshop with pastels and a warm homey feel",
  "Make a tech gadgets store with a futuristic neon design",
  "Create a bookshop with a cozy library aesthetic and reading lists",
  "Build a fitness supplement store with a bold sporty design",
  "Design a jewelry shop with an elegant rose gold theme",
  "Make a craft beer webshop with a rustic brewery aesthetic",
  "Create a skincare products store with a clean minimal design",
  "Build a toy store with bright colors and fun animations",
  "Design a wine shop with an elegant burgundy and cream palette",
  "Make a surf gear webshop with ocean blues and beach vibes",
  "Create a organic grocery store with earth tones and fresh produce",
  "Build a guitar shop with a rock-and-roll theme",
  "Design a flower delivery webshop with soft watercolor aesthetics",
];

// ---------------------------------------------------------------------------

interface GenerationResult {
  id: number;
  projectId: string | null;
  projectName: string;
  prompt: string;
  status: "success" | "failed" | "timeout" | "rate_limited";
  startedAt: number;
  completedAt: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
  apiCostUsd: number;
  filesGenerated: number;
  error?: string;
  events: string[];
}

interface Stats {
  total: number;
  succeeded: number;
  failed: number;
  rateLimited: number;
  timedOut: number;
  totalDurationMs: number;
  avgDurationMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCreditsUsed: number;
  totalApiCostUsd: number;
  totalFiles: number;
}

// ---------------------------------------------------------------------------

function parseArgs(): { token: string; concurrent: number; target: string; type: string; cleanup: boolean; timeout: number } {
  const args = process.argv.slice(2);
  let token = "";
  let concurrent = 3;
  let target = "http://localhost:8787";
  let type = "webshop";
  let cleanup = true;
  let timeout = 600;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--token": case "-t": token = args[++i]; break;
      case "--concurrent": case "-c": concurrent = parseInt(args[++i], 10); break;
      case "--target": target = args[++i]; break;
      case "--type": type = args[++i]; break;
      case "--no-cleanup": cleanup = false; break;
      case "--timeout": timeout = parseInt(args[++i], 10); break;
    }
  }

  if (!token) {
    console.error("❌ --token is required. Get it from browser DevTools → Application → Cookies → __session");
    process.exit(1);
  }

  return { token, concurrent, target, type, cleanup, timeout };
}

function log(id: number, msg: string) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`  [${ts}] #${String(id).padStart(2, "0")} ${msg}`);
}

function statusLine(results: GenerationResult[]) {
  const running = results.filter(r => r.status === "success" && r.durationMs === 0).length;
  const done = results.filter(r => r.durationMs > 0).length;
  const failed = results.filter(r => r.status === "failed" || r.status === "rate_limited").length;
  process.stdout.write(`\r  ⏳ Running: ${running}  ✅ Done: ${done}  ❌ Failed: ${failed}  `);
}

// ---------------------------------------------------------------------------

async function createProject(
  target: string,
  token: string,
  name: string,
  type: string,
): Promise<{ id: string; name: string }> {
  const res = await fetch(`${target}/api/projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, model: "claude-sonnet-4-6", type }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Create project failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { project: { id: string; name: string } };
  return data.project;
}

async function generateProject(
  target: string,
  token: string,
  projectId: string,
  prompt: string,
  timeoutMs: number,
): Promise<{
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
  apiCostUsd: number;
  filesGenerated: number;
  events: string[];
  error?: string;
}> {
  const events: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;
  let creditsUsed = 0;
  let apiCostUsd = 0;
  let filesGenerated = 0;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${target}/api/chat/${projectId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: prompt }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      return { inputTokens, outputTokens, creditsUsed, apiCostUsd, filesGenerated, events, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          const eventType = line.slice(7).trim();
          events.push(eventType);
        }
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.files) {
              filesGenerated = data.files.length;
            }
            if (data.tokenUsage) {
              inputTokens = data.tokenUsage.inputTokens || 0;
              outputTokens = data.tokenUsage.outputTokens || 0;
              creditsUsed = data.tokenUsage.creditsUsed || 0;
              apiCostUsd = data.tokenUsage.costUsd || 0;
            }
            if (data.creditsRemaining !== undefined) {
              // done event
            }
            if (data.code) {
              return { inputTokens, outputTokens, creditsUsed, apiCostUsd, filesGenerated, events, error: `${data.code}: ${data.message}` };
            }
          } catch {
            // not JSON data line
          }
        }
      }
    }

    return { inputTokens, outputTokens, creditsUsed, apiCostUsd, filesGenerated, events };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { inputTokens, outputTokens, creditsUsed, apiCostUsd, filesGenerated, events, error: "TIMEOUT" };
    }
    return { inputTokens, outputTokens, creditsUsed, apiCostUsd, filesGenerated, events, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function deleteProject(target: string, token: string, projectId: string) {
  await fetch(`${target}/api/projects/${projectId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// ---------------------------------------------------------------------------

async function runGeneration(
  id: number,
  target: string,
  token: string,
  prompt: string,
  type: string,
  timeoutSec: number,
): Promise<GenerationResult> {
  const name = `loadtest-${id}-${Date.now().toString(36)}`;
  const startedAt = Date.now();

  const result: GenerationResult = {
    id,
    projectId: null,
    projectName: name,
    prompt: prompt.slice(0, 60) + "...",
    status: "failed",
    startedAt,
    completedAt: 0,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    creditsUsed: 0,
    apiCostUsd: 0,
    filesGenerated: 0,
    events: [],
  };

  try {
    log(id, `Creating project "${name}"...`);
    const project = await createProject(target, token, name, type);
    result.projectId = project.id;
    log(id, `Created ${project.id} — sending prompt...`);

    const gen = await generateProject(target, token, project.id, prompt, timeoutSec * 1000);
    result.completedAt = Date.now();
    result.durationMs = result.completedAt - startedAt;
    result.inputTokens = gen.inputTokens;
    result.outputTokens = gen.outputTokens;
    result.creditsUsed = gen.creditsUsed;
    result.apiCostUsd = gen.apiCostUsd;
    result.filesGenerated = gen.filesGenerated;
    result.events = gen.events;

    if (gen.error) {
      if (gen.error === "TIMEOUT") {
        result.status = "timeout";
        log(id, `⏰ TIMEOUT after ${(result.durationMs / 1000).toFixed(1)}s`);
      } else if (gen.error.includes("RATE_LIMITED") || gen.error.includes("429")) {
        result.status = "rate_limited";
        log(id, `🚫 RATE LIMITED: ${gen.error}`);
      } else {
        result.status = "failed";
        result.error = gen.error;
        log(id, `❌ FAILED: ${gen.error}`);
      }
    } else {
      result.status = "success";
      log(id, `✅ Done — ${gen.filesGenerated} files, ${gen.inputTokens}↑ ${gen.outputTokens}↓, ${gen.creditsUsed} cr, $${gen.apiCostUsd.toFixed(4)}, ${(result.durationMs / 1000).toFixed(1)}s`);
    }
  } catch (err: any) {
    result.completedAt = Date.now();
    result.durationMs = result.completedAt - startedAt;
    result.error = err.message;
    log(id, `❌ ERROR: ${err.message}`);
  }

  return result;
}

// ---------------------------------------------------------------------------

function printReport(results: GenerationResult[]) {
  const stats: Stats = {
    total: results.length,
    succeeded: results.filter(r => r.status === "success").length,
    failed: results.filter(r => r.status === "failed").length,
    rateLimited: results.filter(r => r.status === "rate_limited").length,
    timedOut: results.filter(r => r.status === "timeout").length,
    totalDurationMs: results.reduce((s, r) => s + r.durationMs, 0),
    avgDurationMs: results.reduce((s, r) => s + r.durationMs, 0) / results.length,
    totalInputTokens: results.reduce((s, r) => s + r.inputTokens, 0),
    totalOutputTokens: results.reduce((s, r) => s + r.outputTokens, 0),
    totalCreditsUsed: results.reduce((s, r) => s + r.creditsUsed, 0),
    totalApiCostUsd: results.reduce((s, r) => s + r.apiCostUsd, 0),
    totalFiles: results.reduce((s, r) => s + r.filesGenerated, 0),
  };

  console.log("\n" + "═".repeat(70));
  console.log("  LOAD TEST REPORT");
  console.log("═".repeat(70));

  console.log(`
  Concurrency:      ${stats.total} simultaneous generations
  ─────────────────────────────────────────────
  ✅ Succeeded:     ${stats.succeeded}/${stats.total} (${((stats.succeeded / stats.total) * 100).toFixed(0)}%)
  ❌ Failed:        ${stats.failed}
  🚫 Rate Limited:  ${stats.rateLimited}
  ⏰ Timed Out:     ${stats.timedOut}
  `);

  console.log("  TIMING");
  console.log("  ─────────────────────────────────────────────");
  const successful = results.filter(r => r.status === "success");
  if (successful.length > 0) {
    const durations = successful.map(r => r.durationMs / 1000).sort((a, b) => a - b);
    console.log(`  Fastest:          ${durations[0].toFixed(1)}s`);
    console.log(`  Slowest:          ${durations[durations.length - 1].toFixed(1)}s`);
    console.log(`  Average:          ${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(1)}s`);
    console.log(`  Median:           ${durations[Math.floor(durations.length / 2)].toFixed(1)}s`);
  }

  console.log(`
  TOKEN USAGE
  ─────────────────────────────────────────────
  Total Input:       ${stats.totalInputTokens.toLocaleString()} tokens
  Total Output:      ${stats.totalOutputTokens.toLocaleString()} tokens
  Input TPM peak:    ~${stats.totalInputTokens.toLocaleString()} (all in first minute)
  Output TPM peak:   ~${Math.round(stats.totalOutputTokens / Math.max(1, stats.avgDurationMs / 60000)).toLocaleString()}/min

  COST
  ─────────────────────────────────────────────
  Total API Cost:    $${stats.totalApiCostUsd.toFixed(4)}
  Total Credits:     ${stats.totalCreditsUsed}
  Avg Cost/Gen:      $${(stats.totalApiCostUsd / Math.max(1, stats.succeeded)).toFixed(4)}
  Avg Credits/Gen:   ${Math.round(stats.totalCreditsUsed / Math.max(1, stats.succeeded))}

  FILES
  ─────────────────────────────────────────────
  Total Generated:   ${stats.totalFiles} files
  Avg Files/Gen:     ${Math.round(stats.totalFiles / Math.max(1, stats.succeeded))}
`);

  console.log("  INDIVIDUAL RESULTS");
  console.log("  ─────────────────────────────────────────────");
  console.log("  #   Status       Duration  In Tokens  Out Tokens  Credits  Cost      Files");
  console.log("  " + "─".repeat(85));
  for (const r of results) {
    const icon = r.status === "success" ? "✅" : r.status === "rate_limited" ? "🚫" : r.status === "timeout" ? "⏰" : "❌";
    const dur = r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}s` : "-";
    console.log(
      `  ${String(r.id).padStart(2)}  ${icon} ${r.status.padEnd(12)} ${dur.padStart(8)}  ${String(r.inputTokens).padStart(9)}  ${String(r.outputTokens).padStart(10)}  ${String(r.creditsUsed).padStart(7)}  $${r.apiCostUsd.toFixed(4).padStart(7)}  ${String(r.filesGenerated).padStart(5)}`
    );
    if (r.error) {
      console.log(`       └─ ${r.error.slice(0, 80)}`);
    }
  }

  if (stats.rateLimited > 0) {
    console.log(`
  ⚠️  RATE LIMIT WARNING
  ─────────────────────────────────────────────
  ${stats.rateLimited} out of ${stats.total} requests were rate-limited by Anthropic.
  Consider: upgrading your Anthropic tier, adding request queuing,
  or adding multi-provider fallback (Gemini, OpenAI).
`);
  }

  console.log("═".repeat(70));
}

// ---------------------------------------------------------------------------

async function main() {
  const { token, concurrent, target, type, cleanup, timeout } = parseArgs();

  console.log("\n" + "═".repeat(70));
  console.log("  WEBAGT LOAD TEST");
  console.log("═".repeat(70));
  console.log(`  Target:        ${target}`);
  console.log(`  Concurrent:    ${concurrent}`);
  console.log(`  Type:          ${type}`);
  console.log(`  Timeout:       ${timeout}s per generation`);
  console.log(`  Cleanup:       ${cleanup ? "yes" : "no"}`);
  console.log("═".repeat(70) + "\n");

  // Verify token works
  console.log("  🔐 Verifying auth token...");
  const creditsRes = await fetch(`${target}/api/credits`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!creditsRes.ok) {
    console.error("  ❌ Token invalid or worker not reachable. Check your --token and --target.");
    process.exit(1);
  }
  const credits = await creditsRes.json() as { remaining: number };
  console.log(`  ✅ Token valid — ${credits.remaining} credits remaining`);

  const estimatedCost = concurrent * 10;
  if (credits.remaining < estimatedCost) {
    console.warn(`  ⚠️  Warning: ${credits.remaining} credits may not be enough for ${concurrent} generations (~${estimatedCost} credits estimated)`);
  }

  // Pick random prompts
  const selectedPrompts = Array.from({ length: concurrent }, (_, i) =>
    PROMPTS[i % PROMPTS.length]
  );

  console.log(`\n  🚀 Launching ${concurrent} concurrent generations...\n`);
  const globalStart = Date.now();

  // Fire all at once
  const promises = selectedPrompts.map((prompt, i) =>
    runGeneration(i + 1, target, token, prompt, type, timeout)
  );

  const results = await Promise.all(promises);
  const totalTime = Date.now() - globalStart;

  console.log(`\n  ⏱️  Total wall time: ${(totalTime / 1000).toFixed(1)}s\n`);

  printReport(results);

  // Cleanup
  if (cleanup) {
    const projectIds = results.filter(r => r.projectId).map(r => r.projectId!);
    if (projectIds.length > 0) {
      console.log(`\n  🧹 Cleaning up ${projectIds.length} test projects...`);
      await Promise.all(projectIds.map(id => deleteProject(target, token, id)));
      console.log("  ✅ Cleanup complete\n");
    }
  }
}

main().catch(console.error);
