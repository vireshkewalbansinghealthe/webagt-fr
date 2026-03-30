/**
 * worker/src/routes/collaborators.ts
 *
 * Hono router for project collaboration: inviting collaborators by email,
 * accepting invitations, and removing collaborators.
 *
 * Endpoints:
 * - POST   /api/projects/:id/invite                — Owner: send invite email & store token in KV
 * - GET    /api/invites/:token                     — Public: get invite details (project name, inviter)
 * - POST   /api/invites/:token/accept              — Authenticated: accept invite, add to collaborators
 * - DELETE /api/projects/:id/collaborators/:userId — Owner: remove a collaborator
 * - GET    /api/projects/:id/collaborators         — Owner/collaborator: list collaborators
 *
 * Data storage:
 * - KV `project:{id}` — Project metadata with `collaborators` array
 * - KV `invite:{token}` — Pending invite (7-day TTL)
 *
 * Used by: worker/src/index.ts
 */

import { Hono } from "hono";
import { nanoid } from "nanoid";
import type { Env, AppVariables } from "../types";
import type { Project, ProjectInvite, Collaborator } from "../types/project";

const collabRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

/** 7 days in seconds — TTL for invite tokens in KV */
const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Send an HTML invitation email via Resend.
 */
async function sendInviteEmail(opts: {
  resendApiKey: string;
  from: string;
  to: string;
  projectName: string;
  inviterName: string;
  inviteUrl: string;
  role: "editor" | "viewer";
}): Promise<void> {
  const { resendApiKey, from, to, projectName, inviterName, inviteUrl, role } =
    opts;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border-radius:12px;border:1px solid #222222;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #222222;">
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">WebAGT</span>
              <span style="font-size:11px;color:#666666;margin-left:8px;text-transform:uppercase;letter-spacing:2px;">Project Invitation</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <p style="margin:0 0 16px;font-size:15px;color:#aaaaaa;line-height:1.6;">
                <strong style="color:#ffffff;">${inviterName}</strong> has invited you to collaborate on
                <strong style="color:#ffffff;">${projectName}</strong> as ${role === "editor" ? "an <strong style=\"color:#60a5fa;\">editor</strong>" : "a <strong style=\"color:#a3a3a3;\">viewer</strong>"}.
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#777777;line-height:1.6;">
                Click the button below to accept the invitation and start collaborating. This link expires in 7 days.
              </p>
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:linear-gradient(135deg,#2563eb,#0ea5e9);">
                    <a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0;font-size:12px;color:#555555;">
                Or copy this link: <a href="${inviteUrl}" style="color:#60a5fa;word-break:break-all;">${inviteUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #222222;">
              <p style="margin:0;font-size:12px;color:#444444;">
                You received this because someone invited you to a WebAGT project. If you didn't expect this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: `${inviterName} invited you to collaborate on "${projectName}"`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error (${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects/:id/invite — owner sends an invite
// ---------------------------------------------------------------------------
collabRoutes.post("/api/projects/:id/invite", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const body = await c.req.json<{ email: string; role?: "editor" | "viewer" }>();
  const email = (body.email ?? "").trim().toLowerCase();
  const role: "editor" | "viewer" = body.role === "viewer" ? "viewer" : "editor";

  if (!email || !email.includes("@")) {
    return c.json({ error: "Valid email is required" }, 400);
  }

  // Load project — owner check
  const raw = await c.env.METADATA.get(`project:${projectId}`);
  if (!raw) return c.json({ error: "Project not found" }, 404);
  const project = JSON.parse(raw) as Project;

  if (project.userId !== userId) {
    return c.json({ error: "Only the project owner can invite collaborators" }, 403);
  }

  // Check if already a collaborator
  const alreadyMember = project.collaborators?.some(
    (col) => col.email === email,
  );
  if (alreadyMember) {
    return c.json({ error: "This person is already a collaborator" }, 409);
  }

  // Check Resend config
  const resendApiKey = c.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return c.json({ error: "Email sending not configured (RESEND_API_KEY missing)" }, 500);
  }

  const from = c.env.PLATFORM_EMAIL_FROM || "WebAGT <noreply@webagt.ai>";
  const workerUrl = c.env.PUBLIC_WORKER_URL || "https://webagt-worker.webagt.workers.dev";
  const frontendUrl = c.env.FRONTEND_URL || "https://www.webagt.ai";

  // Get inviter display name from Clerk
  let inviterName = "A WebAGT user";
  try {
    const meRes = await fetch(
      `https://api.clerk.com/v1/users/${userId}`,
      { headers: { Authorization: `Bearer ${c.env.CLERK_SECRET_KEY ?? ""}` } },
    );
    if (meRes.ok) {
      const me = (await meRes.json()) as { first_name?: string; last_name?: string; email_addresses?: Array<{ email_address: string }> };
      inviterName =
        [me.first_name, me.last_name].filter(Boolean).join(" ") ||
        me.email_addresses?.[0]?.email_address ||
        inviterName;
    }
  } catch {
    // Non-fatal — use default name
  }

  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + INVITE_TTL_SECONDS * 1000).toISOString();

  const invite: ProjectInvite = {
    projectId,
    invitedEmail: email,
    invitedByUserId: userId,
    role,
    expiresAt,
  };

  // Store invite token in KV with TTL
  await c.env.METADATA.put(`invite:${token}`, JSON.stringify(invite), {
    expirationTtl: INVITE_TTL_SECONDS,
  });

  const inviteUrl = `${frontendUrl}/invite/${token}`;

  // Send email
  await sendInviteEmail({
    resendApiKey,
    from,
    to: email,
    projectName: project.name,
    inviterName,
    inviteUrl,
    role,
  });

  return c.json({ success: true, message: `Invitation sent to ${email}` });
});

