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
import { createTursoDatabase, createWebshopSchema, executeTursoSQL } from "../services/turso";
import {
  createStripeConnectedAccount,
  getStripePublishConfig,
  syncCoolifyStripeConfiguration,
  type PaymentMode,
} from "../services/stripe-connect";
import {
  getResendDomainDetails,
  upsertResendDomain,
  verifyResendDomain,
  type EmailDnsRecord,
} from "../services/resend-domain";
import type { ChatMessage, ChatSession } from "../types/chat";

/**
 * Create a Hono router with typed bindings and variables.
 * The auth middleware sets `c.var.userId` before these handlers run.
 */
const projectRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();
const TAILWIND_CDN_SNIPPET =
  `<script src="https://cdn.tailwindcss.com"></script>`;

function ensureTailwindCdn(indexHtml: string): string {
  if (indexHtml.includes("cdn.tailwindcss.com")) {
    return indexHtml;
  }

  if (indexHtml.includes("</head>")) {
    return indexHtml.replace("</head>", `  ${TAILWIND_CDN_SNIPPET}\n</head>`);
  }

  return `${TAILWIND_CDN_SNIPPET}\n${indexHtml}`;
}

function isValidEmail(email?: string): email is string {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function normalizeOwnerEmails(project: Project): string[] {
  const source = [
    ...(project.ownerNotificationEmails || []),
    ...(project.ownerNotificationEmail ? [project.ownerNotificationEmail] : []),
  ];

  const normalized = source
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0 && isValidEmail(email));

  return Array.from(new Set(normalized));
}

function normalizeDomain(input?: string): string | undefined {
  if (!input) return undefined;
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
  if (!normalized) return undefined;
  return /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalized) ? normalized : undefined;
}

function buildEmailSettingsResponse(
  project: Project,
  dnsRecords: EmailDnsRecord[] = [],
) {
  const ownerEmails = normalizeOwnerEmails(project);
  return {
    ownerNotificationEmail: ownerEmails[0] || "",
    ownerNotificationEmails: ownerEmails,
    orderCustomerEmailsEnabled: project.orderCustomerEmailsEnabled !== false,
    emailSenderMode: project.emailSenderMode || "platform",
    emailDomain: project.emailDomain || "",
    emailDomainStatus: project.emailDomainStatus || "unverified",
    emailLastVerificationAt: project.emailLastVerificationAt,
    emailLastError: project.emailLastError,
    dnsRecords,
  };
}

