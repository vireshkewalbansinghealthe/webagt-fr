/**
 * worker/src/routes/projects.ts
 *
 * Hono router for project CRUD operations.
 * All routes are protected by auth middleware (applied in index.ts).
 *
 * Endpoints:
 * - GET    /api/projects      — List all projects for the authenticated user
 * - GET    /api/projects/:id  — Get a single project by ID (with ownership check)
 * - POST   /api/projects      — Create a new project (generates starter files)
 * - PATCH  /api/projects/:id  — Update project name or model
 * - DELETE /api/projects/:id  — Delete a project and all its files
 *
 * Data storage:
 * - KV `project:{id}` — Project metadata (name, model, timestamps)
 * - KV `user-projects:{userId}` — Array of project IDs for the user
 * - R2 `{projectId}/v{version}/files.json` — Version file snapshots
 *
 * Used by: worker/src/index.ts (mounted at /api/projects)
 */

import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Env, AppVariables } from "../types";
import type { Project, Version } from "../types/project";
import { createInitialVersion } from "../ai/default-project";
import { getCredits, FREE_PROJECT_LIMIT } from "../services/credits";
import { sanitizeProjectName } from "../services/sanitize";

import { createTursoDatabase, createWebshopSchema } from "../services/turso";

/**
 * Create a Hono router with typed bindings and variables.
 * The auth middleware sets `c.var.userId` before these handlers run.
 */
const projectRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// GET /api/projects — List all projects for the authenticated user
// ---------------------------------------------------------------------------

/**
 * Reads the user's project ID list from KV, then batch-fetches
 * each project's metadata. Returns projects sorted by most recently updated.
 */
