/**
 * fly-chat/src/ai/file-selector.ts
 *
 * Smart file context selection — instead of sending ALL project files
 * to the main AI on every request, we run a fast Haiku pre-pass to
 * identify which files are actually relevant to the user's prompt.
 *
 * Cost impact:
 *   Before: color change → 46K tokens cacheWrite + 3.6K output = $0.23
 *   After:  color change → ~4K tokens cacheWrite + 3.6K output = $0.07
 *
 * When selection is SKIPPED (all files sent):
 *   - New project (no existing files)
 *   - Very small project (≤ 4 files)
 *   - Full rebuild/redesign keywords detected in prompt
 *   - Haiku selector call fails (graceful fallback)
 */

import { generateText } from "ai";
import { getModel } from "./providers/index";
import type { ProjectFile } from "../types/project";
import type { Env } from "../types";

/** Keywords that indicate a full rebuild — send all files */
const FULL_REBUILD_PATTERNS = [
  /\brebuild\b/i,
  /\bredo\b/i,
  /\bredesign\b/i,
  /\bstart over\b/i,
  /\bfrom scratch\b/i,
  /\bcompletely (redo|rebuild|redesign|change|new)\b/i,
  /\bnew (design|style|look|theme|layout)\b/i,
  /\bhele website\b/i,
  /\bvolledig\b/i,
  /\bopnieuw\b/i,
  /\bhelemaal\b/i,
  /\bnew project\b/i,
  /\boverall (style|design|theme)\b/i,
];

/** Files that are almost always needed for any edit */
const ALWAYS_INCLUDE_PATHS = new Set([
  "src/App.tsx",
  "src/app.tsx",
]);

export function isFullRebuildRequest(prompt: string): boolean {
  return FULL_REBUILD_PATTERNS.some((p) => p.test(prompt));
}

export interface FileSelectorResult {
  selectedFiles: ProjectFile[];
  /** All file paths in the project (for context even if content not included) */
  allPaths: string[];
  /** Whether we ran selection or sent everything */
  mode: "selected" | "all";
  /** Number of tokens saved vs sending all files (rough estimate) */
  tokensSaved: number;
}

/**
 * Selects which project files are relevant for the given user prompt.
 * Runs a cheap Haiku pre-pass (~100 input / ~50 output tokens).
 */
export async function selectRelevantFiles(
  userPrompt: string,
  existingFiles: ProjectFile[],
  env: Env
): Promise<FileSelectorResult> {
  const allPaths = existingFiles.map((f) => f.path);
  const totalFiles = existingFiles.length;

  // ── Skip selection: no files or tiny project ──────────────────────────────
  if (totalFiles === 0) {
    return { selectedFiles: [], allPaths: [], mode: "all", tokensSaved: 0 };
  }
  if (totalFiles <= 4) {
    return { selectedFiles: existingFiles, allPaths, mode: "all", tokensSaved: 0 };
  }

  // ── Skip selection: full rebuild keywords ─────────────────────────────────
  if (isFullRebuildRequest(userPrompt)) {
    console.log(`[file-selector] Full rebuild detected — sending all ${totalFiles} files`);
    return { selectedFiles: existingFiles, allPaths, mode: "all", tokensSaved: 0 };
  }

  // ── Run Haiku file selector ────────────────────────────────────────────────
  try {
    const t = Date.now();
    const result = await generateText({
      model: getModel("claude-haiku-4-5", env),
      messages: [
        {
          role: "user",
          content: `You are a file router for a React/TypeScript project.

Project files (${totalFiles} total):
${allPaths.join("\n")}

User request: "${userPrompt}"

Which files need their FULL CONTENT sent to the AI to fulfill this request?
Rules:
- Include files that need to be MODIFIED
- Include files that are IMPORTED by modified files (direct imports only)
- Include config files if styles/theme are changing (tailwind.config.js, src/index.css)
- If this is a complete redesign or touches most of the app, reply with just: ALL
- Reply with ONLY the file paths (one per line), nothing else`,
        },
      ],
      maxOutputTokens: 256,
    });

    const elapsed = Date.now() - t;
    const text = result.text.trim();
    console.log(`[file-selector] Haiku responded in ${elapsed}ms: ${text.slice(0, 120)}`);

    if (text.toUpperCase() === "ALL" || text.toUpperCase().startsWith("ALL")) {
      return { selectedFiles: existingFiles, allPaths, mode: "all", tokensSaved: 0 };
    }

    // Parse paths from response
    const rawPaths = new Set(
      text
        .split("\n")
        .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, "").replace(/`/g, ""))
        .filter((l) => l.length > 0 && l.includes("/") || l.includes(".tsx") || l.includes(".ts") || l.includes(".css") || l.includes(".json"))
    );

    // Always include core files
    for (const p of ALWAYS_INCLUDE_PATHS) {
      if (allPaths.includes(p)) rawPaths.add(p);
    }

    const selected = existingFiles.filter((f) => rawPaths.has(f.path));

    if (selected.length === 0) {
      console.log(`[file-selector] No files matched — falling back to all`);
      return { selectedFiles: existingFiles, allPaths, mode: "all", tokensSaved: 0 };
    }

    // Estimate token savings (avg ~250 tokens/file content, rough)
    const skippedCount = totalFiles - selected.length;
    const avgTokensPerFile = existingFiles.reduce((s, f) => s + Math.ceil(f.content.length / 4), 0) / totalFiles;
    const tokensSaved = Math.round(skippedCount * avgTokensPerFile);

    console.log(`[file-selector] Selected ${selected.length}/${totalFiles} files — ~${tokensSaved} tokens saved`);
    return { selectedFiles: selected, allPaths, mode: "selected", tokensSaved };

  } catch (err: any) {
    console.error(`[file-selector] Haiku call failed (${err.message}) — falling back to all files`);
    return { selectedFiles: existingFiles, allPaths, mode: "all", tokensSaved: 0 };
  }
}