function escapeSql(value: string): string {
  return value.replace(/'/g, "''");
}

async function seedTemplateCatalogIfNeeded(
  dbUrl: string | undefined,
  dbToken: string | undefined,
  templateId: string | undefined,
) {
  if (!dbUrl || !dbToken) return;
  if (!templateId || templateId === "blank-ai") return;

  if (templateId !== "pardole_parfum_vite" && templateId !== "pardole-parfum") {
    return;
  }

  const categories = [
    { id: "cat-dames", name: "Dames", slug: "dames" },
    { id: "cat-heren", name: "Heren", slug: "heren" },
    { id: "cat-unisex", name: "Unisex", slug: "unisex" },
  ];

  const products = [
    {
      id: "prd-309",
      categoryId: "cat-dames",
      name: "309",
      slug: "309",
      description: "Designer-inspired parfum met warme en elegante noten.",
      price: 24.95,
      image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=800&q=80",
      featured: 1,
      inventory: 120,
      rating: 4.9,
      reviews: 847,
    },
    {
      id: "prd-105",
      categoryId: "cat-heren",
      name: "105",
      slug: "105",
      description: "Krachtige heren geur met kruidige en houtachtige basis.",
      price: 24.95,
      image: "https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=800&q=80",
      featured: 1,
      inventory: 110,
      rating: 4.8,
      reviews: 789,
    },
    {
      id: "prd-210",
      categoryId: "cat-unisex",
      name: "210",
      slug: "210",
      description: "Unisex premium blend met amber, musk en vanille.",
      price: 24.95,
      image: "https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=800&q=80",
      featured: 1,
      inventory: 95,
      rating: 4.9,
      reviews: 412,
    },
  ];

  const categorySql = categories
    .map(
      (cat) =>
        `INSERT OR IGNORE INTO [Category] (id, name, slug, description, image) VALUES ('${escapeSql(
          cat.id,
        )}', '${escapeSql(cat.name)}', '${escapeSql(cat.slug)}', '', '');`,
    )
    .join("\n");

  const productSql = products
    .map((product) => {
      const imagesJson = JSON.stringify([product.image]);
      return `INSERT OR IGNORE INTO [Product] (id, categoryId, name, slug, description, price, images, featured, inventory, stock, status, rating, reviews) VALUES ('${escapeSql(
        product.id,
      )}', '${escapeSql(product.categoryId)}', '${escapeSql(product.name)}', '${escapeSql(
        product.slug,
      )}', '${escapeSql(product.description)}', ${product.price}, '${escapeSql(
        imagesJson,
      )}', ${product.featured}, ${product.inventory}, ${product.inventory}, 'ACTIVE', ${product.rating}, ${product.reviews});`;
    })
    .join("\n");

  await executeTursoSQL(dbUrl, dbToken, `${categorySql}\n${productSql}`);
}

const TEMPLATE_LABELS: Record<string, string> = {
  "pardole-parfum": "Koning Parfum",
  "pardole_parfum_vite": "Koning Parfum (Vite)",
};

function buildTemplateWelcomeMessage(
  templateId: string | undefined,
  now: string,
): ChatMessage | null {
  if (!templateId || templateId === "blank-ai") {
    return null;
  }

  const templateName = TEMPLATE_LABELS[templateId] || "this template";
  return {
    id: `msg-${nanoid(10)}`,
    role: "assistant",
    timestamp: now,
    content: `Thanks for using our awesome ${templateName} template! I have cloned it into your new sandbox and opened it for you.\n\nIs there anything you want me to change first?\n1) Rename the store\n2) Update branding (logo, colors, fonts)\n3) Refresh hero text and homepage copy`,
    suggestions: [
      "1) Change the store name and brand text",
      "2) Update branding (logo, colors, fonts)",
      "3) Improve hero section and homepage copy",
    ],
  };
}

function buildManagedStripeFiles(
  stripeConfig: ReturnType<typeof getStripePublishConfig>,
): { paymentsTsContent: string; stripeTsContent: string } {
  const paymentsTsContent = `type PaymentMode = "off" | "test" | "live";

interface CheckoutPayload {
  items: Array<{
    productId?: string;
    name: string;
    unitAmount: number;
    quantity: number;
    image?: string;
    isVirtual?: boolean;
  }>;
  successUrl?: string;
  cancelUrl?: string;
  requiresShipping?: boolean;
}

interface PaymentState {
  mode: PaymentMode;
  canCheckout: boolean;
  headline: string;
  message: string;
  ctaLabel: string;
}

interface StripeRequirements {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
}

export interface StripeAccountStatus {
  accountId: string;
  type: string;
  mode: Exclude<PaymentMode, "off">;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  transferCapabilityActive: boolean;
  requiresAction: boolean;
  isReady: boolean;
  summary: string;
  requirements: StripeRequirements;
}

const paymentMode = '${stripeConfig.mode}' as PaymentMode;

export function getPaymentState(): PaymentState {
  if (paymentMode === "live") {
    return {
      mode: "live",
      canCheckout: true,
      headline: "Live payments are active",
      message: "Customers can place real orders and Stripe will route payouts to the connected account.",
      ctaLabel: "Buy now",
    };
  }

  if (paymentMode === "test") {
    return {
      mode: "test",
      canCheckout: true,
      headline: "Test mode is active",
      message: "Use Stripe test cards to validate checkout before going live.",
      ctaLabel: "Test checkout",
    };
  }

  return {
    mode: "off",
    canCheckout: false,
    headline: "Publish to test payments",
    message: "Payments are not available in the live preview. Publish your shop to test checkout with Stripe.",
    ctaLabel: "Publish to test payments",
  };
}

function summarizeStripeStatus(status: StripeAccountStatus): string {
  if (status.requirements.currentlyDue.length > 0) {
    return "Stripe still needs: " + status.requirements.currentlyDue.join(", ");
  }

  if (!status.detailsSubmitted) {
    return "Finish Stripe onboarding to submit your connected account details.";
  }

  if (!status.chargesEnabled || !status.payoutsEnabled || !status.transferCapabilityActive) {
    return "Stripe account setup is incomplete. Review the connected account before accepting payments.";
  }

  if (status.requirements.pendingVerification.length > 0) {
    return "Stripe is reviewing submitted information for this connected account.";
  }

  return "Stripe is connected and ready to accept payments.";
}

export async function getStripeAccountStatus(): Promise<StripeAccountStatus | null> {
  if (paymentMode === "off") {
    return null;
  }

  const response = await fetch('/api/stripe/account-status');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load Stripe account status');
  }

  const status: StripeAccountStatus = {
    accountId: data.accountId,
    type: data.type || 'unknown',
    mode: data.mode,
    detailsSubmitted: Boolean(data.detailsSubmitted),
    chargesEnabled: Boolean(data.chargesEnabled),
    payoutsEnabled: Boolean(data.payoutsEnabled),
    transferCapabilityActive: Boolean(data.transferCapabilityActive),
    requiresAction: Boolean(data.requiresAction),
    isReady: Boolean(data.isReady),
    summary: '',
    requirements: {
      currentlyDue: data.requirements?.currentlyDue || [],
      eventuallyDue: data.requirements?.eventuallyDue || [],
      pastDue: data.requirements?.pastDue || [],
      pendingVerification: data.requirements?.pendingVerification || [],
      disabledReason: data.requirements?.disabledReason || null,
    },
  };

  status.summary = data.summary || summarizeStripeStatus(status);
  return status;
}

export async function startStripeOnboarding(returnUrl?: string) {
  if (paymentMode === "off") {
    throw new Error('Payments are disabled for this shop.');
  }

  const response = await fetch('/api/stripe/account-onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      returnUrl: returnUrl || window.location.href,
      refreshUrl: window.location.href,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Failed to open Stripe onboarding');
  }

  return data.url as string;
}

export async function beginCheckout({ items, successUrl, cancelUrl, requiresShipping = false }: CheckoutPayload) {
  const state = getPaymentState();
  if (!state.canCheckout) {
    throw new Error(state.message);
  }

  const normalizedItems = items
    .map((item) => ({
      ...item,
      unitAmount: Math.max(1, Math.round(Number(item.unitAmount) || 0)),
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    }))
    .filter((item) => item.name && Number.isFinite(item.unitAmount) && item.unitAmount > 0);

  if (normalizedItems.length === 0) {
    throw new Error('No valid checkout items found.');
  }

  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: normalizedItems,
      currency: 'eur',
      successUrl: successUrl || window.location.origin + '/success',
      cancelUrl: cancelUrl || window.location.origin + '/cart',
      requiresShipping,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Failed to initialize checkout');
  }
  return data.url as string;
}

export const stripePromise = Promise.resolve(null);
`;

  const stripeTsContent = `import {
  beginCheckout,
  getPaymentState,
  getStripeAccountStatus,
  startStripeOnboarding,
  stripePromise,
} from './payments';

export { getPaymentState, getStripeAccountStatus, startStripeOnboarding, stripePromise };

export async function createCheckoutSession(
  items: Array<{ productId?: string; name: string; unitAmount: number; quantity: number; image?: string; isVirtual?: boolean }>,
  successUrl?: string,
  cancelUrl?: string,
  requiresShipping?: boolean,
) {
  return beginCheckout({ items, successUrl, cancelUrl, requiresShipping });
}
`;

  return { paymentsTsContent, stripeTsContent };
}

function resolveBackendUrl(env: Env, requestUrl: string): string {
  const configured = env.PUBLIC_WORKER_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const requestOrigin = new URL(requestUrl).origin;
  if (requestOrigin.includes("localhost") || requestOrigin.includes("127.0.0.1")) {
    return "https://api-webagt.dock.4esh.nl";
  }

  return requestOrigin;
}

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

  const isOwner = project.userId === userId;
  const isCollaborator = project.collaborators?.some((col) => col.userId === userId);
  if (!isOwner && !isCollaborator) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  return c.json({ project });
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/logs — Fetch _AppLog entries from the project's Turso DB
// ---------------------------------------------------------------------------
projectRoutes.get("/:id/logs", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");
  const level = c.req.query("level");
  const limit = Math.min(Number(c.req.query("limit") || 200), 500);

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (project.userId !== userId && !project.collaborators?.some((col) => col.userId === userId)) {
    return c.json({ error: "Access denied" }, 403);
  }

  // Try Turso DB first
  if (project.databaseUrl && project.databaseToken) {
    try {
      const { createClient } = await import("@libsql/client/web");
      const db = createClient({ url: project.databaseUrl, authToken: project.databaseToken });

      await db.execute("CREATE TABLE IF NOT EXISTS [_AppLog] (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL DEFAULT 'info', source TEXT, message TEXT NOT NULL, detail TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)");

      const where = level ? `WHERE level = '${level.replace(/'/g, "")}'` : "";
      const result = await db.execute(`SELECT * FROM _AppLog ${where} ORDER BY id DESC LIMIT ${limit}`);
      const logs = result.rows.map((row) => {
        const obj: Record<string, unknown> = {};
        result.columns.forEach((col, i) => { obj[col] = (row as any)[i]; });
        return obj;
      });

      return c.json({ logs, total: logs.length, source: "turso" });
    } catch (e: any) {
      // Fall through to KV fallback
    }
  }

  // Fallback: read from KV
  try {
    const kvLogs = await c.env.METADATA.get<Array<{ level: string; source: string; message: string; detail?: string; createdAt: string }>>(`logs:${projectId}`, "json") || [];
    const filtered = level ? kvLogs.filter((l) => l.level === level) : kvLogs;
    const limited = filtered.slice(-limit).reverse();
    return c.json({ logs: limited, total: limited.length, source: "kv-fallback", noDatabase: !project.databaseUrl });
  } catch (e: any) {
    return c.json({ error: "Failed to read logs", detail: e.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /api/projects/:id/logs — Write a log entry from the frontend
// ---------------------------------------------------------------------------
projectRoutes.post("/:id/logs", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (project.userId !== userId && !project.collaborators?.some((col) => col.userId === userId)) {
    return c.json({ error: "Access denied" }, 403);
  }
  try {
    const body = await c.req.json<{
      entries?: Array<{ level: string; source: string; message: string; detail?: string }>;
      level?: string; source?: string; message?: string; detail?: string;
    }>();

    const entries = body.entries || [{ level: body.level || "info", source: body.source || "frontend", message: body.message || "", detail: body.detail }];
    const now = new Date().toISOString();

    // Try Turso DB first
    if (project.databaseUrl && project.databaseToken) {
      try {
        const { createClient } = await import("@libsql/client/web");
        const db = createClient({ url: project.databaseUrl, authToken: project.databaseToken });
        await db.execute("CREATE TABLE IF NOT EXISTS [_AppLog] (id INTEGER PRIMARY KEY AUTOINCREMENT, level TEXT NOT NULL DEFAULT 'info', source TEXT, message TEXT NOT NULL, detail TEXT, createdAt TEXT DEFAULT CURRENT_TIMESTAMP)");

        for (const entry of entries.slice(0, 50)) {
          if (!entry.message) continue;
          await db.execute({
            sql: "INSERT INTO [_AppLog] (level, source, message, detail, createdAt) VALUES (?, ?, ?, ?, ?)",
            args: [entry.level || "info", entry.source || "frontend", entry.message.slice(0, 1000), (entry.detail || "").slice(0, 4000) || null, now],
          });
        }
        return c.json({ ok: true, written: entries.length });
      } catch {
        // Fall through to KV
      }
    }

    // Fallback: write to KV
    const kvKey = `logs:${projectId}`;
    const existing = await c.env.METADATA.get<Array<any>>(kvKey, "json") || [];
    const newEntries = entries.slice(0, 50).filter((e) => e.message).map((e) => ({
      level: e.level || "info", source: e.source || "frontend",
      message: (e.message || "").slice(0, 1000), detail: (e.detail || "").slice(0, 4000) || undefined,
      createdAt: now,
    }));
    const merged = [...existing, ...newEntries].slice(-200);
    await c.env.METADATA.put(kvKey, JSON.stringify(merged));
    return c.json({ ok: true, written: newEntries.length, storage: "kv" });
  } catch (e: any) {
    return c.json({ error: "Failed to write log", detail: e.message }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/email-settings — Read order email settings
// ---------------------------------------------------------------------------
projectRoutes.get("/:id/email-settings", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }
  if (project.userId !== userId) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  let dnsRecords: EmailDnsRecord[] = [];
  if (project.emailDomainId && c.env.RESEND_API_KEY) {
    try {
      const domainInfo = await getResendDomainDetails(c.env, project.emailDomainId);
      project.emailDomainStatus = domainInfo.status;
      project.emailSenderMode =
        domainInfo.status === "verified" ? "owner_verified" : "platform";
      project.emailLastVerificationAt = new Date().toISOString();
      dnsRecords = domainInfo.records;
      await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));
    } catch (error: any) {
      project.emailLastError = error?.message || "Failed to fetch domain status";
      await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));
    }
  }

  return c.json(buildEmailSettingsResponse(project, dnsRecords));
});

// ---------------------------------------------------------------------------
// PATCH /api/projects/:id/email-settings — Update order email settings
// ---------------------------------------------------------------------------
projectRoutes.patch("/:id/email-settings", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }
  if (project.userId !== userId) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  const body = await c.req.json<{
    ownerNotificationEmail?: string;
    ownerNotificationEmails?: string[];
    orderCustomerEmailsEnabled?: boolean;
    emailDomain?: string;
  }>();

  if (
    body.ownerNotificationEmails !== undefined ||
    body.ownerNotificationEmail !== undefined
  ) {
    const incomingEmails =
      body.ownerNotificationEmails !== undefined
        ? body.ownerNotificationEmails
        : body.ownerNotificationEmail
          ? [body.ownerNotificationEmail]
          : [];

    const normalized = incomingEmails
      .map((email) => (email || "").trim().toLowerCase())
      .filter((email) => email.length > 0);

    for (const email of normalized) {
      if (!isValidEmail(email)) {
        return c.json(
          { error: `Invalid owner notification email: ${email}`, code: "VALIDATION_ERROR" },
          400,
        );
      }
    }

    const unique = Array.from(new Set(normalized));
    project.ownerNotificationEmails = unique.length > 0 ? unique : undefined;
    project.ownerNotificationEmail = unique[0];
  }

  if (body.orderCustomerEmailsEnabled !== undefined) {
    project.orderCustomerEmailsEnabled = body.orderCustomerEmailsEnabled;
  }

  if (body.emailDomain !== undefined) {
    const normalizedDomain = normalizeDomain(body.emailDomain);
    if (body.emailDomain.trim() && !normalizedDomain) {
      return c.json(
        { error: "Invalid email domain", code: "VALIDATION_ERROR" },
        400,
      );
    }

    if (!normalizedDomain) {
      project.emailDomain = undefined;
      project.emailDomainId = undefined;
      project.emailDomainStatus = "unverified";
      project.emailSenderMode = "platform";
    } else if (normalizedDomain !== project.emailDomain) {
      project.emailDomain = normalizedDomain;
      project.emailDomainId = undefined;
      project.emailDomainStatus = "pending";
      project.emailSenderMode = "platform";
      project.emailLastError = undefined;
    }
  }

  project.updatedAt = new Date().toISOString();
  await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));

  return c.json(buildEmailSettingsResponse(project));
});

