/**
 * worker/src/routes/export.ts
 *
 * ZIP export endpoint for downloading a project as a standalone app.
 * Fetches the current version files from R2, generates config files
 * (package.json, tsconfig, Tailwind, Vite, etc.), and bundles
 * everything into a ZIP using fflate.
 *
 * The exported project is a working Vite + React + TypeScript + Tailwind
 * app that can be run with `npm install && npm run dev`.
 *
 * Export is gated behind the Pro plan — free users get a 403.
 *
 * Endpoint:
 * - GET /api/projects/:id/export — download ZIP binary
 *
 * Used by: worker/src/index.ts (mounted at /api/projects/:id/export)
 */

import { Hono } from "hono";
import { zipSync, strToU8 } from "fflate";
import type { Env, AppVariables } from "../types";
import type { Project, Version } from "../types/project";
import { getCredits } from "../services/credits";

/**
 * Create a Hono router for the export endpoint.
 * Auth middleware is applied by the parent app in index.ts.
 */
const exportRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// GET /api/projects/:id/export — Download project as ZIP
// ---------------------------------------------------------------------------

/**
 * Generates and returns a ZIP file containing the full project.
 * Includes all user files from the current version plus generated
 * config files for a working Vite + React + Tailwind setup.
 *
 * Response: application/zip binary with Content-Disposition header.
 */
exportRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  // --- 1. Verify project exists and belongs to user ---
  const project = await c.env.METADATA.get<Project>(
    `project:${projectId}`,
    "json"
  );

  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  if (project.userId !== userId) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  // --- 2. Check Pro plan requirement ---
  const credits = await getCredits(userId, c.env);
  if (credits.plan === "free") {
    return c.json(
      {
        error: "Export requires a Pro plan. Upgrade to download your projects.",
        code: "EXPORT_PRO_ONLY",
      },
      403
    );
  }

  // --- 3. Fetch current version files from R2 ---
  const versionKey = `${projectId}/v${project.currentVersion}/files.json`;
  const versionObject = await c.env.FILES.get(versionKey);

  if (!versionObject) {
    return c.json(
      { error: "Version files not found", code: "NOT_FOUND" },
      404
    );
  }

  const versionData = (await versionObject.json()) as Version;
  const projectFiles = versionData.files || [];

  // --- 4. Build the ZIP file structure ---
  const slugName = slugify(project.name);

  /**
   * Collect all files for the ZIP.
   * Keys are file paths relative to the project root.
   * Values are Uint8Array content (fflate requires binary).
   */
  const zipFiles: Record<string, Uint8Array> = {};

  // Add user project files
  for (const file of projectFiles) {
    zipFiles[`${slugName}/${file.path}`] = strToU8(file.content);
  }

  // Add generated config files
  zipFiles[`${slugName}/package.json`] = strToU8(
    generatePackageJson(slugName)
  );
  zipFiles[`${slugName}/tsconfig.json`] = strToU8(generateTsConfig());
  zipFiles[`${slugName}/tailwind.config.js`] = strToU8(
    generateTailwindConfig()
  );
  zipFiles[`${slugName}/postcss.config.js`] = strToU8(
    generatePostCssConfig()
  );
  zipFiles[`${slugName}/vite.config.ts`] = strToU8(generateViteConfig());
  zipFiles[`${slugName}/public/index.html`] = strToU8(
    generateIndexHtml(project.name)
  );
  zipFiles[`${slugName}/README.md`] = strToU8(generateReadme(project.name));

  // --- 5. Create the ZIP and return it ---
  const zipped = zipSync(zipFiles);

  return new Response(zipped.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slugName}.zip"`,
      "Cache-Control": "no-cache",
    },
  });
});

// ---------------------------------------------------------------------------
// Helper: Slugify project name for folder/file naming
// ---------------------------------------------------------------------------

/**
 * Converts a project name to a URL/filesystem-safe slug.
 * "My Todo App" → "my-todo-app"
 *
 * @param name - The original project name
 * @returns A lowercase, hyphenated slug
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "project";
}

// ---------------------------------------------------------------------------
// Helper: Generate package.json
// ---------------------------------------------------------------------------

/**
 * Generates a package.json for a Vite + React + TypeScript + Tailwind project.
 *
 * @param name - The slugified project name
 * @returns JSON string for package.json
 */
function generatePackageJson(name: string): string {
  const pkg = {
    name,
    private: true,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
    dependencies: {
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "lucide-react": "^0.460.0",
      "date-fns": "^4.1.0",
      recharts: "^2.15.0",
      "framer-motion": "^11.15.0",
    },
    devDependencies: {
      "@types/react": "^18.3.0",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.0",
      autoprefixer: "^10.4.19",
      postcss: "^8.4.38",
      tailwindcss: "^3.4.3",
      typescript: "^5.4.5",
      vite: "^5.2.11",
    },
  };

  return JSON.stringify(pkg, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// Helper: Generate tsconfig.json
// ---------------------------------------------------------------------------

/**
 * Generates a standard TypeScript config for React.
 *
 * @returns JSON string for tsconfig.json
 */
function generateTsConfig(): string {
  const config = {
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      isolatedModules: true,
      moduleDetection: "force",
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      noFallthroughCasesInSwitch: true,
      baseUrl: ".",
      paths: {
        "@/*": ["./src/*"],
      },
    },
    include: ["src"],
  };

  return JSON.stringify(config, null, 2) + "\n";
}

// ---------------------------------------------------------------------------
// Helper: Generate tailwind.config.js
// ---------------------------------------------------------------------------

/**
 * Generates a Tailwind CSS configuration.
 *
 * @returns JavaScript string for tailwind.config.js
 */
function generateTailwindConfig(): string {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {},
  },
  plugins: [],
};
`;
}

// ---------------------------------------------------------------------------
// Helper: Generate postcss.config.js
// ---------------------------------------------------------------------------

/**
 * Generates PostCSS config with Tailwind and Autoprefixer plugins.
 *
 * @returns JavaScript string for postcss.config.js
 */
function generatePostCssConfig(): string {
  return `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;
}

// ---------------------------------------------------------------------------
// Helper: Generate vite.config.ts
// ---------------------------------------------------------------------------

/**
 * Generates a Vite config with React plugin and path aliases.
 *
 * @returns TypeScript string for vite.config.ts
 */
function generateViteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
`;
}

// ---------------------------------------------------------------------------
// Helper: Generate public/index.html
// ---------------------------------------------------------------------------

/**
 * Generates the HTML entry point with a root div.
 *
 * @param projectName - Display name for the page title
 * @returns HTML string for public/index.html
 */
function generateIndexHtml(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`;
}

// ---------------------------------------------------------------------------
// Helper: Generate README.md
// ---------------------------------------------------------------------------

/**
 * Generates a README with project name and setup instructions.
 *
 * @param projectName - Display name of the project
 * @returns Markdown string for README.md
 */
function generateReadme(projectName: string): string {
  return `# ${projectName}

Built with [Web AGT](https://webagt.nl) — AI-powered web app builder.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

3. Open http://localhost:5173 in your browser.

## Tech Stack

- React 18 + TypeScript
- Tailwind CSS
- Vite (bundler)
`;
}

export { exportRoutes };