projectRoutes.get("/", async (c) => {
  const userId = c.var.userId;

  // Read the user's project ID list from KV
  const projectIds = await c.env.METADATA.get<string[]>(
    `user-projects:${userId}`,
    "json"
  );

  if (!projectIds || projectIds.length === 0) {
    return c.json({ projects: [] });
  }

  // Batch-fetch all project metadata in parallel
  const projects = await Promise.all(
    projectIds.map((id) =>
      c.env.METADATA.get<Project>(`project:${id}`, "json")
    )
  );

  // Filter out any null results (deleted or corrupted) and sort by updatedAt
  const validProjects = projects
    .filter((project): project is Project => project !== null)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

  return c.json({ projects: validProjects });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id — Get a single project by ID
// ---------------------------------------------------------------------------

/**
 * Fetches a single project from KV and verifies the requesting user owns it.
 * Returns 404 if not found, 403 if owned by another user.
 */
projectRoutes.get("/:id", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

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

  return c.json({ project });
});

// ---------------------------------------------------------------------------
// POST /api/projects — Create a new project
// ---------------------------------------------------------------------------

/**
 * Creates a new project with:
 * 1. A unique nanoid
 * 2. Project metadata stored in KV
 * 3. The user's project ID list updated in KV
 * 4. Starter template files stored in R2 as version 0
 *
 * Request body: { name: string; model: string; description?: string }
 */
projectRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{
    name: string;
    model: string;
    description?: string;
    type?: "website" | "webshop";
  }>();

  // Validate and sanitize project name
  const sanitizedName = sanitizeProjectName(body.name || "");
  if (!sanitizedName) {
    return c.json(
      { error: "Project name is required", code: "VALIDATION_ERROR" },
      400
    );
  }

  // Check project count limit for free users
  const credits = await getCredits(userId, c.env);
  if (credits.plan === "free") {
    const existingIds = await c.env.METADATA.get<string[]>(
      `user-projects:${userId}`,
      "json"
    );
    const projectCount = existingIds?.length ?? 0;

    if (projectCount >= FREE_PROJECT_LIMIT) {
      return c.json(
        {
          error: `Free plan is limited to ${FREE_PROJECT_LIMIT} projects. Upgrade to Pro for unlimited projects.`,
          code: "PROJECT_LIMIT_REACHED",
          limit: FREE_PROJECT_LIMIT,
          current: projectCount,
        },
        403
      );
    }
  }

  const projectId = nanoid(12);
  const now = new Date().toISOString();
  
  let databaseUrl = undefined;
  let databaseToken = undefined;

  // Provision Turso database if it's a webshop
  if (body.type === "webshop") {
    try {
      // Use nanoid prefix so db name starts with a letter, avoids invalid db name errors
      const dbName = `shop-${projectId.substring(0, 8).toLowerCase()}`;
      console.log(`Attempting to provision Turso database: ${dbName}`);
      const tursoDb = await createTursoDatabase(c.env, dbName);
      
      console.log(`Turso database provisioned successfully: ${tursoDb.url}`);
      databaseUrl = tursoDb.url;
      databaseToken = tursoDb.token;

      if (databaseUrl && databaseToken) {
        console.log(`Executing default shop schema on ${databaseUrl}`);
        // Seed it with the default shop schema
        // Wait a moment for DB to be completely available across edge before executing schema
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          await createWebshopSchema(databaseUrl, databaseToken);
          console.log(`Finished executing default shop schema on ${databaseUrl}`);
        } catch (schemaErr) {
          console.error(`[Project Create] Failed to execute shop schema on ${databaseUrl}:`, schemaErr);
        }
      } else {
        console.log(`Skipping schema execution as DB provisioning returned empty token.`);
      }
    } catch (e: any) {
      console.error("[Project Create] Failed to provision Turso database", e);
      // Don't fail project creation if DB provisioning fails completely, just log it
      // Users can still build a shop, they just won't have a working Turso DB instance
    }
  }

  // Create the project metadata
  const project: Project = {
    id: projectId,
    userId,
    name: sanitizedName,
    model: body.model || "gpt-4o-mini",
    type: body.type || "website",
    databaseUrl,
    databaseToken,
    currentVersion: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Create the initial version with starter template files
  let backendUrl = new URL(c.req.url).origin;
  if (backendUrl.includes("localhost") || backendUrl.includes("127.0.0.1")) {
    backendUrl = "https://maistro.website";
  }

  const initialVersion = createInitialVersion(
    project.name,
    projectId,
    project.model,
    project.type,
    databaseUrl && databaseToken ? { url: databaseUrl, token: databaseToken } : undefined,
    c.env.STRIPE_PUBLISHABLE_KEY || "",
    backendUrl
  );

  // Store everything in parallel: KV metadata + R2 files + user index update
  const existingIds = await c.env.METADATA.get<string[]>(
    `user-projects:${userId}`,
    "json"
  );
  const updatedIds = [projectId, ...(existingIds ?? [])];

  await Promise.all([
    // Store project metadata in KV
    c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project)),

    // Update the user's project list in KV
    c.env.METADATA.put(
      `user-projects:${userId}`,
      JSON.stringify(updatedIds)
    ),

    // Store initial version files in R2
    c.env.FILES.put(
      `${projectId}/v0/files.json`,
      JSON.stringify(initialVersion)
    ),
  ]);

  return c.json({ project }, 201);
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/files — Get current version files
// ---------------------------------------------------------------------------

/**
 * Fetches the files from the project's current version stored in R2.
 * Returns the Version object which includes the files array.
 * Used by the editor page to load project files into Sandpack and Monaco.
 */