// ---------------------------------------------------------------------------
// POST /api/projects/:id/email-domain/verify — Verify Resend email domain
// ---------------------------------------------------------------------------
projectRoutes.post("/:id/email-domain/verify", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }
  if (project.userId !== userId) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }
  if (!project.emailDomain) {
    return c.json(
      {
        error: "Set an email domain before requesting verification",
        code: "VALIDATION_ERROR",
      },
      400,
    );
  }
  if (!c.env.RESEND_API_KEY) {
    return c.json(
      { error: "Resend is not configured on the server", code: "SERVER_ERROR" },
      500,
    );
  }

  try {
    const domainResult = await upsertResendDomain(
      c.env,
      project.emailDomain,
      project.emailDomainId,
    );

    // Trigger verification check each time user requests refresh.
    const verifiedResult = await verifyResendDomain(c.env, domainResult.domainId);

    project.emailDomainId = verifiedResult.domainId;
    project.emailDomainStatus = verifiedResult.status;
    project.emailSenderMode =
      verifiedResult.status === "verified" ? "owner_verified" : "platform";
    project.emailLastVerificationAt = new Date().toISOString();
    project.emailLastError = undefined;
    project.updatedAt = new Date().toISOString();
    await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));

    return c.json(buildEmailSettingsResponse(project, verifiedResult.records));
  } catch (error: any) {
    project.emailDomainStatus = "failed";
    project.emailSenderMode = "platform";
    project.emailLastVerificationAt = new Date().toISOString();
    project.emailLastError = error?.message || "Domain verification failed";
    project.updatedAt = new Date().toISOString();
    await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));

    return c.json(
      {
        error: project.emailLastError,
        code: "EMAIL_DOMAIN_VERIFY_FAILED",
        settings: buildEmailSettingsResponse(project),
      },
      400,
    );
  }
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
    templateId?: string;
    ownerNotificationEmail?: string;
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
  let stripeTestAccountId = undefined;
  let stripeLiveAccountId = undefined;

  // Provision Turso database if it's a webshop
  if (body.type === "webshop") {
    try {
      // Use nanoid prefix so db name starts with a letter, avoids invalid db name errors
      const dbName = `shop-${projectId.substring(0, 8).toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
      console.log(`Attempting to provision Turso database: ${dbName}`);
      const tursoDb = await createTursoDatabase(c.env, dbName);
      
      console.log(`Turso database provisioned successfully: ${tursoDb.url}`);
      databaseUrl = tursoDb.url || undefined;
      databaseToken = tursoDb.token || undefined; // empty string "" → treat as missing

      if (databaseUrl && databaseToken) {
        console.log(`Executing default shop schema on ${databaseUrl}`);
        // Seed it with the default shop schema
        // Wait a moment for DB to be completely available across edge before executing schema
        await new Promise(resolve => setTimeout(resolve, 2000));
        try {
          await createWebshopSchema(databaseUrl, databaseToken);
          await seedTemplateCatalogIfNeeded(
            databaseUrl,
            databaseToken,
            body.templateId as string | undefined,
          );
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

    try {
      const testAccount = await createStripeConnectedAccount(c.env, "test");
      stripeTestAccountId = testAccount.id;
    } catch (error) {
      console.error("[Project Create] Failed to provision Stripe test account", error);
    }

    try {
      const liveAccount = await createStripeConnectedAccount(c.env, "live");
      stripeLiveAccountId = liveAccount.id;
    } catch (error) {
      console.error("[Project Create] Failed to provision Stripe live account", error);
    }
  }

  // Create the project metadata
  const project: Project = {
    id: projectId,
    userId,
    name: sanitizedName,
    model: body.model || "gpt-4o-mini",
    type: body.type || "website",
    templateId: body.templateId,
    databaseUrl,
    databaseToken,
    stripeAccountId: stripeTestAccountId,
    stripeTestAccountId,
    stripeLiveAccountId,
    paymentMode: "off",
    ownerNotificationEmail: body.ownerNotificationEmail?.trim().toLowerCase() || undefined,
    ownerNotificationEmails: body.ownerNotificationEmail?.trim()
      ? [body.ownerNotificationEmail.trim().toLowerCase()]
      : undefined,
    orderCustomerEmailsEnabled: true,
    emailSenderMode: "platform",
    emailDomainStatus: "unverified",
    currentVersion: 0,
    createdAt: now,
    updatedAt: now,
  };

  // Create the initial version with starter template files
  const backendUrl = resolveBackendUrl(c.env, c.req.url);

  const initialVersion = createInitialVersion(
    project.name,
    projectId,
    project.model,
    project.type,
    databaseUrl && databaseToken ? { url: databaseUrl, token: databaseToken } : undefined,
    c.env.STRIPE_PUBLISHABLE_KEY || "",
    backendUrl,
    undefined,
    body.templateId as string | undefined
  );

  // Store everything in parallel: KV metadata + R2 files + user index update
  const existingIds = await c.env.METADATA.get<string[]>(
    `user-projects:${userId}`,
    "json"
  );
  const updatedIds = [projectId, ...(existingIds ?? [])];
  const templateWelcomeMessage = buildTemplateWelcomeMessage(body.templateId, now);
  const initialChatSession: ChatSession | null = templateWelcomeMessage
    ? {
        projectId,
        messages: [templateWelcomeMessage],
        createdAt: now,
        updatedAt: now,
      }
    : null;

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

    ...(initialChatSession
      ? [
          c.env.METADATA.put(
            `chat:${projectId}`,
            JSON.stringify(initialChatSession),
          ),
        ]
      : []),
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

  const isOwnerFiles = project.userId === userId;
  const isCollabFiles = project.collaborators?.some((col) => col.userId === userId);
  if (!isOwnerFiles && !isCollabFiles) {
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

  const isOwner = project.userId === userId;
  const isEditorCollab = project.collaborators?.some(
    (col) => col.userId === userId && col.role === "editor",
  );
  if (!isOwner && !isEditorCollab) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  const body = await c.req.json<{
    name?: string;
    model?: string;
    stripePaymentMethods?: string[];
    paymentMode?: "off" | "test" | "live";
    disconnectStripe?: boolean;
    disconnectStripeMode?: "test" | "live" | "all";
    manualStripeAccountId?: string;
    manualStripeMode?: "test" | "live";
  }>();
  const normalizedManualStripeAccountId = body.manualStripeAccountId?.trim();
  if (body.manualStripeAccountId !== undefined) {
    if (!body.manualStripeMode) {
      return c.json(
        { error: "manualStripeMode is required when saving a Stripe account ID", code: "BAD_REQUEST" },
        400,
      );
    }
    if (!normalizedManualStripeAccountId) {
      return c.json(
        { error: "Stripe account ID cannot be empty", code: "BAD_REQUEST" },
        400,
      );
    }
    if (!normalizedManualStripeAccountId.startsWith("acct_")) {
      return c.json(
        { error: "Stripe account ID must start with acct_", code: "BAD_REQUEST" },
        400,
      );
    }
  }
  const shouldSyncStripeDeployment =
    Boolean(project.deployment_uuid) &&
    (
      body.paymentMode !== undefined ||
      Boolean(body.disconnectStripe) ||
      body.disconnectStripeMode !== undefined ||
      body.manualStripeAccountId !== undefined
    );

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
  if (body.paymentMode) {
    project.paymentMode = body.paymentMode;
  }
  if (normalizedManualStripeAccountId && body.manualStripeMode === "test") {
    project.stripeTestAccountId = normalizedManualStripeAccountId;
    if (project.paymentMode !== "live" || !project.stripeAccountId) {
      project.stripeAccountId = normalizedManualStripeAccountId;
    }
  } else if (normalizedManualStripeAccountId && body.manualStripeMode === "live") {
    project.stripeLiveAccountId = normalizedManualStripeAccountId;
    if (project.paymentMode === "live" || !project.stripeAccountId) {
      project.stripeAccountId = normalizedManualStripeAccountId;
    }
  }
  if (body.disconnectStripe || body.disconnectStripeMode === "all") {
    project.stripeAccountId = undefined;
    project.stripeTestAccountId = undefined;
    project.stripeLiveAccountId = undefined;
    project.paymentMode = "off";
  } else if (body.disconnectStripeMode === "test") {
    project.stripeTestAccountId = undefined;
    if (project.paymentMode === "test") {
      project.paymentMode = "off";
      project.stripeAccountId = project.stripeLiveAccountId;
    }
  } else if (body.disconnectStripeMode === "live") {
    project.stripeLiveAccountId = undefined;
    if (project.paymentMode === "live") {
      project.paymentMode = "off";
      project.stripeAccountId = project.stripeTestAccountId;
    }
  }
  project.updatedAt = new Date().toISOString();

  if (shouldSyncStripeDeployment) {
    await syncCoolifyStripeConfiguration(c.env, project);
  }

  // Persist updated metadata
  await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project));

  return c.json({ project });
});

// ---------------------------------------------------------------------------
// POST /api/projects/:id/sync-stripe — Force sync Stripe configuration to files
// ---------------------------------------------------------------------------

/**
 * Updates the src/lib/stripe.ts file in the project's current version
 * with the latest connected account ID and platform publishable key.
 * This is useful after a user connects Stripe to make the existing shop functional.
 */
projectRoutes.post("/:id/sync-stripe", async (c) => {
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

  if (!project.stripeAccountId && !project.stripeTestAccountId && !project.stripeLiveAccountId) {
    return c.json({ error: "No Stripe account connected", code: "STRIPE_NOT_CONNECTED" }, 400);
  }

  // 1. Read the current version files from R2
  const versionKey = `${projectId}/v${project.currentVersion}/files.json`;
  const versionObject = await c.env.FILES.get(versionKey);

  if (!versionObject) {
    return c.json({ error: "Version files not found", code: "NOT_FOUND" }, 404);
  }

  const version = (await versionObject.json()) as Version;
  const files = version.files || [];

  // 2. Build the updated stripe.ts content
  const stripeConfig = getStripePublishConfig(c.env, project);
  const stripeKey = stripeConfig.publishableKey || c.env.STRIPE_PUBLISHABLE_KEY || "";
  const stripeAccountId =
    stripeConfig.accountId ||
    project.stripeTestAccountId ||
    project.stripeLiveAccountId ||
    project.stripeAccountId ||
    "";

  const paymentsTsContent = `type PaymentMode = "off" | "test" | "live";

interface CheckoutPayload {
  items: Array<{
    productId?: string;
    name: string;
    unitAmount: number;
    quantity: number;
    image?: string;
    isVirtual?: boolean;
  }>;
  successUrl?: string;
  cancelUrl?: string;
  requiresShipping?: boolean;
}

interface PaymentState {
  mode: PaymentMode;
  canCheckout: boolean;
  headline: string;
  message: string;
  ctaLabel: string;
}

interface StripeRequirements {
  currentlyDue: string[];
  eventuallyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
}

export interface StripeAccountStatus {
  accountId: string;
  type: string;
  mode: Exclude<PaymentMode, "off">;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  transferCapabilityActive: boolean;
  requiresAction: boolean;
  isReady: boolean;
  summary: string;
  requirements: StripeRequirements;
}

const paymentMode = '${stripeConfig.mode}' as PaymentMode;

export function getPaymentState(): PaymentState {
  if (paymentMode === "live") {
    return {
      mode: "live",
      canCheckout: true,
      headline: "Live payments are active",
      message: "Customers can place real orders and Stripe will route payouts to the connected account.",
      ctaLabel: "Buy now",
    };
  }

  if (paymentMode === "test") {
    return {
      mode: "test",
      canCheckout: true,
      headline: "Test mode is active",
      message: "Use Stripe test cards to validate checkout before going live.",
      ctaLabel: "Test checkout",
    };
  }

  return {
    mode: "off",
    canCheckout: false,
    headline: "Publish to test payments",
    message: "Payments are not available in the live preview. Publish your shop to test checkout with Stripe.",
    ctaLabel: "Publish to test payments",
  };
}

function summarizeStripeStatus(status: StripeAccountStatus): string {
  if (status.requirements.currentlyDue.length > 0) {
    return "Stripe still needs: " + status.requirements.currentlyDue.join(", ");
  }

  if (!status.detailsSubmitted) {
    return "Finish Stripe onboarding to submit your connected account details.";
  }

  if (!status.chargesEnabled || !status.payoutsEnabled || !status.transferCapabilityActive) {
    return "Stripe account setup is incomplete. Review the connected account before accepting payments.";
  }

  if (status.requirements.pendingVerification.length > 0) {
    return "Stripe is reviewing submitted information for this connected account.";
  }

  return "Stripe is connected and ready to accept payments.";
}

export async function getStripeAccountStatus(): Promise<StripeAccountStatus | null> {
  if (paymentMode === "off") {
    return null;
  }

  const response = await fetch('/api/stripe/account-status');
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to load Stripe account status');
  }

  const status: StripeAccountStatus = {
    accountId: data.accountId,
    type: data.type || 'unknown',
    mode: data.mode,
    detailsSubmitted: Boolean(data.detailsSubmitted),
    chargesEnabled: Boolean(data.chargesEnabled),
    payoutsEnabled: Boolean(data.payoutsEnabled),
    transferCapabilityActive: Boolean(data.transferCapabilityActive),
    requiresAction: Boolean(data.requiresAction),
    isReady: Boolean(data.isReady),
    summary: '',
    requirements: {
      currentlyDue: data.requirements?.currentlyDue || [],
      eventuallyDue: data.requirements?.eventuallyDue || [],
      pastDue: data.requirements?.pastDue || [],
      pendingVerification: data.requirements?.pendingVerification || [],
      disabledReason: data.requirements?.disabledReason || null,
    },
  };

  status.summary = data.summary || summarizeStripeStatus(status);
  return status;
}

export async function startStripeOnboarding(returnUrl?: string) {
  if (paymentMode === "off") {
    throw new Error('Payments are disabled for this shop.');
  }

  const response = await fetch('/api/stripe/account-onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      returnUrl: returnUrl || window.location.href,
      refreshUrl: window.location.href,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Failed to open Stripe onboarding');
  }

  return data.url as string;
}

export async function beginCheckout({ items, successUrl, cancelUrl, requiresShipping = false }: CheckoutPayload) {
  const state = getPaymentState();
  if (!state.canCheckout) {
    throw new Error(state.message);
  }

  const normalizedItems = items
    .map((item) => ({
      ...item,
      unitAmount: Math.max(1, Math.round(Number(item.unitAmount) || 0)),
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
    }))
    .filter((item) => item.name && Number.isFinite(item.unitAmount) && item.unitAmount > 0);

  if (normalizedItems.length === 0) {
    throw new Error('No valid checkout items found.');
  }

  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: normalizedItems,
      currency: 'eur',
      successUrl: successUrl || window.location.origin + '/success',
      cancelUrl: cancelUrl || window.location.origin + '/cart',
      requiresShipping,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.url) {
    throw new Error(data.error || 'Failed to initialize checkout');
  }
  return data.url as string;
}

