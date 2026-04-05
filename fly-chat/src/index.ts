import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { loadEnv } from "./types.js";
import type { AppVariables } from "./types.js";
import { CloudflareKV } from "./services/cloudflare-kv.js";
import { CloudflareR2 } from "./services/cloudflare-r2.js";
import { authMiddleware } from "./middleware/auth.js";
import { chatRoutes } from "./routes/chat.js";

const env = loadEnv();

const kv = new CloudflareKV(env.CF_ACCOUNT_ID, env.CF_KV_NAMESPACE_ID, env.CF_API_TOKEN);
const r2 = new CloudflareR2(env.CF_ACCOUNT_ID, env.R2_ACCESS_KEY_ID, env.R2_SECRET_ACCESS_KEY, env.R2_BUCKET_NAME);

const app = new Hono<{ Variables: AppVariables }>();

// CORS
const allowedOrigins = [
  env.FRONTEND_URL || "http://localhost:3000",
  "http://localhost:3000",
  "https://webagt.ai",
];

app.use("*", cors({
  origin: (origin) => {
    if (!origin) return "*";
    if (allowedOrigins.some(o => origin.startsWith(o))) return origin;
    if (origin.endsWith(".webagt.ai")) return origin;
    if (origin.endsWith(".vercel.app")) return origin;
    if (origin.endsWith(".csb.app")) return origin;
    if (origin.endsWith(".codesandbox.io")) return origin;
    return allowedOrigins[0];
  },
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "OPTIONS"],
  credentials: true,
}));

// Inject env, kv, r2 into context for all routes
app.use("*", async (c, next) => {
  c.set("env" as any, env);
  c.set("kv" as any, kv);
  c.set("r2" as any, r2);
  await next();
});

// Health check (no auth)
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "webagt-chat",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Public asset serving — user-uploaded images (logos, photos) stored in R2.
// No auth required: assets are namespaced by projectId and serve as <img src> in generated previews.
app.get("/api/assets/:projectId/:filename", async (c) => {
  const { projectId, filename } = c.req.param();
  const r2 = c.get("r2" as any) as CloudflareR2;
  const storagePath = `assets/${projectId}/${filename}`;
  const obj = await r2.getBytes(storagePath);
  if (!obj) return c.notFound();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "png";
  const mimeMap: Record<string, string> = {
    png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
    gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  };
  const contentType = obj.contentType ?? mimeMap[ext] ?? "application/octet-stream";
  return new Response(obj.buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

// Auth middleware for /api/* (excluding /api/assets which is public above)
app.use("/api/*", authMiddleware);

// Mount chat routes
app.route("/api/chat", chatRoutes);

// Start server
const port = parseInt(env.PORT || "3001", 10);
console.log(`[webagt-chat] Starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`[webagt-chat] Listening on http://0.0.0.0:${info.port}`);
  console.log(`[webagt-chat] Health: http://0.0.0.0:${info.port}/health`);
});
