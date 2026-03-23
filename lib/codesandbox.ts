/**
 * lib/codesandbox.ts
 *
 * Utility to open project files as a live preview via CodeSandbox.
 * Creates a sandbox using the CodeSandbox define API (with json=1)
 * to get the sandbox ID, then opens the live preview URL directly
 * at https://{id}.csb.app/ — skipping the CodeSandbox editor entirely.
 *
 * Uses the CodeSandbox "define" API:
 * 1. Normalize file paths (strip "src/" prefix)
 * 2. Inject public/index.html with Tailwind CDN
 * 3. Compress the files object with lz-string
 * 4. POST to codesandbox.io/api/v1/sandboxes/define?json=1
 * 5. Open the returned sandbox_id as {id}.csb.app
 *
 * Used by: components/editor/editor-header.tsx
 */

import { compressToBase64 } from "lz-string";

/** CodeSandbox define API endpoint */
const CSB_DEFINE_URL = "https://codesandbox.io/api/v1/sandboxes/define";

/**
 * Compresses a parameters object into a URL-safe base64 string.
 * Mirrors Sandpack's internal getParameters() function.
 *
 * @param parameters - Object containing files and optional template
 * @returns URL-safe compressed string for the CodeSandbox API
 */
function getParameters(
  parameters: Record<string, unknown>
): string {
  return compressToBase64(JSON.stringify(parameters))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * HTML template for CodeSandbox that includes the Tailwind CDN script.
 * In our Sandpack preview, Tailwind is loaded via the `externalResources`
 * option. CodeSandbox doesn't have that mechanism, so we inject an
 * index.html that loads the CDN script directly.
 */
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;

/**
 * Opens the given project files as a live CodeSandbox preview.
 * POSTs to the define API with json=1 to get the sandbox ID,
 * then opens https://{sandbox_id}.csb.app/ directly.
 *
 * File path handling:
 * - "src/App.tsx" → "App.tsx" (strip src/ prefix)
 * - "package.json" → "package.json" (keep as-is)
 * - Injects public/index.html with Tailwind CDN for styling
 *
 * @param files - Record of file paths to content strings
 * @returns The live preview URL (https://{id}.csb.app/)
 * @throws Error if the API call fails
 */
export async function openInCodeSandbox(
  files: Record<string, string>
): Promise<string> {
  // Normalize files into CodeSandbox format
  const normalizedFiles: Record<
    string,
    { content: string; isBinary: boolean }
  > = {};

  for (const [path, content] of Object.entries(files)) {
    // Strip "src/" prefix — CodeSandbox expects "App.tsx" not "src/App.tsx"
    const normalizedPath = path.startsWith("src/")
      ? path.slice(4)
      : path;
    normalizedFiles[normalizedPath] = { content, isBinary: false };
  }

  // Inject index.html with Tailwind CDN so styles load in CodeSandbox
  normalizedFiles["public/index.html"] = {
    content: INDEX_HTML,
    isBinary: false,
  };

  const parameters = getParameters({
    files: normalizedFiles,
    template: "create-react-app-typescript",
  });

  // POST with json=1 to get the sandbox ID back instead of a redirect
  const response = await fetch(`${CSB_DEFINE_URL}?json=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ parameters }),
  });

  if (!response.ok) {
    throw new Error(`CodeSandbox API error: ${response.status}`);
  }

  const data = (await response.json()) as { sandbox_id: string };
  const previewUrl = `https://${data.sandbox_id}.csb.app/`;

  window.open(previewUrl, "_blank", "noopener,noreferrer");

  return previewUrl;
}