export const stripePromise = Promise.resolve(null);
`;

  const stripeTsContent = `import {
  beginCheckout,
  getPaymentState,
  getStripeAccountStatus,
  startStripeOnboarding,
  stripePromise,
} from './payments';

export { getPaymentState, getStripeAccountStatus, startStripeOnboarding, stripePromise };

export async function createCheckoutSession(
  items: Array<{ productId?: string; name: string; unitAmount: number; quantity: number; image?: string; isVirtual?: boolean }>,
  successUrl?: string,
  cancelUrl?: string,
  requiresShipping?: boolean,
) {
  return beginCheckout({ items, successUrl, cancelUrl, requiresShipping });
}
`;

  // 3. Update or add managed payment helper files
  const paymentsTsPath = "src/lib/payments.ts";
  const stripeTsPath = "src/lib/stripe.ts";
  const paymentsIndex = files.findIndex(f => f.path === paymentsTsPath);
  const stripeIndex = files.findIndex(f => f.path === stripeTsPath);

  if (paymentsIndex !== -1) {
    files[paymentsIndex].content = paymentsTsContent;
  } else {
    files.push({ path: paymentsTsPath, content: paymentsTsContent });
  }

  if (stripeIndex !== -1) {
    files[stripeIndex].content = stripeTsContent;
  } else {
    files.push({ path: stripeTsPath, content: stripeTsContent });
  }

  // 4. Increment project version (optional, but cleaner) or just update current?
  // Let's create a new version so the user can see it in history as "Stripe Synced"
  const nextVersionNumber = project.currentVersion + 1;
  const now = new Date().toISOString();

  const newVersion: Version = {
    versionNumber: nextVersionNumber,
    prompt: "Synced Stripe configuration",
    model: project.model,
    files: files,
    changedFiles: [paymentsTsPath, stripeTsPath],
    type: "manual",
    createdAt: now,
    fileCount: files.length,
  };

  project.currentVersion = nextVersionNumber;
  project.updatedAt = now;

  // 5. Save back to KV and R2
  await Promise.all([
    c.env.METADATA.put(`project:${projectId}`, JSON.stringify(project)),
    c.env.FILES.put(`${projectId}/v${nextVersionNumber}/files.json`, JSON.stringify(newVersion))
  ]);

  // 6. If already deployed on Coolify, update env vars and redeploy so Stripe works on the live site
  if (project.deployment_uuid) {
    await syncCoolifyStripeConfiguration(c.env, project);
  }

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
  {
    const canWrite = project.userId === userId || project.collaborators?.some((col) => col.userId === userId && col.role === "editor");
    if (!canWrite) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

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
  {
    const canRead = project.userId === userId || project.collaborators?.some((col) => col.userId === userId);
    if (!canRead) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

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
  const backendUrl = resolveBackendUrl(c.env, c.req.url);

  if (!COOLIFY_API_KEY) {
    return c.json({ error: "Deployment environment variables missing. Add them to .dev.vars or env.", code: "SERVER_ERROR" }, 500);
  }

  try {
    const body = await c.req.json<{ customDomain?: string }>().catch(() => ({ customDomain: undefined }));
    const customDomain = body.customDomain;

    const res = await c.env.FILES.get(`${projectId}/v${project.currentVersion}/files.json`);
    const filesData = await res?.json<{ files: any[] }>();
    const files = [...(filesData?.files || [])];
    
    if (files.length === 0) return c.json({ error: "No files to publish", code: "NOT_FOUND" }, 400);
    const stripeConfig = getStripePublishConfig(c.env, project);
    const { paymentsTsContent, stripeTsContent } = buildManagedStripeFiles(stripeConfig);
    const upsertFile = (path: string, content: string) => {
      const idx = files.findIndex((file) => file.path === path);
      if (idx >= 0) {
        files[idx] = { ...files[idx], content };
      } else {
        files.push({ path, content });
      }
    };
    upsertFile("src/lib/payments.ts", paymentsTsContent);
    upsertFile("src/lib/stripe.ts", stripeTsContent);

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
          
          pkg.dependencies = pkg.dependencies || {};
          if (!pkg.dependencies["stripe"]) pkg.dependencies["stripe"] = "^17.0.0";

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
          if (content.includes("server:")) {
            // Already has a server block — inject allowedHosts into it to avoid duplicate key
            content = content.replace(/server\s*:\s*\{/, "server: {\n    allowedHosts: true,\n    watch: null,");
          } else {
            // No server block yet — add one inline (watch: null disables file-watching in Docker)
            content = content.replace("defineConfig({", "defineConfig({ server: { allowedHosts: true, watch: null }, ");
          }
        }
        if (!content.includes("stripeApiPlugin")) {
          content = `import { stripeApiPlugin } from './stripe-api-plugin';\n` + content;
          content = content.replace(/plugins:\s*\[/, "plugins: [stripeApiPlugin(), ");
        }
      }

      if (f.path === "index.html") {
        content = ensureTailwindCdn(content);
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
        content: ensureTailwindCdn(`<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>Web AGT App</title>\n</head>\n<body>\n<div id="root"></div>\n<script type="module" src="/src/index.tsx"></script>\n</body>\n</html>`)
      });
    }

    if (!hasViteConfig) {
      tree.push({
        path: "vite.config.ts",
        mode: "100644",
        type: "blob",
        content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nimport { stripeApiPlugin } from './stripe-api-plugin'\n\nexport default defineConfig({\n  plugins: [stripeApiPlugin(), react()],\n  server: {\n    allowedHosts: true,\n    watch: null\n  }\n})`
      });
    }

    // Inject a Stripe checkout API server plugin so deployed apps are self-contained
    tree.push({
      path: "stripe-api-plugin.ts",
      mode: "100644",
      type: "blob",
      content: `import type { Plugin } from 'vite';

type StripeMode = 'test' | 'live';
type PaymentMode = 'off' | 'test' | 'live';

function writeJson(res: any, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function getOrigin(req: any) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? protocol + '://' + host : 'http://localhost:3000';
}

function getDashboardUrl(mode: StripeMode, accountId: string) {
  return mode === 'live'
    ? 'https://dashboard.stripe.com/connect/accounts/' + accountId
    : 'https://dashboard.stripe.com/test/connect/accounts/' + accountId;
}

function hasTransferCapability(account: any) {
  const capabilities = account?.capabilities || {};
  return capabilities.transfers === 'active' || capabilities.legacy_payments === 'active';
}

function buildAccountStatus(account: any, mode: StripeMode) {
  const requirements = account?.requirements || {};
  const currentlyDue = requirements.currently_due || [];
  const pastDue = requirements.past_due || [];
  const pendingVerification = requirements.pending_verification || [];
  const eventuallyDue = requirements.eventually_due || [];
  const disabledReason = requirements.disabled_reason || null;
  const transferCapabilityActive = hasTransferCapability(account);
  const isReady =
    Boolean(account?.details_submitted) &&
    Boolean(account?.charges_enabled) &&
    Boolean(account?.payouts_enabled) &&
    transferCapabilityActive &&
    currentlyDue.length === 0 &&
    pastDue.length === 0 &&
    !disabledReason;

  let summary = 'Stripe is connected and ready to accept payments.';
  if (currentlyDue.length > 0) {
    summary = 'Stripe still needs: ' + currentlyDue.join(', ');
  } else if (!account?.details_submitted) {
    summary = 'Finish Stripe onboarding to submit your connected account details.';
  } else if (!account?.charges_enabled || !account?.payouts_enabled || !transferCapabilityActive) {
    summary = 'Stripe account setup is incomplete. Review the connected account before accepting payments.';
  } else if (pendingVerification.length > 0) {
    summary = 'Stripe is reviewing submitted information for this connected account.';
  }

  return {
    accountId: account.id,
    type: account.type || 'unknown',
    mode,
    detailsSubmitted: Boolean(account?.details_submitted),
    chargesEnabled: Boolean(account?.charges_enabled),
    payoutsEnabled: Boolean(account?.payouts_enabled),
    transferCapabilityActive,
    requiresAction: !isReady,
    isReady,
    summary,
    requirements: {
      currentlyDue,
      eventuallyDue,
      pastDue,
      pendingVerification,
      disabledReason,
    },
  };
}

async function readJson(req: any) {
  let body = '';
  await new Promise<void>((resolve, reject) => {
    req.on('data', (chunk: any) => {
      body += chunk;
    });
    req.on('end', () => resolve());
    req.on('error', (error: any) => reject(error));
  });

  return body ? JSON.parse(body) : {};
}

export function stripeApiPlugin(): Plugin {
  return {
    name: 'stripe-checkout-api',
    configureServer(server) {
      server.middlewares.use('/api/stripe/account-status', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.method !== 'GET') { res.writeHead(405); res.end('Method not allowed'); return; }

        try {
          const paymentMode = (process.env.VITE_PAYMENT_MODE || 'off') as PaymentMode;
          if (paymentMode === 'off') {
            writeJson(res, 400, { error: 'Payments are disabled for this shop', code: 'PAYMENTS_DISABLED' });
            return;
          }

          const Stripe = (await import('stripe')).default;
          const secretKey = process.env.STRIPE_SECRET_KEY;
          const connectedAccountId = process.env.STRIPE_ACCOUNT_ID;

          if (!secretKey) { writeJson(res, 500, { error: 'STRIPE_SECRET_KEY not configured' }); return; }
          if (!connectedAccountId) { writeJson(res, 400, { error: 'No Stripe account connected', code: 'STRIPE_NOT_CONNECTED' }); return; }

          const stripe = new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' });
          const account = await stripe.accounts.retrieve(connectedAccountId);
          if ('deleted' in account) {
            writeJson(res, 404, { error: 'Stripe account not found', code: 'STRIPE_ACCOUNT_NOT_FOUND' });
            return;
          }

          writeJson(res, 200, buildAccountStatus(account, paymentMode));
        } catch (err: any) {
          writeJson(res, 500, { error: err.message || 'Failed to load Stripe account status' });
        }
      });

      server.middlewares.use('/api/stripe/account-onboarding', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }

        try {
          const paymentMode = (process.env.VITE_PAYMENT_MODE || 'off') as PaymentMode;
          if (paymentMode === 'off') {
            writeJson(res, 400, { error: 'Payments are disabled for this shop', code: 'PAYMENTS_DISABLED' });
            return;
          }

          const Stripe = (await import('stripe')).default;
          const secretKey = process.env.STRIPE_SECRET_KEY;
          const connectedAccountId = process.env.STRIPE_ACCOUNT_ID;

          if (!secretKey) { writeJson(res, 500, { error: 'STRIPE_SECRET_KEY not configured' }); return; }
          if (!connectedAccountId) { writeJson(res, 400, { error: 'No Stripe account connected', code: 'STRIPE_NOT_CONNECTED' }); return; }

          const stripe = new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' });
          const account = await stripe.accounts.retrieve(connectedAccountId);
          if ('deleted' in account) {
            writeJson(res, 404, { error: 'Stripe account not found', code: 'STRIPE_ACCOUNT_NOT_FOUND' });
            return;
          }

          const body = await readJson(req);
          if (account.type === 'standard') {
            writeJson(res, 200, { url: getDashboardUrl(paymentMode, connectedAccountId) });
            return;
          }

          const origin = getOrigin(req);
          const returnUrl = body.returnUrl || origin;
          const refreshUrl = body.refreshUrl || returnUrl;
          const accountLink = await stripe.accountLinks.create({
            account: connectedAccountId,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: 'account_onboarding',
          });

          writeJson(res, 200, { url: accountLink.url });
        } catch (err: any) {
          writeJson(res, 500, { error: err.message || 'Failed to open Stripe onboarding' });
        }
      });

      server.middlewares.use('/api/checkout', async (req: any, res: any) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }

        try {
          const paymentMode = (process.env.VITE_PAYMENT_MODE || 'off') as PaymentMode;
          if (paymentMode === 'off') {
            writeJson(res, 400, { error: 'Payments are disabled for this shop', code: 'PAYMENTS_DISABLED' });
            return;
          }

          const Stripe = (await import('stripe')).default;
          const secretKey = process.env.STRIPE_SECRET_KEY;
          const connectedAccountId = process.env.STRIPE_ACCOUNT_ID;
          const commissionPercent = Number(process.env.PLATFORM_COMMISSION_PERCENT || '25');

          if (!secretKey) { writeJson(res, 500, { error: 'STRIPE_SECRET_KEY not configured' }); return; }
          if (!connectedAccountId) { writeJson(res, 400, { error: 'No Stripe account connected', code: 'STRIPE_NOT_CONNECTED' }); return; }

          const stripe = new Stripe(secretKey, { apiVersion: '2025-01-27.acacia' });
          const account = await stripe.accounts.retrieve(connectedAccountId);
          if ('deleted' in account) {
            writeJson(res, 404, { error: 'Stripe account not found', code: 'STRIPE_ACCOUNT_NOT_FOUND' });
            return;
          }

          const accountStatus = buildAccountStatus(account, paymentMode);
          if (!accountStatus.isReady) {
            writeJson(res, 400, {
              error: accountStatus.summary,
              code: 'STRIPE_ONBOARDING_INCOMPLETE',
              account: accountStatus,
            });
            return;
          }

          const { items, currency, successUrl, cancelUrl, requiresShipping } = await readJson(req);
          const projectId = process.env.VITE_PROJECT_ID;
          const fallbackOrigin = getOrigin(req);

          const upstream = await fetch('${backendUrl}/api/stripe/checkout_sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              items,
              currency: currency || 'eur',
              successUrl: successUrl || fallbackOrigin + '/success',
              cancelUrl: cancelUrl || fallbackOrigin + '/cart',
              requiresShipping: Boolean(requiresShipping),
            }),
          });

          const raw = await upstream.text();
          let payload: any = null;
          try {
            payload = raw ? JSON.parse(raw) : {};
          } catch {
            const looksLikeHtml = /^\s*<!doctype html>/i.test(raw) || /^\s*<html/i.test(raw);
            payload = {
              error: looksLikeHtml
                ? 'Checkout backend is misconfigured and returned HTML instead of JSON. Set PUBLIC_WORKER_URL to your public worker API URL and republish.'
                : (raw || 'Failed to initialize checkout'),
            };
          }

          writeJson(res, upstream.status, payload);
        } catch (err: any) {
          writeJson(res, 500, { error: err.message || 'Failed to initialize checkout' });
        }
      });
    }
  };
}
`
    });

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
      content: `FROM node:22-bullseye-slim\nWORKDIR /app\nCOPY . .\nENV PRISMA_SKIP_POSTINSTALL_GENERATE=true\nRUN npm install --no-audit --no-fund --legacy-peer-deps\nEXPOSE 3000\nCMD ["/bin/sh", "-c", "ulimit -n 65535 && npm run dev"]`
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

    const deploymentUuid = await syncCoolifyStripeConfiguration(c.env, project);

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