// ---------------------------------------------------------------------------
// GET /api/invites/:token — public: fetch invite details
// ---------------------------------------------------------------------------
collabRoutes.get("/api/invites/:token", async (c) => {
  const token = c.req.param("token");
  const raw = await c.env.METADATA.get(`invite:${token}`);
  if (!raw) return c.json({ error: "Invitation not found or expired" }, 404);

  const invite = JSON.parse(raw) as ProjectInvite;

  if (new Date(invite.expiresAt) < new Date()) {
    return c.json({ error: "Invitation has expired" }, 410);
  }

  // Load project name
  const projRaw = await c.env.METADATA.get(`project:${invite.projectId}`);
  if (!projRaw) return c.json({ error: "Project no longer exists" }, 404);
  const project = JSON.parse(projRaw) as Project;

  // Get inviter name
  let inviterName = "A WebAGT user";
  try {
    const meRes = await fetch(
      `https://api.clerk.com/v1/users/${invite.invitedByUserId}`,
      { headers: { Authorization: `Bearer ${c.env.CLERK_SECRET_KEY ?? ""}` } },
    );
    if (meRes.ok) {
      const me = (await meRes.json()) as { first_name?: string; last_name?: string };
      inviterName =
        [me.first_name, me.last_name].filter(Boolean).join(" ") || inviterName;
    }
  } catch {
    // Non-fatal
  }

  return c.json({
    projectId: invite.projectId,
    projectName: project.name,
    invitedEmail: invite.invitedEmail,
    inviterName,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
});

// ---------------------------------------------------------------------------
// POST /api/invites/:token/accept — authenticated: accept invite
// ---------------------------------------------------------------------------
collabRoutes.post("/api/invites/:token/accept", async (c) => {
  const userId = c.var.userId;
  const token = c.req.param("token");

  const raw = await c.env.METADATA.get(`invite:${token}`);
  if (!raw) return c.json({ error: "Invitation not found or expired" }, 404);

  const invite = JSON.parse(raw) as ProjectInvite;

  if (new Date(invite.expiresAt) < new Date()) {
    await c.env.METADATA.delete(`invite:${token}`);
    return c.json({ error: "Invitation has expired" }, 410);
  }

  // Load project
  const projRaw = await c.env.METADATA.get(`project:${invite.projectId}`);
  if (!projRaw) return c.json({ error: "Project no longer exists" }, 404);
  const project = JSON.parse(projRaw) as Project;

  // Prevent the owner from "accepting" their own invite
  if (project.userId === userId) {
    return c.json({ error: "You are already the project owner" }, 409);
  }

  // Idempotent — already a collaborator?
  const alreadyCollab = project.collaborators?.some((c) => c.userId === userId);
  if (!alreadyCollab) {
    // Get acceptor email
    let email = invite.invitedEmail;
    try {
      const meRes = await fetch(
        `https://api.clerk.com/v1/users/${userId}`,
        { headers: { Authorization: `Bearer ${c.env.CLERK_SECRET_KEY ?? ""}` } },
      );
      if (meRes.ok) {
        const me = (await meRes.json()) as { email_addresses?: Array<{ email_address: string }> };
        email = me.email_addresses?.[0]?.email_address || email;
      }
    } catch {
      // Use invited email as fallback
    }

    const newCollab: Collaborator = {
      userId,
      email,
      role: invite.role,
      joinedAt: new Date().toISOString(),
    };

    const updatedProject: Project = {
      ...project,
      collaborators: [...(project.collaborators ?? []), newCollab],
      updatedAt: new Date().toISOString(),
    };

    await c.env.METADATA.put(`project:${invite.projectId}`, JSON.stringify(updatedProject));

    // Add the project to the collaborator's project list
    const listRaw = await c.env.METADATA.get(`user-projects:${userId}`);
    const list: string[] = listRaw ? JSON.parse(listRaw) : [];
    if (!list.includes(invite.projectId)) {
      list.unshift(invite.projectId);
      await c.env.METADATA.put(`user-projects:${userId}`, JSON.stringify(list));
    }
  }

  // Delete the used token
  await c.env.METADATA.delete(`invite:${token}`);

  return c.json({ success: true, projectId: invite.projectId });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/collaborators — list collaborators
// ---------------------------------------------------------------------------
collabRoutes.get("/api/projects/:id/collaborators", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const raw = await c.env.METADATA.get(`project:${projectId}`);
  if (!raw) return c.json({ error: "Project not found" }, 404);
  const project = JSON.parse(raw) as Project;

  const isOwner = project.userId === userId;
  const isCollab = project.collaborators?.some((col) => col.userId === userId);
  if (!isOwner && !isCollab) {
    return c.json({ error: "Access denied" }, 403);
  }

  return c.json({
    ownerId: project.userId,
    collaborators: project.collaborators ?? [],
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/projects/:id/collaborators/:userId — remove a collaborator
// ---------------------------------------------------------------------------
collabRoutes.delete("/api/projects/:id/collaborators/:collabUserId", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");
  const collabUserId = c.req.param("collabUserId");

  const raw = await c.env.METADATA.get(`project:${projectId}`);
  if (!raw) return c.json({ error: "Project not found" }, 404);
  const project = JSON.parse(raw) as Project;

  const isOwner = project.userId === userId;
  const isSelf = collabUserId === userId;

  // Owner can remove anyone; collaborators can remove themselves
  if (!isOwner && !isSelf) {
    return c.json({ error: "Only the project owner can remove collaborators" }, 403);
  }

  const updated: Project = {
    ...project,
    collaborators: (project.collaborators ?? []).filter(
      (col) => col.userId !== collabUserId,
    ),
    updatedAt: new Date().toISOString(),
  };

  await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(updated));

  // Remove from the removed collaborator's project list
  const listRaw = await c.env.METADATA.get(`user-projects:${collabUserId}`);
  if (listRaw) {
    const list: string[] = JSON.parse(listRaw);
    await c.env.METADATA.put(
      `user-projects:${collabUserId}`,
      JSON.stringify(list.filter((id) => id !== projectId)),
    );
  }

  return c.json({ success: true });
});

export { collabRoutes };
