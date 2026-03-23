/**
 * worker/src/ai/file-parser.ts
 *
 * Parses AI-generated responses to extract individual files from
 * <file path="...">content</file> XML-style tags.
 *
 * The AI model outputs code wrapped in these tags, and this parser
 * extracts the file path and content from each block. It handles
 * common edge cases like:
 * - Empty files (valid — some files may be intentionally blank)
 * - Nested XML-like syntax inside JSX code
 * - Files with special characters in paths
 * - Responses with no <file> tags (just explanation text)
 * - Incomplete tags from truncated AI responses
 *
 * The regex pattern uses a non-greedy match to handle multiple
 * file blocks in a single response without them consuming each other.
 *
 * Used by: worker/src/routes/chat.ts (after AI response completes)
 */

import type { ProjectFile } from "../types/project";

/**
 * Regex pattern to match <file path="...">content</file> blocks.
 *
 * Breakdown:
 * - <file\s+path="  — opening tag with path attribute
 * - ([^"]+)         — capture group 1: the file path (everything inside quotes)
 * - ">\n?           — closing quote, >, and optional newline
 * - ([\s\S]*?)      — capture group 2: file content (non-greedy, matches across lines)
 * - \n?<\/file>     — optional newline before closing tag
 *
 * The 'g' flag finds all matches in the response.
 */
const FILE_TAG_REGEX = /<file\s+path="([^"]+)">\n?([\s\S]*?)\n?<\/file>/g;

/**
 * Strips markdown code fences from file content if present.
 * Removes the opening ```lang line (if first line) and closing ``` line (if last line).
 * Uses a line-based approach for robustness.
 *
 * @param content - Raw file content that may be wrapped in ``` fences
 * @returns Clean code without markdown fences
 */
function stripMarkdownFences(content: string): string {
  const lines = content.split("\n");

  // Strip opening fence if first line matches ```lang or ```
  if (lines.length > 0 && /^\s*```[a-zA-Z]*\s*$/.test(lines[0])) {
    lines.shift();
  }

  // Strip trailing empty lines, then closing fence
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  if (lines.length > 0 && /^\s*```\s*$/.test(lines[lines.length - 1])) {
    lines.pop();
  }

  return lines.join("\n");
}

/**
 * Parses an AI response string to extract all file blocks.
 * Returns an array of ProjectFile objects with path and content.
 *
 * If the AI response contains no <file> tags, returns an empty array.
 * This can happen if the AI only provides explanatory text without code.
 *
 * @param response - The full AI response text (may include explanation + code)
 * @returns Array of extracted files with their paths and contents
 *
 * @example
 * ```typescript
 * const response = `Here's the code:
 *
 * <file path="src/App.tsx">
 * export default function App() {
 *   return <div>Hello</div>;
 * }
 * </file>`;
 *
 * const files = parseFilesFromResponse(response);
 * // [{ path: "src/App.tsx", content: "export default function App()..." }]
 * ```
 */
export function parseFilesFromResponse(response: string): ProjectFile[] {
  const files: ProjectFile[] = [];

  // Reset regex lastIndex to ensure we start from the beginning
  // (needed because we reuse the regex with the 'g' flag)
  FILE_TAG_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = FILE_TAG_REGEX.exec(response)) !== null) {
    const path = match[1].trim();
    let content = match[2];

    // Strip markdown code fences that the AI sometimes adds inside <file> tags.
    // E.g., ```typescript\n...\n``` → just the inner code.
    content = stripMarkdownFences(content);

    // Validate the file path — must be a relative path, no traversal
    if (isValidFilePath(path)) {
      files.push({ path, content });
    }
  }

  return files;
}

/**
 * Validates a file path from an AI response.
 * Prevents path traversal attacks and ensures paths are relative.
 *
 * Rules:
 * - Must not be empty
 * - Must not start with / (absolute paths)
 * - Must not contain .. (directory traversal)
 * - Must not contain backslashes (Windows paths)
 * - Must be a reasonable length (under 256 characters)
 *
 * @param filePath - The file path to validate
 * @returns true if the path is safe to use
 */
export function isValidFilePath(filePath: string): boolean {
  if (!filePath || filePath.length === 0) {
    return false;
  }

  // Block absolute paths
  if (filePath.startsWith("/")) {
    return false;
  }

  // Block directory traversal
  if (filePath.includes("..")) {
    return false;
  }

  // Block Windows-style paths
  if (filePath.includes("\\")) {
    return false;
  }

  // Block unreasonably long paths
  if (filePath.length > 256) {
    return false;
  }

  return true;
}

/**
 * Merges newly generated files with existing project files.
 * New files override existing ones at the same path.
 * Existing files not in the new set are preserved (the AI only
 * outputs files that changed — unchanged files stay as-is).
 *
 * @param existingFiles - Current project files
 * @param newFiles - Files from the AI response (only changed files)
 * @returns Complete merged file list
 */
export function mergeFiles(
  existingFiles: ProjectFile[],
  newFiles: ProjectFile[]
): ProjectFile[] {
  // Build a map from existing files for O(1) lookups
  const fileMap = new Map<string, ProjectFile>();

  for (const file of existingFiles) {
    fileMap.set(file.path, file);
  }

  // Override or add files from the AI response
  for (const file of newFiles) {
    fileMap.set(file.path, file);
  }

  // Convert back to array, sorted by path for consistency
  return Array.from(fileMap.values()).sort((a, b) =>
    a.path.localeCompare(b.path)
  );
}

/**
 * Extracts the explanation text from an AI response (everything outside <file> tags).
 * This is useful for displaying the AI's explanation in the chat panel
 * without the raw code blocks.
 *
 * @param response - The full AI response text
 * @returns The explanation text with <file> blocks removed and trimmed
 */
export function extractExplanation(response: string): string {
  return response
    .replace(FILE_TAG_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