// ---------------------------------------------------------------------------
// POST /api/projects/:id/provision-database
// Re-provision a Turso database for projects where it failed during creation.
// Safe to call multiple times — skips if the project already has a database.
// ---------------------------------------------------------------------------

projectRoutes.post("/:id/provision-database", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project) return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);

  const isOwner = project.userId === userId;
  const isCollaborator = (project.collaborators ?? []).some((col: any) => col.userId === userId);
  if (!isOwner && !isCollaborator) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);

  // Already has a working database
  if (project.databaseUrl && project.databaseToken) {
    return c.json({ message: "Database already provisioned", databaseUrl: project.databaseUrl });
  }

  try {
    const dbName = `shop-${projectId.substring(0, 8).toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
    const tursoDb = await createTursoDatabase(c.env, dbName);

    const databaseUrl = tursoDb.url || undefined;
    const databaseToken = tursoDb.token || undefined;

    if (!databaseUrl || !databaseToken) {
      return c.json({ error: "Database provisioning succeeded but returned an empty token. Please try again in a few seconds." }, 500);
    }

    // Apply schema
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      await createWebshopSchema(databaseUrl, databaseToken);
      await seedTemplateCatalogIfNeeded(databaseUrl, databaseToken, project.templateId);
    } catch (schemaErr) {
      console.error("[Provision DB] Schema error (non-fatal):", schemaErr);
    }

    // Persist updated project
    const updatedProject: Project = {
      ...project,
      databaseUrl,
      databaseToken,
      updatedAt: new Date().toISOString(),
    };
    await c.env.METADATA.put(`project:${projectId}`, JSON.stringify(updatedProject));

    return c.json({ success: true, databaseUrl, project: updatedProject });
  } catch (err: any) {
    console.error("[Provision DB] Error:", err);
    return c.json({ error: err.message || "Failed to provision database" }, 500);
  }
});

// ---------------------------------------------------------------------------
// GET /api/projects/:id/orders/:orderId/invoice — Generate & return invoice HTML
// ---------------------------------------------------------------------------
projectRoutes.get("/:id/orders/:orderId/invoice", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("id");
  const orderId = c.req.param("orderId");

  const project = await c.env.METADATA.get<Project>(`project:${projectId}`, "json");
  if (!project) return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  if (project.userId !== userId) return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);

  if (!project.databaseUrl || !project.databaseToken) {
    return c.json({ error: "No database configured for this project", code: "NO_DB" }, 400);
  }

  try {
    const { createClient } = await import("@libsql/client/web");
    const db = createClient({ url: project.databaseUrl, authToken: project.databaseToken });

    // Fetch order
    const orderRes = await db.execute({
      sql: `SELECT o.id, o.orderNumber, o.status, o.totalAmount, o.currency,
                   o.shippingAddress, o.billingAddress, o.createdAt,
                   o.firstName, o.lastName, o.email
            FROM [Order] o WHERE o.id = ? LIMIT 1`,
      args: [orderId],
    });
    if (orderRes.rows.length === 0) {
      return c.json({ error: "Order not found", code: "NOT_FOUND" }, 404);
    }
    const order = orderRes.rows[0] as any;

    // Fetch order items
    const itemsRes = await db.execute({
      sql: `SELECT oi.name, oi.unitPrice, oi.quantity, oi.sku
            FROM OrderItem oi WHERE oi.orderId = ?`,
      args: [orderId],
    });

    // Fetch default tax rate
    let taxRate = 21;
    try {
      const tgRes = await db.execute("SELECT rate FROM TaxGroup WHERE isDefault = 1 LIMIT 1");
      if (tgRes.rows[0]) taxRate = Number((tgRes.rows[0] as any).rate) || 21;
    } catch { /* fallback */ }

    const { buildInvoiceHtml, buildInvoiceNumber } = await import("../services/invoice-pdf");

    const items = itemsRes.rows.map((r: any) => ({
      name: String(r.name),
      quantity: Number(r.quantity),
      unitPrice: Number(r.unitPrice),
      taxRate,
    }));

    const total = Number(order.totalAmount);
    const subtotal = items.length > 0
      ? items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0)
      : total;
    const taxAmount = subtotal * (taxRate / 100);
    const currency = String(order.currency || "EUR").toUpperCase();

    let billingAddress: string | undefined;
    let shippingAddress: string | undefined;
    try { billingAddress = order.billingAddress ? JSON.stringify(JSON.parse(order.billingAddress)) : undefined; } catch { /* ignore */ }
    try { shippingAddress = order.shippingAddress ? JSON.stringify(JSON.parse(order.shippingAddress)) : undefined; } catch { /* ignore */ }

    const customerName = [order.firstName, order.lastName].filter(Boolean).join(" ") || undefined;
    const orderNumber = String(order.orderNumber);
    const invoiceNumber = buildInvoiceNumber(orderNumber);

    const invoiceHtml = buildInvoiceHtml({
      invoiceNumber,
      orderNumber,
      shopName: project.name,
      date: new Date(String(order.createdAt)).toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" }),
      customerName,
      customerEmail: order.email ? String(order.email) : undefined,
      billingAddress,
      shippingAddress,
      items: items.length > 0 ? items : [{ name: project.name, quantity: 1, unitPrice: total, taxRate }],
      subtotal,
      taxAmount,
      taxRate,
      shippingAmount: 0,
      total,
      currency,
    });

    return new Response(invoiceHtml, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="${invoiceNumber}.html"`,
      },
    });
  } catch (err) {
    console.error("[invoice] Error generating invoice:", err);
    return c.json({ error: "Failed to generate invoice" }, 500);
  }
});

export { projectRoutes };
