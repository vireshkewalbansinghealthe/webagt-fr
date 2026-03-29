/**
 * worker/src/routes/assets.ts
 *
 * Public endpoint for serving user-uploaded image assets from R2.
 * Assets are uploaded via the chat endpoint when a user attaches images
 * and are stored at: assets/{projectId}/{uuid}.{ext}
 *
 * This endpoint is intentionally PUBLIC (no auth) because:
 * - Generated app code uses these URLs in <img src="..."> tags
 * - The Sandpack preview iframe can't pass auth headers
 *
 * Used by: worker/src/index.ts (mounted at /api/assets, public route)
 */

import { Hono } from "hono";
import type { Env } from "../types";

const assetRoutes = new Hono<{ Bindings: Env }>();

/**
 * GET /api/assets/:projectId/:filename
 *
 * Serves an image asset stored in R2.
 * Returns the raw bytes with the correct Content-Type and a
 * long-lived cache header since asset filenames are UUIDs (immutable).
 */
assetRoutes.get("/:projectId/:filename", async (c) => {
  const projectId = c.req.param("projectId");
  const filename = c.req.param("filename");

  // Reject obviously malicious paths
  if (filename.includes("..") || projectId.includes("..")) {
    return c.json({ error: "Invalid path", code: "BAD_REQUEST" }, 400);
  }

  const key = `assets/${projectId}/${filename}`;
  const object = await c.env.FILES.get(key);

  if (!object) {
    return c.json({ error: "Asset not found", code: "NOT_FOUND" }, 404);
  }

  const contentType =
    object.httpMetadata?.contentType || "application/octet-stream";
  const data = await object.arrayBuffer();

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      // UUID filenames are immutable — safe to cache aggressively
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

export { assetRoutes };
