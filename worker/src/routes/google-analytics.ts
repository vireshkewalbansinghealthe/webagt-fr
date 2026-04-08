/**
 * worker/src/routes/google-analytics.ts
 *
 * Google Analytics 4 OAuth integration.
 * Lets shop owners connect their GA4 account via Google OAuth,
 * browse their properties, and auto-configure the measurement ID.
 *
 * Flow:
 *   1. GET  /api/ga/auth-url      → returns Google OAuth consent URL
 *   2. GET  /api/ga/callback      → public, handles Google redirect (popup)
 *   3. GET  /api/ga/properties    → lists GA4 properties + measurement IDs
 *   4. POST /api/ga/connect       → saves selected measurement ID to project
 *   5. POST /api/ga/disconnect    → removes GA connection
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";
import type { Project } from "../types/project";

const gaRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GA_ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta";
const SCOPES = "https://www.googleapis.com/auth/analytics.readonly";

// ── GET /auth-url — Generate Google OAuth consent URL ─────────────────────
gaRoutes.get("/auth-url", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.query("projectId");
  if (!projectId) return c.json({ error: "projectId required" }, 400);

  const clientId = c.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return c.json({ error: "Google Analytics OAuth is not configured on this server" }, 501);
  }

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project || project.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  const state = btoa(JSON.stringify({ projectId, userId, ts: Date.now() }));
  await c.env.METADATA.put(
    `ga-oauth-state:${state}`,
    JSON.stringify({ projectId, userId }),
    { expirationTtl: 600 },
  );

  const workerOrigin = c.env.PUBLIC_WORKER_URL || new URL(c.req.url).origin;
  const callbackUrl = `${workerOrigin}/api/ga/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    state,
    prompt: "consent",
  });

  return c.json({ url: `${GOOGLE_OAUTH_URL}?${params}` });
});

// ── GET /callback — Public, Google redirects here inside the popup ────────
gaRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) return c.html(callbackPage({ error: "Authorization was denied" }));
  if (!code || !state) return c.html(callbackPage({ error: "Missing authorization code" }));

  const stateData = await c.env.METADATA.get<{ projectId: string; userId: string }>(
    `ga-oauth-state:${state}`,
    "json",
  );
  if (!stateData) return c.html(callbackPage({ error: "Invalid or expired session" }));

  await c.env.METADATA.delete(`ga-oauth-state:${state}`);

  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return c.html(callbackPage({ error: "OAuth not configured" }));
  }

  const workerOrigin = c.env.PUBLIC_WORKER_URL || new URL(c.req.url).origin;
  const callbackUrl = `${workerOrigin}/api/ga/callback`;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text().catch(() => "");
    console.error("Google token exchange failed:", err);
    return c.html(callbackPage({ error: "Failed to exchange authorization code" }));
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  // Store token temporarily (10 min) so the frontend can list properties
  await c.env.METADATA.put(
    `ga-token:${stateData.projectId}:${stateData.userId}`,
    tokenData.access_token,
    { expirationTtl: 600 },
  );

  return c.html(callbackPage({ success: true }));
});

// ── GET /properties — List GA4 properties for the authenticated user ──────
gaRoutes.get("/properties", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.query("projectId");
  if (!projectId) return c.json({ error: "projectId required" }, 400);

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project || (project.userId !== userId && !project.collaborators?.some((col) => col.userId === userId))) {
    return c.json({ error: "Access denied" }, 403);
  }

  const token = await c.env.METADATA.get(`ga-token:${projectId}:${userId}`);
  if (!token) {
    return c.json({ error: "No Google token. Please authenticate first." }, 401);
  }

  try {
    const accountsRes = await fetch(`${GA_ADMIN_API}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!accountsRes.ok) {
      await c.env.METADATA.delete(`ga-token:${projectId}:${userId}`);
      return c.json({ error: "Google token expired. Please re-authenticate." }, 401);
    }

    const accountsData = (await accountsRes.json()) as { accounts?: Array<{ name: string; displayName: string }> };
    const properties: Array<{
      name: string;
      displayName: string;
      accountName: string;
      measurementId: string;
    }> = [];

    for (const account of accountsData.accounts || []) {
      const propsRes = await fetch(
        `${GA_ADMIN_API}/properties?filter=parent:${account.name}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!propsRes.ok) continue;

      const propsData = (await propsRes.json()) as {
        properties?: Array<{ name: string; displayName: string }>;
      };

      for (const prop of propsData.properties || []) {
        const streamsRes = await fetch(`${GA_ADMIN_API}/${prop.name}/dataStreams`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        let measurementId = "";
        if (streamsRes.ok) {
          const streamsData = (await streamsRes.json()) as {
            dataStreams?: Array<{
              type: string;
              webStreamData?: { measurementId: string };
            }>;
          };
          const webStream = (streamsData.dataStreams || []).find(
            (s) => s.type === "WEB_DATA_STREAM",
          );
          if (webStream?.webStreamData?.measurementId) {
            measurementId = webStream.webStreamData.measurementId;
          }
        }

        if (measurementId) {
          properties.push({
            name: prop.name,
            displayName: prop.displayName,
            accountName: account.displayName,
            measurementId,
          });
        }
      }
    }

    return c.json({ properties });
  } catch (e: any) {
    return c.json({ error: e.message || "Failed to fetch GA4 properties" }, 500);
  }
});

// ── POST /connect — Save selected measurement ID to project ───────────────
gaRoutes.post("/connect", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{
    projectId: string;
    measurementId: string;
    propertyName?: string;
    displayName?: string;
  }>();

  if (!body.projectId || !body.measurementId) {
    return c.json({ error: "projectId and measurementId are required" }, 400);
  }

  const project = await c.env.METADATA.get<Project>(`project:${body.projectId}`, "json");
  if (!project || project.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  project.gaMeasurementId = body.measurementId;
  project.updatedAt = new Date().toISOString();
  await c.env.METADATA.put(`project:${body.projectId}`, JSON.stringify(project));

  // Clean up temp token
  await c.env.METADATA.delete(`ga-token:${body.projectId}:${userId}`).catch(() => {});

  return c.json({ ok: true, measurementId: body.measurementId });
});

// ── POST /disconnect — Remove GA connection ───────────────────────────────
gaRoutes.post("/disconnect", async (c) => {
  const userId = c.var.userId;
  const body = await c.req.json<{ projectId: string }>();

  if (!body.projectId) return c.json({ error: "projectId required" }, 400);

  const project = await c.env.METADATA.get<Project>(`project:${body.projectId}`, "json");
  if (!project || project.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  project.gaMeasurementId = undefined;
  project.updatedAt = new Date().toISOString();
  await c.env.METADATA.put(`project:${body.projectId}`, JSON.stringify(project));

  return c.json({ ok: true });
});

// ── Popup callback page ──────────────────────────────────────────────────
function callbackPage(opts: { success?: boolean; error?: string }): string {
  const title = opts.success ? "Connected" : "Error";
  const heading = opts.success ? "Connected!" : "Connection Failed";
  const body = opts.success
    ? "Google Analytics has been connected. This window will close automatically."
    : opts.error || "An unknown error occurred.";
  const icon = opts.success ? "✓" : "✕";
  const color = opts.success ? "#22c55e" : "#ef4444";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Google Analytics – ${title}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;color:#1a1a1a}
.card{text-align:center;padding:2.5rem;border-radius:16px;background:#fff;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:380px;width:90%}
.icon{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:28px;font-weight:700;color:#fff;background:${color}}
h2{font-size:1.25rem;margin-bottom:.5rem}
p{color:#666;font-size:.875rem;line-height:1.5}
</style></head>
<body><div class="card">
<div class="icon">${icon}</div>
<h2>${heading}</h2>
<p>${body}</p>
</div>
<script>
if(window.opener){
  window.opener.postMessage({type:'ga-oauth-callback',success:${opts.success ? "true" : "false"},error:${opts.error ? JSON.stringify(opts.error) : "null"}},'*');
  ${opts.success ? "setTimeout(()=>window.close(),1200);" : ""}
}
</script></body></html>`;
}

export { gaRoutes };