projectRoutes.get("/:id/files", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

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

  // Read the current version files from R2
  const versionKey = `${projectId}/v${project.currentVersion}/files.json`;
  const versionObject = await c.env.FILES.get(versionKey);

  if (!versionObject) {
    return c.json(
      { error: "Version files not found", code: "NOT_FOUND" },
      404
    );
  }

  const version = (await versionObject.json()) as {
    files: Array<{ path: string; content: string }>;
  };

  return c.json({ files: version.files, version: project.currentVersion });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/public-files — Get current version files for Coolify
// ---------------------------------------------------------------------------

/**
 * Fetches the raw files JSON for the project's current version.
 * This route is public but requires a deployToken query parameter to match the project's deployToken.
 */
projectRoutes.get("/:id/public-files", async (c) => {
  const projectId = c.req.param("id");
  const token = c.req.query("token");

  if (!token) {
    return c.json({ error: "Deploy token required", code: "UNAUTHORIZED" }, 401);
  }

  const project = await c.env.METADATA.get<Project>(
    `project:${projectId}`,
    "json"
  );

  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  if (project.deployToken !== token) {
    return c.json({ error: "Invalid deploy token", code: "FORBIDDEN" }, 403);
  }

  const versionKey = `${projectId}/v${project.currentVersion}/files.json`;
  const versionObject = await c.env.FILES.get(versionKey);

  if (!versionObject) {
    return c.json({ error: "Version files not found", code: "NOT_FOUND" }, 404);
  }

  // Return the raw JSON directly
  return new Response(versionObject.body, {
    headers: { "Content-Type": "application/json" }
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/projects/:id — Update a project
// ---------------------------------------------------------------------------

/**
 * Updates a project's name and/or model.
 * Only the project owner can update it.
 *
 * Request body: { name?: string; model?: string }
 */
projectRoutes.patch("/:id", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

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

  const body = await c.req.json<{ name?: string; model?: string; stripePaymentMethods?: string[] }>();

  // Apply updates
  if (body.name) {
    const sanitized = sanitizeProjectName(body.name);
    if (sanitized) project.name = sanitized;
  }
  if (body.model) {
    project.model = body.model;
  }
  if (body.stripePaymentMethods) {
    project.stripePaymentMethods = body.stripePaymentMethods;
  }
  project.updatedAt = new Date().toISOString();

  // Persist updated metadata
  await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));

  return c.json({ project });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:id/sync-stripe — Force sync Stripe configuration to files
// ---------------------------------------------------------------------------

/**
 * Generates/updates src/lib/stripe.ts in the project files.
 * The generated file calls the Worker API for checkout (no secrets on the tenant).
 */
projectRoutes.post("/:id/sync-stripe", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project) return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  if (project.userId !== userId) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  if (!project.stripeAccountId) return c.json({ error: "No Stripe account connected", code: "STRIPE_NOT_CONNECTED" }, 400);

  const versionKey = `${projectId}/v${project.currentVersion}/files.json`;
  const versionObject = await c.env.FILES.get(versionKey);
  if (!versionObject) return c.json({ error: "Version files not found", code: "NOT_FOUND" }, 404);

  const version = (await versionObject.json()) as Version;
  const files = version.files || [];

  let workerUrl = new URL(c.req.url).origin;
  if (workerUrl.includes("localhost") || workerUrl.includes("127.0.0.1")) {
    workerUrl = "https://api-webagt.dock.4esh.nl";
  }
  const stripeKey = c.env.STRIPE_PUBLISHABLE_KEY || "";

  const stripeTsContent = `import { loadStripe } from '@stripe/stripe-js';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || '${workerUrl}';
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '${stripeKey}';
const PROJECT_ID = import.meta.env.VITE_PROJECT_ID || '${projectId}';

export const stripePromise = loadStripe(STRIPE_KEY);

const isSandbox = typeof window !== 'undefined' && window.parent !== window;

export async function createCheckoutSession(amount: number, productName: string, successUrl?: string, cancelUrl?: string): Promise<string | null> {
  const response = await fetch(\`\${WORKER_URL}/api/stripe/checkout_sessions\`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: PROJECT_ID,
      amount: Math.round(amount * 100),
      currency: 'eur',
      productName,
      successUrl: successUrl || window.location.origin + '/success',
      cancelUrl: cancelUrl || window.location.origin + '/cart',
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Failed to initialize checkout');
  }

  if (isSandbox) {
    window.open(data.url, '_blank');
    return null;
  }
  return data.url;
}
`;

  const stripeTsPath = "src/lib/stripe.ts";
  const existingIndex = files.findIndex(f => f.path === stripeTsPath);
  if (existingIndex !== -1) {
    files[existingIndex].content = stripeTsContent;
  } else {
    files.push({ path: stripeTsPath, content: stripeTsContent });
  }

  const nextVersionNumber = project.currentVersion + 1;
  const now = new Date().toISOString();

  const newVersion: Version = {
    versionNumber: nextVersionNumber,
    prompt: "Synced Stripe configuration",
    model: project.model,
    files: files,
    changedFiles: [stripeTsPath],
    type: "manual",
    createdAt: now,
    fileCount: files.length,
  };

  project.currentVersion = nextVersionNumber;
  project.updatedAt = now;

  await Promise.all([
    c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project)),
    c.env.FILES.put(`${projectId}/v${nextVersionNumber}/files.json`, JSON.stringify(newVersion))
  ]);

  return c.json({ project, version: nextVersionNumber });
});

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id — Delete a project
// ---------------------------------------------------------------------------

