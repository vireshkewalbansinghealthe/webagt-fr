/**
 * worker/src/routes/versions.ts
 *
 * Hono router for version history endpoints.
 * All routes are protected by auth middleware (applied in index.ts).
 *
 * Endpoints:
 * - GET    /api/projects/:id/versions        — List all versions with metadata
 * - GET    /api/projects/:id/versions/:v      — Get files for a specific version
 * - GET    /api/projects/:id/versions/:v1/diff/:v2 — Get diff between two versions
 * - POST   /api/projects/:id/versions/:v/restore  — Restore a previous version
 * - POST   /api/projects/:id/versions         — Save a manual edit as a new version
 *
 * Version data is stored in R2 at `{projectId}/v{version}/files.json`.
 * Each version file contains the full Version object including files array,
 * version metadata, and the prompt that generated it.
 *
 * Used by: worker/src/index.ts (mounted at /api/projects)
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import type {
  Project,
  ProjectFile,
  Version,
  VersionMeta,
} from "../types/project";
import type { ChatMessage, ChatSession } from "../types/chat";

/**
 * Create a Hono router with typed bindings and variables.
 * The auth middleware sets `c.var.userId` before these handlers run.
 */
const versionRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// Helper: Verify project ownership
// ---------------------------------------------------------------------------

/**
 * Fetches a project from KV and verifies the requesting user owns it.
 * Returns the project if valid, or null with an error response.
 *
 * @param projectId - The project ID to look up
 * @param userId - The authenticated user's ID
 * @param env - Worker environment bindings
 * @returns The project if owned by the user, null otherwise
 */
async function getOwnedProject(
  projectId: string,
  userId: string,
  env: Env,
): Promise<Project | null> {
  const project = await env.METADATA.get<Project>(
    `project:${projectId}`,
    "json",
  );

  if (!project || project.userId !== userId) {
    return null;
  }

  return project;
}

/**
 * Extracts version metadata from a full Version object.
 * Strips the files array to create a lightweight VersionMeta
 * suitable for the timeline listing.
 *
 * @param version - Full version object from R2
 * @returns VersionMeta without files array
 */