/**
 * Deletes a project by:
 * 1. Removing project metadata from KV
 * 2. Removing chat history from KV
 * 3. Removing the project ID from the user's project list
 * 4. Deleting all version files from R2
 *
 * Only the project owner can delete it.
 */
projectRoutes.delete("/:id", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

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

  // Remove project ID from the user's list
  const existingIds = await c.env.METADATA.get<string[]>(
    `user-projects:${userId}`,
    "json"
  );
  const updatedIds = (existingIds ?? []).filter((id) => id !== projectId);

  // Delete all R2 objects for this project (all versions)
  const r2Objects = await c.env.FILES.list({ prefix: `${projectId}/` });
  const deletePromises = r2Objects.objects.map((object) =>
    c.env.FILES.delete(object.key)
  );

  await Promise.all([
    // Delete project metadata from KV
    c.env.METADATA.delete(`project:${projectId}`),

    // Delete chat history from KV
    c.env.METADATA.delete(`chat:${projectId}`),

    // Update user's project list
    c.env.METADATA.put(
      `user-projects:${userId}`,
      JSON.stringify(updatedIds)
    ),

    // Delete all R2 files
    ...deletePromises,
  ]);

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:id/thumbnail — Save project thumbnail
// ---------------------------------------------------------------------------

projectRoutes.post("/:id/thumbnail", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(
    `project:${projectId}`,
    "json"
  );

  if (!project) return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  if (project.userId !== userId) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);

  const body = await c.req.json<{ thumbnail: string }>().catch(() => null);
  if (!body?.thumbnail) return c.json({ error: "Missing thumbnail", code: "VALIDATION_ERROR" }, 400);

  // Store in R2 as a text file containing the base64 data URL
  await c.env.FILES.put(`${projectId}/thumbnail.txt`, body.thumbnail);

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/thumbnail — Get project thumbnail
// ---------------------------------------------------------------------------

projectRoutes.get("/:id/thumbnail", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(
    `project:${projectId}`,
    "json"
  );

  if (!project) return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  if (project.userId !== userId) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);

  const file = await c.env.FILES.get(`${projectId}/thumbnail.txt`);
  if (!file) return c.json({ thumbnail: null });

  const thumbnail = await file.text();
  return c.json({ thumbnail });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:id/publish — Deploy to Coolify
// ---------------------------------------------------------------------------
projectRoutes.post("/:id/publish", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");

  if (!project) return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  if (project.userId !== userId) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);

  const COOLIFY_API_KEY = c.env.COOLIFY_API_KEY;
  const COOLIFY_URL = c.env.COOLIFY_URL || "https://dock.4esh.nl";

  if (!COOLIFY_API_KEY) {
    return c.json({ error: "Deployment environment variables missing. Add them to .dev.vars or env.", code: "SERVER_ERROR" }, 500);
  }

  try {
    const body = await c.req.json<{ customDomain?: string }>().catch(() => ({ customDomain: undefined }));
    const customDomain = body.customDomain;

    const res = await c.env.FILES.get(`${projectId}/v${project.currentVersion}/files.json`);
    const filesData = await res?.json<{ files: any[] }>();
    const files = filesData?.files || [];
    
    if (files.length === 0) return c.json({ error: "No files to publish", code: "NOT_FOUND" }, 400);

    const githubHeaders = {
      Authorization: `token ${c.env.DEPLOYMENT_GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "WebAGT-Deployer"
    };
    const repo = c.env.DEPLOYMENT_REPO || "vireshkewalbansinghealthe/web-agt-deployments";
    const branchName = `agt-${projectId.substring(0, 8)}`;
    
    // 1. Get repo info to find default branch
    const repoRes = await fetch(`https://api.github.com/repos/${repo}`, { headers: githubHeaders });
    if (!repoRes.ok) {
      const errTxt = await repoRes.text();
      throw new Error(`Could not access repository on GitHub: ${errTxt}`);
    }
    const repoData = await repoRes.json() as any;
    const defaultBranch = repoData.default_branch || "main";

    // 2. Get base branch ref
    const refRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${defaultBranch}`, { headers: githubHeaders });
    if (!refRes.ok) {
      const errTxt = await refRes.text();
      throw new Error(`Could not find branch ${defaultBranch} on GitHub: ${errTxt}`);
    }
    const refData = await refRes.json() as any;
    const baseTreeSha = refData.object.sha;

    // 3. Create Tree
    const tree = [];
    
    // Explicitly remove package-lock.json from the base tree so it doesn't conflict with our generated package.json
    tree.push({
      path: "package-lock.json",
      mode: "100644",
      type: "blob",
      sha: null
    });

    let hasIndexHtml = false;
    let hasViteConfig = false;

    for (const f of files) {
      if (f.path.includes('node_modules/') || f.path.includes('.git/')) continue;
      
      if (f.path === "index.html" || f.path === "public/index.html") hasIndexHtml = true;
      if (f.path === "vite.config.ts" || f.path === "vite.config.js") hasViteConfig = true;
      
      let content = f.content;
      if (f.path === "package.json") {
        try {
          const pkg = JSON.parse(content);
          pkg.scripts = pkg.scripts || {};
          if (!pkg.scripts.dev) pkg.scripts.dev = "vite --host 0.0.0.0 --port 3000";
          if (!pkg.scripts.build) pkg.scripts.build = "vite build";
          if (!pkg.scripts.start) pkg.scripts.start = "vite preview --host 0.0.0.0 --port 3000";

          pkg.devDependencies = pkg.devDependencies || {};
          if (!pkg.devDependencies["vite"]) pkg.devDependencies["vite"] = "^5.0.0";
          if (!pkg.devDependencies["@vitejs/plugin-react"]) pkg.devDependencies["@vitejs/plugin-react"] = "^4.2.0";
          if (!pkg.devDependencies["tailwindcss"]) pkg.devDependencies["tailwindcss"] = "^3.4.1";
          if (!pkg.devDependencies["postcss"]) pkg.devDependencies["postcss"] = "^8.4.35";
          if (!pkg.devDependencies["autoprefixer"]) pkg.devDependencies["autoprefixer"] = "^10.4.17";
          
          content = JSON.stringify(pkg, null, 2);
        } catch (e) {
          // Ignore parse errors
        }
      }

      if (f.path === "vite.config.ts" || f.path === "vite.config.js") {
        if (content.includes("defineConfig({") && !content.includes("allowedHosts")) {
            content = content.replace("defineConfig({", "defineConfig({ server: { allowedHosts: true }, ");
        }
      }

      tree.push({
        path: f.path,
        mode: "100644",
        type: "blob",
        content: content
      });
    }

    if (!hasIndexHtml) {
      tree.push({
        path: "index.html",
        mode: "100644",
        type: "blob",
        content: `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>Web AGT App</title>\n</head>\n<body>\n<div id="root"></div>\n<script type="module" src="/src/index.tsx"></script>\n</body>\n</html>`
      });
    }

    if (!hasViteConfig) {
      tree.push({
        path: "vite.config.ts",
        mode: "100644",
        type: "blob",
        content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({\n  plugins: [react()],\n  server: {\n    allowedHosts: true\n  }\n})`
      });
    }

    // Ensure postcss.config.mjs exists for Tailwind v3
    tree.push({
      path: "postcss.config.mjs",
      mode: "100644",
      type: "blob",
      content: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } }`
    });

    // Ensure tailwind.config.js exists for Tailwind v3
    tree.push({
      path: "tailwind.config.js",
      mode: "100644",
      type: "blob",
      content: `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}`
    });

    // Add Dockerfile for Coolify to build the app using npm run dev
    tree.push({
      path: "Dockerfile",
      mode: "100644",
      type: "blob",
      content: `FROM node:22-bullseye-slim\nWORKDIR /app\nCOPY . .\nENV PRISMA_SKIP_POSTINSTALL_GENERATE=true\nRUN npm install --no-audit --no-fund --legacy-peer-deps\nEXPOSE 3000\nCMD ["npm", "run", "dev"]`
    });

    const treeRes = await fetch(`https://api.github.com/repos/${repo}/git/trees`, {
      method: "POST",
      headers: githubHeaders,
      body: JSON.stringify({ base_tree: baseTreeSha, tree })
    });
    if (!treeRes.ok) {
        const errTxt = await treeRes.text();
        throw new Error(`Failed to create git tree: ${errTxt}`);
    }
    const treeData = await treeRes.json() as any;

    // 4. Create Commit
    const commitRes = await fetch(`https://api.github.com/repos/${repo}/git/commits`, {
      method: "POST",
      headers: githubHeaders,
      body: JSON.stringify({
        message: `Deploy project ${projectId} to ${branchName}`,
        tree: treeData.sha,
        parents: [baseTreeSha]
      })
    });
    const commitData = await commitRes.json() as any;

    // 5. Update or Create Branch
    let branchRes = await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branchName}`, { headers: githubHeaders });
    if (branchRes.ok) {
      await fetch(`https://api.github.com/repos/${repo}/git/refs/heads/${branchName}`, {
        method: "PATCH",
        headers: githubHeaders,
        body: JSON.stringify({ sha: commitData.sha, force: true })
      });
    } else {
      await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
        method: "POST",
        headers: githubHeaders,
        body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commitData.sha })
      });
    }

    const COOLIFY_PROJECT_UUID = 'e4o4k0kg0cowscwkok8ogooo';
    const COOLIFY_SERVER_UUID = 'q4kk4kssos4ws8swo00gsco8';
    const COOLIFY_DESTINATION_UUID = 'l4s8wckscw00gkg88c0ckwss';
    const COOLIFY_GITHUB_APP_UUID = 'lwo0cg4kswsg0k8wsk8k4ok0'; // From web-agt settings
    const coolifyHeaders = {
      "Authorization": `Bearer ${COOLIFY_API_KEY}`,
      "Content-Type": "application/json"
    };

    const subdomain = `agt-${projectId.substring(0, 8)}`;
    const domain = customDomain || `${subdomain}.dock.4esh.nl`;

    let appUuid = project.deployment_uuid;
    
    // Validate if the app exists on Coolify. If it doesn't (was deleted manually or via script), nullify appUuid
    if (appUuid) {
      const checkRes = await fetch(`${COOLIFY_URL}/api/v1/applications/${appUuid}`, {
        headers: coolifyHeaders
      });
      if (!checkRes.ok) {
        appUuid = undefined; // App is gone, we must recreate it
      } else {
        const checkData = await checkRes.json() as any;
        if (checkData.build_pack !== "dockerfile") {
            // Force reset it if somehow it's still wrong
            await fetch(`${COOLIFY_URL}/api/v1/applications/${appUuid}`, {
                method: "PATCH", headers: coolifyHeaders,
                body: JSON.stringify({ 
                  build_pack: "dockerfile", 
                  ports_exposes: "3000"
                })
            });
        }
      }
    }
    
    if (!appUuid) {
      const createRes = await fetch(`${COOLIFY_URL}/api/v1/applications/private-github-app`, {
        method: "POST", headers: coolifyHeaders,
        body: JSON.stringify({
          project_uuid: COOLIFY_PROJECT_UUID,
          server_uuid: COOLIFY_SERVER_UUID,
          destination_uuid: COOLIFY_DESTINATION_UUID,
          environment_name: "production",
          name: subdomain,
          github_app_uuid: COOLIFY_GITHUB_APP_UUID,
          git_repository: repo,
          git_branch: branchName,
          build_pack: "dockerfile",
          ports_exposes: "3000"
        })
      });
      if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`Failed to create Coolify app: ${err}`);
      }
      const newApp = await createRes.json() as any;
      appUuid = newApp.uuid;

      // Update to set dockerfile specifically in patch too just in case
      await fetch(`${COOLIFY_URL}/api/v1/applications/${appUuid}`, {
        method: "PATCH", headers: coolifyHeaders,
        body: JSON.stringify({
          build_pack: "dockerfile",
          git_repository: repo,
          git_branch: branchName,
          ports_exposes: "3000",
          domains: `https://${domain}`
        })
      });

      project.deployment_uuid = appUuid;
      await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));
    } else {
      await fetch(`${COOLIFY_URL}/api/v1/applications/${appUuid}`, {
        method: "PATCH", headers: coolifyHeaders,
        body: JSON.stringify({
          build_pack: "dockerfile",
          git_repository: repo,
          git_branch: branchName,
          ports_exposes: "3000",
          domains: `https://${domain}`
        })
      });
    }

    // Set environment variables on the Coolify app
    // Checkout is handled by the Worker API, so no Stripe secrets needed on the tenant
    let workerUrl = new URL(c.req.url).origin;
    if (workerUrl.includes("localhost") || workerUrl.includes("127.0.0.1")) {
      workerUrl = "https://api-webagt.dock.4esh.nl";
    }

    const envVars: { key: string; value: string; is_build_time?: boolean }[] = [
      { key: "VITE_PROJECT_ID", value: projectId },
      { key: "VITE_WORKER_URL", value: workerUrl },
      { key: "VITE_STRIPE_PUBLISHABLE_KEY", value: c.env.STRIPE_PUBLISHABLE_KEY || "" },
    ];

    try {
      await fetch(`${COOLIFY_URL}/api/v1/applications/${appUuid}/envs/bulk`, {
        method: "PATCH", headers: coolifyHeaders,
        body: JSON.stringify({
          data: envVars.map(e => ({
            key: e.key,
            value: e.value,
            is_build_time: e.is_build_time ?? false,
            is_preview: false,
          }))
        })
      });
    } catch (envErr) {
      console.warn("Failed to set env vars on Coolify (non-fatal):", envErr);
    }

    const deployRes = await fetch(`${COOLIFY_URL}/api/v1/deploy`, {
      method: "POST", headers: coolifyHeaders,
      body: JSON.stringify({ uuid: appUuid })
    });
    
    if (!deployRes.ok) {
        const errTxt = await deployRes.text();
        throw new Error(`Failed to trigger deployment: ${errTxt}`);
    }
    
    const deployData = await deployRes.json() as any;
    const deploymentUuid = deployData?.deployments?.[0]?.deployment_uuid || null;

    return c.json({ success: true, url: `https://${domain}`, deploymentUuid });
  } catch (error: any) {
    console.error("Publish error:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/deployment/:deploymentUuid — Get Coolify deployment status
// ---------------------------------------------------------------------------
projectRoutes.get("/:id/deployment/:deploymentUuid", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");
  const deploymentUuid = c.req.param("deploymentUuid");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");

  if (!project) return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  if (project.userId !== userId) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);

  const COOLIFY_API_KEY = c.env.COOLIFY_API_KEY;
  const COOLIFY_URL = c.env.COOLIFY_URL || "https://dock.4esh.nl";

  if (!COOLIFY_API_KEY) {
    return c.json({ error: "Deployment environment variables missing.", code: "SERVER_ERROR" }, 500);
  }

  try {
    const res = await fetch(`${COOLIFY_URL}/api/v1/deployments/${deploymentUuid}`, {
      headers: {
        "Authorization": `Bearer ${COOLIFY_API_KEY}`,
        "Accept": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error("Failed to fetch deployment status");
    }

    const data = await res.json() as any;
    return c.json({ 
      status: data.status, // "in_progress", "finished", "failed"
      logs: data.logs // This is a JSON string of log objects in Coolify v4
    });
  } catch (error: any) {
    console.error("Deployment status error:", error);
    return c.json({ error: error.message }, 500);
  }
});

export { projectRoutes };