function toVersionMeta(version: Version): VersionMeta {
  return {
    versionNumber: version.versionNumber,
    type: version.type,
    prompt: version.prompt,
    model: version.model,
    createdAt: version.createdAt,
    fileCount: version.fileCount ?? version.files?.length ?? 0,
    changedFiles: version.changedFiles,
    restoredFrom: version.restoredFrom,
  };
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id/versions — List all versions with metadata
// ---------------------------------------------------------------------------

/**
 * Returns metadata for all versions of a project, sorted newest first.
 * Scans R2 for all version objects under the project prefix,
 * fetches each one, and strips the files array to keep the response lean.
 *
 * Response: { versions: VersionMeta[], currentVersion: number }
 */
versionRoutes.get("/", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id")!;

  const project = await getOwnedProject(projectId, userId, c.env);
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  // Fetch all version objects from R2 in parallel
  // We know versions are numbered 0..currentVersion
  const versionPromises: Promise<Version | null>[] = [];

  for (let v = 0; v <= project.currentVersion; v++) {
    versionPromises.push(
      c.env.FILES.get(`${projectId}/v${v}/files.json`)
        .then((obj) => (obj ? (obj.json() as Promise<Version>) : null))
        .catch(() => null),
    );
  }

  const versions = await Promise.all(versionPromises);

  // Convert to metadata (no files array) and sort newest first
  const versionMetas: VersionMeta[] = versions
    .filter((v): v is Version => v !== null)
    .map(toVersionMeta)
    .sort((a, b) => b.versionNumber - a.versionNumber);

  return c.json({
    versions: versionMetas,
    currentVersion: project.currentVersion,
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/versions/:v — Get files for a specific version
// ---------------------------------------------------------------------------

/**
 * Returns the full file contents for a specific version.
 * Used when the user clicks a version in the timeline to preview it.
 *
 * Response: { files: ProjectFile[], versionNumber: number, meta: VersionMeta }
 */
versionRoutes.get("/:v", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id")!;
  const versionNumber = parseInt(c.req.param("v"), 10);

  if (isNaN(versionNumber) || versionNumber < 0) {
    return c.json(
      { error: "Invalid version number", code: "VALIDATION_ERROR" },
      400,
    );
  }

  const project = await getOwnedProject(projectId, userId, c.env);
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  if (versionNumber > project.currentVersion) {
    return c.json({ error: "Version does not exist", code: "NOT_FOUND" }, 404);
  }

  const versionObject = await c.env.FILES.get(
    `${projectId}/v${versionNumber}/files.json`,
  );

  if (!versionObject) {
    return c.json({ error: "Version files not found", code: "NOT_FOUND" }, 404);
  }

  const version = (await versionObject.json()) as Version;

  return c.json({
    files: version.files,
    versionNumber: version.versionNumber,
    meta: toVersionMeta(version),
  });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/versions/:v1/diff/:v2 — Diff between two versions
// ---------------------------------------------------------------------------

/**
 * Computes the diff between two versions of a project.
 * Compares file-by-file and categorizes each as added, removed, or modified.
 * Unchanged files are excluded from the response.
 *
 * Response: { from: number, to: number, changes: DiffChange[] }
 */
versionRoutes.get("/:v1/diff/:v2", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id")!;
  const v1 = parseInt(c.req.param("v1"), 10);
  const v2 = parseInt(c.req.param("v2"), 10);

  if (isNaN(v1) || isNaN(v2) || v1 < 0 || v2 < 0) {
    return c.json(
      { error: "Invalid version numbers", code: "VALIDATION_ERROR" },
      400,
    );
  }

  const project = await getOwnedProject(projectId, userId, c.env);
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  // Fetch both versions in parallel
  const [obj1, obj2] = await Promise.all([
    c.env.FILES.get(`${projectId}/v${v1}/files.json`),
    c.env.FILES.get(`${projectId}/v${v2}/files.json`),
  ]);

  if (!obj1 || !obj2) {
    return c.json(
      { error: "One or both versions not found", code: "NOT_FOUND" },
      404,
    );
  }

  const version1 = (await obj1.json()) as Version;
  const version2 = (await obj2.json()) as Version;

  // Build file maps for comparison
  const files1 = new Map<string, string>();
  for (const file of version1.files) {
    files1.set(file.path, file.content);
  }

  const files2 = new Map<string, string>();
  for (const file of version2.files) {
    files2.set(file.path, file.content);
  }

  // Compute changes
  const changes: Array<{
    path: string;
    type: "added" | "removed" | "modified";
    oldContent: string | null;
    newContent: string | null;
  }> = [];

  // Check files in version 2 (additions and modifications)
  for (const [path, content] of files2) {
    const oldContent = files1.get(path);

    if (oldContent === undefined) {
      // File exists in v2 but not v1 — added
      changes.push({
        path,
        type: "added",
        oldContent: null,
        newContent: content,
      });
    } else if (oldContent !== content) {
      // File exists in both but content differs — modified
      changes.push({ path, type: "modified", oldContent, newContent: content });
    }
    // If identical, skip (unchanged)
  }

  // Check for files removed in version 2 (exist in v1 but not v2)
  for (const [path, content] of files1) {
    if (!files2.has(path)) {
      changes.push({
        path,
        type: "removed",
        oldContent: content,
        newContent: null,
      });
    }
  }

  // Sort changes: modified first, then added, then removed
  changes.sort((a, b) => {
    const order = { modified: 0, added: 1, removed: 2 };
    return order[a.type] - order[b.type];
  });

  return c.json({ from: v1, to: v2, changes });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:id/versions/:v/restore — Restore a previous version
// ---------------------------------------------------------------------------

/**
 * Restores a previous version by creating a new version with its files.
 * Non-destructive — the old versions remain intact and the restore
 * is recorded as a new entry in the timeline.
 *
 * Response: { version: VersionMeta, files: ProjectFile[] }
 */
versionRoutes.post("/:v/restore", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id")!;
  const restoreFrom = parseInt(c.req.param("v"), 10);

  if (isNaN(restoreFrom) || restoreFrom < 0) {
    return c.json(
      { error: "Invalid version number", code: "VALIDATION_ERROR" },
      400,
    );
  }

  const project = await getOwnedProject(projectId, userId, c.env);
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  if (restoreFrom > project.currentVersion) {
    return c.json({ error: "Version does not exist", code: "NOT_FOUND" }, 404);
  }

  // Fetch the version to restore
  const sourceObject = await c.env.FILES.get(
    `${projectId}/v${restoreFrom}/files.json`,
  );

  if (!sourceObject) {
    return c.json({ error: "Version files not found", code: "NOT_FOUND" }, 404);
  }

  const sourceVersion = (await sourceObject.json()) as Version;

  // Create a new version with the restored files
  const newVersionNumber = project.currentVersion + 1;

  const newVersion: Version = {
    versionNumber: newVersionNumber,
    prompt: `Restored from version ${restoreFrom}`,
    model: sourceVersion.model,
    files: sourceVersion.files,
    changedFiles: sourceVersion.files.map((f) => f.path),
    type: "restore",
    createdAt: new Date().toISOString(),
    fileCount: sourceVersion.files.length,
    restoredFrom: restoreFrom,
  };

  // Store new version and update project metadata
  project.currentVersion = newVersionNumber;
  project.updatedAt = new Date().toISOString();

  await Promise.all([
    c.env.FILES.put(
      `${projectId}/v${newVersionNumber}/files.json`,
      JSON.stringify(newVersion),
    ),
    c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project)),
  ]);

  // Persist a system message to the chat session so the restore event
  // survives page refreshes and appears in chat history on reload.
  try {
    const chatKey = `chat:${projectId}`;
    const chatSession = await c.env.METADATA.get<ChatSession>(chatKey, "json");

    const systemMessage: ChatMessage = {
      id: `msg-${Date.now()}-system`,
      role: "system",
      content: `Restored to version ${restoreFrom}`,
      timestamp: new Date().toISOString(),
    };

    if (chatSession) {
      chatSession.messages.push(systemMessage);
      chatSession.updatedAt = new Date().toISOString();
      await c.env.METADATA.put(chatKey, JSON.stringify(chatSession));
    } else {
      // No existing chat session — create one with just the system message
      const newSession: ChatSession = {
        projectId,
        messages: [systemMessage],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await c.env.METADATA.put(chatKey, JSON.stringify(newSession));
    }
  } catch {
    // Non-critical — the frontend already shows the message locally
    console.error("Failed to persist restore system message to chat");
  }

  return c.json({
    version: toVersionMeta(newVersion),
    files: newVersion.files,
  });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:id/versions — Save a manual edit as a new version
// ---------------------------------------------------------------------------

/**
 * Creates a new version from manually edited files.
 * Used by the auto-save feature when the user edits code in Monaco.
 *
 * Request body: { files: ProjectFile[] }
 * Response: { version: VersionMeta }
 */
versionRoutes.post("/", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id")!;

  const project = await getOwnedProject(projectId, userId, c.env);
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  const body = await c.req.json<{ files: ProjectFile[] }>();

  if (!body.files || !Array.isArray(body.files)) {
    return c.json(
      { error: "Files array is required", code: "VALIDATION_ERROR" },
      400,
    );
  }

  // Load the current version to compute changedFiles
  const currentObject = await c.env.FILES.get(
    `${projectId}/v${project.currentVersion}/files.json`,
  );

  let changedFiles: string[] = [];

  if (currentObject) {
    const currentVersion = (await currentObject.json()) as Version;
    const currentFilesMap = new Map<string, string>();
    for (const file of currentVersion.files) {
      currentFilesMap.set(file.path, file.content);
    }

    // Find files that changed
    for (const file of body.files) {
      const oldContent = currentFilesMap.get(file.path);
      if (oldContent === undefined || oldContent !== file.content) {
        changedFiles.push(file.path);
      }
    }

    // Find files that were removed
    for (const [path] of currentFilesMap) {
      if (!body.files.some((f) => f.path === path)) {
        changedFiles.push(path);
      }
    }
  }

  // If nothing changed, don't create a new version
  if (changedFiles.length === 0) {
    return c.json({ version: null, message: "No changes detected" });
  }

  // Create new version
  const newVersionNumber = project.currentVersion + 1;

  const newVersion: Version = {
    versionNumber: newVersionNumber,
    prompt: "Manual code edit",
    model: project.model,
    files: body.files,
    changedFiles,
    type: "manual",
    createdAt: new Date().toISOString(),
    fileCount: body.files.length,
  };

  // Store new version and update project metadata
  project.currentVersion = newVersionNumber;
  project.updatedAt = new Date().toISOString();

  await Promise.all([
    c.env.FILES.put(
      `${projectId}/v${newVersionNumber}/files.json`,
      JSON.stringify(newVersion),
    ),
    c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project)),
  ]);

  return c.json({ version: toVersionMeta(newVersion) });
});

export { versionRoutes };
