/**
 * lib/api-client.ts
 *
 * Typed fetch wrapper for communicating with the Cloudflare Worker backend.
 * Automatically attaches Clerk Bearer tokens to all requests and provides
 * typed methods for each API endpoint.
 *
 * Usage (in a client component):
 *   const { getToken } = useAuth();
 *   const client = createApiClient(getToken);
 *   const { projects } = await client.projects.list();
 *
 * All methods throw on non-2xx responses with a consistent error shape.
 *
 * Used by: dashboard page, project editor, settings page
 */

import type { Project, ProjectFile, VersionMeta } from "@/types/project";
import type { ChatMessage } from "@/types/chat";
import type { AnalyticsData } from "@/types/analytics";

/**
 * Base URL for the Worker API.
 * In development: http://localhost:8787
 * In production: set via NEXT_PUBLIC_WORKER_URL environment variable
 *
 * Exported so the editor page can use it for SSE streaming requests.
 */
export const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";

/**
 * Base URL for the Chat/AI generation service (Fly.io).
 * Falls back to WORKER_URL when not set (local dev).
 */
export const CHAT_URL =
  process.env.NEXT_PUBLIC_CHAT_URL || WORKER_URL;

/**
 * Consistent error shape returned by all API errors.
 */
export interface ApiError {
  error: string;
  code: string;
}

interface CreditsResponse {
  remaining: number;
  total: number;
  plan: "free" | "pro";
  periodEnd: string;
  isUnlimited: boolean;
}

const CREDITS_CACHE_TTL_MS = 30_000;
let creditsCache:
  | { value: CreditsResponse; expiresAt: number }
  | null = null;

/** Bust the in-memory credits cache so the next call fetches fresh data. */
export function bustCreditsCache() {
  creditsCache = null;
}
let creditsInFlight: Promise<CreditsResponse> | null = null;

export interface EmailDnsRecord {
  record: string;
  name: string;
  value: string;
  ttl: string;
  status: string;
}

export interface ProjectEmailSettings {
  ownerNotificationEmail: string;
  ownerNotificationEmails: string[];
  orderCustomerEmailsEnabled: boolean;
  emailSenderMode: "platform" | "owner_verified";
  emailDomain: string;
  emailDomainStatus: "unverified" | "pending" | "verified" | "failed";
  emailLastVerificationAt?: string;
  emailLastError?: string;
  dnsRecords: EmailDnsRecord[];
}

/**
 * A function that returns a Clerk session token.
 * Matches the return type of `useAuth().getToken()`.
 */
type GetTokenFunction = () => Promise<string | null>;

/**
 * Makes an authenticated fetch request to the Worker API.
 * Attaches the Clerk Bearer token and handles error responses.
 *
 * @param getToken - Function to get the current Clerk session token
 * @param path - API path (e.g., "/api/projects")
 * @param options - Standard fetch RequestInit options
 * @returns Parsed JSON response
 * @throws Error with message from API on non-2xx responses
 */
async function authenticatedFetch<T>(
  getToken: GetTokenFunction,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getToken();

  if (!token) {
    // Clerk is still initializing — caller should guard with isLoaded before calling
    throw Object.assign(new Error("Not authenticated — no session token available"), {
      isAuthError: true,
    });
  }

  // Retry up to 3 times on network errors (TypeError = connection refused / DNS failure).
  // This handles the brief window after login/registration where the worker may not
  // yet be reachable, or the local wrangler dev server is still starting up.
  let response: Response | undefined;
  let lastNetworkError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await fetch(`${WORKER_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      });
      lastNetworkError = undefined;
      break;
    } catch (err) {
      lastNetworkError = err;
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
  }
  if (!response) {
    throw Object.assign(lastNetworkError instanceof Error ? lastNetworkError : new Error("Network error"), {
      isNetworkError: true,
    });
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({
      error: "Unknown error",
      code: "UNKNOWN",
    }))) as { error?: string; code?: string; retryAfter?: number };

    // Dispatch a global event on 429 so the RateLimitProvider can show the banner
    if (response.status === 429) {
      const retryAfter = errorBody.retryAfter ?? 60;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("rate-limited", { detail: { retryAfter } }),
        );
      }
    }

    throw new Error(errorBody.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function getCreditsWithCache(
  getToken: GetTokenFunction,
): Promise<CreditsResponse> {
  // Keep server behavior deterministic; cache only in browser runtime.
  if (typeof window === "undefined") {
    return authenticatedFetch<CreditsResponse>(getToken, "/api/credits");
  }

  const now = Date.now();
  if (creditsCache && creditsCache.expiresAt > now) {
    return creditsCache.value;
  }

  if (creditsInFlight) {
    return creditsInFlight;
  }

  creditsInFlight = authenticatedFetch<CreditsResponse>(getToken, "/api/credits")
    .then((value) => {
      creditsCache = {
        value,
        expiresAt: Date.now() + CREDITS_CACHE_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      creditsInFlight = null;
    });

  return creditsInFlight;
}

/**
 * Creates a typed API client bound to the current user's session.
 * All methods automatically include the Clerk Bearer token.
 *
 * @param getToken - Function to get the Clerk session token (from useAuth())
 * @returns Object with typed API methods grouped by resource
 */
export function createApiClient(getToken: GetTokenFunction) {
  return {
    projects: {
      /**
       * List all projects for the authenticated user.
       * @returns Object with projects array sorted by most recently updated
       */
      list: () =>
        authenticatedFetch<{ projects: Project[] }>(getToken, "/api/projects"),

      /**
       * Get a single project by ID.
       * @param id - The project ID to fetch
       * @returns Object with the project data
       */
      get: (id: string) =>
        authenticatedFetch<{ project: Project }>(
          getToken,
          `/api/projects/${id}`,
        ),

      /**
       * Get the current version files for a project.
       * Returns the file array from R2 for the project's current version.
       *
       * @param id - The project ID to fetch files for
       * @returns Object with files array and current version number
       */
      getFiles: (id: string) =>
        authenticatedFetch<{ files: ProjectFile[]; version: number }>(
          getToken,
          `/api/projects/${id}/files`,
        ),

      /**
       * Create a new project with starter template files.
       * @param data - Project name, model, and optional description
       * @returns Object with the newly created project
       */
      create: (data: {
        name: string;
        model: string;
        description?: string;
        type?: "website" | "webshop";
        templateId?: string;
        ownerNotificationEmail?: string;
      }) =>
        authenticatedFetch<{ project: Project }>(getToken, "/api/projects", {
          method: "POST",
          body: JSON.stringify(data),
        }),

      /**
       * Update a project's name or model.
       * @param id - The project ID to update
       * @param data - Fields to update (name and/or model)
       * @returns Object with the updated project
       */
      update: (
        id: string,
        data: {
          name?: string;
          model?: string;
          stripePaymentMethods?: string[];
          paymentMode?: "off" | "test" | "live";
          disconnectStripe?: boolean;
          disconnectStripeMode?: "test" | "live" | "all";
          manualStripeAccountId?: string;
          manualStripeMode?: "test" | "live";
        },
      ) =>
        authenticatedFetch<{ project: Project }>(
          getToken,
          `/api/projects/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          },
        ),

      /**
       * Force sync Stripe configuration to project files.
       * Creates a new project version with updated src/lib/stripe.ts.
       *
       * @param id - The project ID
       * @returns Object with updated project and version number
       */
      provisionDatabase: (id: string) =>
        authenticatedFetch<{ success: boolean; databaseUrl: string; project: Project }>(
          getToken,
          `/api/projects/${id}/provision-database`,
          { method: "POST" }
        ),

      syncStripe: (id: string) =>
        authenticatedFetch<{ project: Project; version: number }>(
          getToken,
          `/api/projects/${id}/sync-stripe`,
          { method: "POST" },
        ),

      publish: (id: string, customDomain?: string) =>
        authenticatedFetch<{ url: string; deploymentUuid: string }>(
          getToken,
          `/api/projects/${id}/publish`,
          { 
            method: "POST",
            body: JSON.stringify({ customDomain })
          },
        ),

      getDeploymentStatus: (id: string, deploymentUuid: string) =>
        authenticatedFetch<{ status: string; logs: string }>(
          getToken,
          `/api/projects/${id}/deployment/${deploymentUuid}`,
          { method: "GET" },
        ),

      getLogs: (id: string, opts?: { level?: string; limit?: number }) => {
        const params = new URLSearchParams();
        if (opts?.level) params.set("level", opts.level);
        if (opts?.limit) params.set("limit", String(opts.limit));
        const qs = params.toString() ? `?${params}` : "";
        return authenticatedFetch<{ logs: any[]; total: number; source?: string; noDatabase?: boolean }>(
          getToken,
          `/api/projects/${id}/logs${qs}`,
        );
      },

      writeLogs: (id: string, entries: Array<{ level: string; source: string; message: string; detail?: string }>) =>
        authenticatedFetch<{ ok: boolean }>(
          getToken,
          `/api/projects/${id}/logs`,
          { method: "POST", body: JSON.stringify({ entries }) },
        ),

      getEmailSettings: (id: string) =>
        authenticatedFetch<ProjectEmailSettings>(
          getToken,
          `/api/projects/${id}/email-settings`,
        ),

      updateEmailSettings: (
        id: string,
        data: {
          ownerNotificationEmail?: string;
          ownerNotificationEmails?: string[];
          orderCustomerEmailsEnabled?: boolean;
          emailDomain?: string;
        },
      ) =>
        authenticatedFetch<ProjectEmailSettings>(
          getToken,
          `/api/projects/${id}/email-settings`,
          {
            method: "PATCH",
            body: JSON.stringify(data),
          },
        ),

      verifyEmailDomain: (id: string) =>
        authenticatedFetch<ProjectEmailSettings>(
          getToken,
          `/api/projects/${id}/email-domain/verify`,
          { method: "POST" },
        ),

      /**
       * Delete a project and all its associated files.
       * @param id - The project ID to delete
       * @returns Object with success boolean
       */
      delete: (id: string) =>
        authenticatedFetch<{ success: boolean }>(
          getToken,
          `/api/projects/${id}`,
          { method: "DELETE" },
        ),

      /**
       * Get project thumbnail.
       */
      getThumbnail: (id: string) =>
        authenticatedFetch<{ thumbnail: string | null }>(
          getToken,
          `/api/projects/${id}/thumbnail`,
        ),

      /**
       * Save project thumbnail.
       */
      saveThumbnail: (id: string, thumbnail: string) =>
        authenticatedFetch<{ success: boolean }>(
          getToken,
          `/api/projects/${id}/thumbnail`,
          {
            method: "POST",
            body: JSON.stringify({ thumbnail }),
          }
        ),
    },

    chat: {
      /**
       * Get chat history for a project.
       * Returns all previous messages for restoring chat on page load.
       *
       * @param projectId - The project ID to fetch chat history for
       * @returns Object with messages array
       */
      getHistory: (projectId: string) =>
        authenticatedFetch<{ messages: ChatMessage[] }>(
          getToken,
          `/api/chat/${projectId}`,
        ),
    },

    credits: {
      /**
       * Get the authenticated user's current credit balance and plan info.
       * Triggers lazy period reset if the billing period has expired.
       *
       * @returns Credit balance, plan, period end, and unlimited flag
       */
      get: () => getCreditsWithCache(getToken),

      /**
       * Sync plan from Clerk API — call after checkout completes.
       * Checks the user's active Clerk subscriptions and upgrades KV if needed.
       *
       * @returns Updated credits + whether an upgrade occurred
       */
      sync: () =>
        authenticatedFetch<{
          synced: boolean;
          upgraded: boolean;
          credits: CreditsResponse;
        }>(getToken, "/api/credits/sync", { method: "POST" }),

      /**
       * Check whether the user has seen the onboarding modal (stored in KV,
       * not localStorage, so it persists across devices).
       */
      getOnboardingSeen: () =>
        authenticatedFetch<{ seen: boolean }>(
          getToken,
          "/api/credits/onboarding"
        ),

      /**
       * Mark the onboarding modal as seen in KV.
       */
      markOnboardingSeen: () =>
        authenticatedFetch<{ ok: boolean }>(getToken, "/api/credits/onboarding", {
          method: "POST",
        }),
    },

    billing: {
      /**
       * Create a Stripe Checkout Session for the Pro subscription.
       * Returns a Stripe-hosted checkout URL — redirect the user to it.
       *
       * @param email - Optional email to pre-fill in Stripe checkout
       * @returns { url: string } — redirect to this URL
       */
      createCheckout: (email?: string) =>
        authenticatedFetch<{ url: string }>(getToken, "/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }),

      /**
       * Create a Stripe Customer Portal session.
       * Lets Pro users manage/cancel their subscription.
       *
       * @returns { url: string } — redirect to this URL
       */
      createPortal: () =>
        authenticatedFetch<{ url: string }>(getToken, "/api/billing/portal", {
          method: "POST",
        }),
    },

    versions: {
      /**
       * List all versions for a project with metadata (no file contents).
       * Returns versions sorted newest first for the timeline UI.
       *
       * @param projectId - The project ID to list versions for
       * @returns Object with versions array and currentVersion number
       */
      list: (projectId: string) =>
        authenticatedFetch<{ versions: VersionMeta[]; currentVersion: number }>(
          getToken,
          `/api/projects/${projectId}/versions`,
        ),

      /**
       * Get the full files for a specific version.
       * Used when clicking a version in the timeline to preview it.
       *
       * @param projectId - The project ID
       * @param version - The version number to fetch
       * @returns Object with files array, version number, and metadata
       */
      get: (projectId: string, version: number) =>
        authenticatedFetch<{
          files: ProjectFile[];
          versionNumber: number;
          meta: VersionMeta;
        }>(getToken, `/api/projects/${projectId}/versions/${version}`),

      /**
       * Get the diff between two versions.
       * Returns an array of file changes (added, removed, modified).
       *
       * @param projectId - The project ID
       * @param v1 - The "from" version number
       * @param v2 - The "to" version number
       * @returns Object with from, to, and changes array
       */
      diff: (projectId: string, v1: number, v2: number) =>
        authenticatedFetch<{
          from: number;
          to: number;
          changes: Array<{
            path: string;
            type: "added" | "removed" | "modified";
            oldContent: string | null;
            newContent: string | null;
          }>;
        }>(getToken, `/api/projects/${projectId}/versions/${v1}/diff/${v2}`),

      /**
       * Restore a previous version by creating a new version with its files.
       * Non-destructive — old versions remain intact.
       *
       * @param projectId - The project ID
       * @param version - The version number to restore
       * @returns Object with new version metadata and files
       */
      restore: (projectId: string, version: number) =>
        authenticatedFetch<{ version: VersionMeta; files: ProjectFile[] }>(
          getToken,
          `/api/projects/${projectId}/versions/${version}/restore`,
          { method: "POST" },
        ),

      /**
       * Save a manual edit as a new version.
       * Used by the auto-save feature when code is edited in Monaco.
       *
       * @param projectId - The project ID
       * @param files - The current files to save
       * @returns Object with new version metadata (or null if no changes)
       */
      saveManual: (projectId: string, files: ProjectFile[]) =>
        authenticatedFetch<{
          version: VersionMeta | null;
          message?: string;
        }>(getToken, `/api/projects/${projectId}/versions`, {
          method: "POST",
          body: JSON.stringify({ files }),
        }),
    },

    analytics: {
      /**
       * Get aggregated usage analytics for the authenticated user.
       * Returns project counts, generation stats, model breakdown,
       * credit usage, and recent activity.
       *
       * @returns Full analytics data for the dashboard
       */
      get: () => authenticatedFetch<AnalyticsData>(getToken, "/api/analytics"),
    },
    collaborators: {
      list: (projectId: string) =>
        authenticatedFetch<{ ownerId: string; collaborators: Array<{ userId: string; email: string; role: "editor" | "viewer"; joinedAt: string }> }>(
          getToken,
          `/api/projects/${projectId}/collaborators`,
        ),

      invite: (projectId: string, email: string, role: "editor" | "viewer" = "editor") =>
        authenticatedFetch<{ success: boolean; message: string }>(
          getToken,
          `/api/projects/${projectId}/invite`,
          { method: "POST", body: JSON.stringify({ email, role }) },
        ),

      remove: (projectId: string, collabUserId: string) =>
        authenticatedFetch<{ success: boolean }>(
          getToken,
          `/api/projects/${projectId}/collaborators/${collabUserId}`,
          { method: "DELETE" },
        ),
    },

    orders: {
      cancel: (projectId: string, orderId: string) =>
        authenticatedFetch<{ success: boolean; status: string; emailSent?: boolean; emailReason?: string }>(getToken, "/api/stripe/orders/cancel", {
          method: "POST",
          body: JSON.stringify({ projectId, orderId }),
        }),
      refund: (projectId: string, orderId: string, mode?: "test" | "live") =>
        authenticatedFetch<{ success: boolean; status: string; refundId: string | null }>(getToken, "/api/stripe/orders/refund", {
          method: "POST",
          body: JSON.stringify({ projectId, orderId, mode }),
        }),
      delete: (projectId: string, orderId: string) =>
        authenticatedFetch<{ success: boolean }>(getToken, `/api/stripe/orders/${orderId}?projectId=${projectId}`, {
          method: "DELETE",
        }),
    },

    stripe: {      createAccount: (projectId: string, mode: "test" | "live" = "test") => 
        authenticatedFetch<{ accountId: string; mode: "test" | "live" }>(getToken, "/api/stripe/accounts", {
          method: "POST",
          body: JSON.stringify({ projectId, mode }),
        }),
      createAccountLink: (accountId: string, refreshUrl: string, returnUrl: string, mode: "test" | "live" = "test") => 
        authenticatedFetch<{ url: string }>(getToken, "/api/stripe/account_links", {
          method: "POST",
          body: JSON.stringify({ accountId, refreshUrl, returnUrl, mode }),
        }),
      createCheckoutSession: (params: { accountId: string, amount: number, currency: string, productName: string, successUrl: string, cancelUrl: string }) =>
        authenticatedFetch<{ url: string, sessionId: string }>(getToken, "/api/stripe/checkout_sessions", {
          method: "POST",
          body: JSON.stringify(params),
        }),
    getAccountStatus: (accountId: string, mode: "test" | "live" = "test") =>
      authenticatedFetch<{ id: string, details_submitted: boolean, charges_enabled: boolean, payouts_enabled: boolean, capabilities?: any }>(getToken, `/api/stripe/accounts/${accountId}?mode=${mode}`),
      getBalance: (accountId: string, mode: "test" | "live" = "test") =>
        authenticatedFetch<any>(getToken, `/api/stripe/accounts/${accountId}/balance?mode=${mode}`),
      getPayouts: (accountId: string, mode: "test" | "live" = "test") =>
        authenticatedFetch<any>(getToken, `/api/stripe/accounts/${accountId}/payouts?mode=${mode}`),
      createLoginLink: (accountId: string, mode: "test" | "live" = "test") =>
        authenticatedFetch<{ url: string }>(getToken, `/api/stripe/accounts/${accountId}/login_links`, {
          method: "POST",
          body: JSON.stringify({ mode }),
        }),
    },

    admin: {
      getStats: () =>
        authenticatedFetch<{
          totalUsers: number | null;
          totalProjects: number | null;
          latestUsers: AdminUserSummary[];
        }>(getToken, "/api/admin/stats"),

      getProviderBalances: () =>
        authenticatedFetch<Record<string, ProviderBalance>>(getToken, "/api/admin/provider-balances"),

      listUsers: (params?: { limit?: number; offset?: number; q?: string }) => {
        const qs = new URLSearchParams();
        if (params?.limit) qs.set("limit", String(params.limit));
        if (params?.offset) qs.set("offset", String(params.offset));
        if (params?.q) qs.set("q", params.q);
        return authenticatedFetch<{
          users: (AdminUserSummary & { projectCount: number })[];
          totalCount: number;
          limit: number;
          offset: number;
        }>(getToken, `/api/admin/users${qs.size ? `?${qs}` : ""}`);
      },

      getUser: (userId: string) =>
        authenticatedFetch<{
          user: AdminUserSummary;
          projects: { id: string; name: string; updatedAt: string; type?: string }[];
          credits: Record<string, unknown> | null;
        }>(getToken, `/api/admin/users/${userId}`),

      getUserAnalytics: (userId: string) =>
        authenticatedFetch<AnalyticsData>(getToken, `/api/admin/users/${userId}/analytics`),

      updateUser: (userId: string, data: { firstName?: string; lastName?: string; role?: string; plan?: string }) =>
        authenticatedFetch<{ success: boolean; user: AdminUserSummary }>(
          getToken,
          `/api/admin/users/${userId}`,
          { method: "PATCH", body: JSON.stringify(data) }
        ),

      updateCredits: (userId: string, data: { remaining?: number; total?: number; plan?: string }) =>
        authenticatedFetch<{ success: boolean; credits: Record<string, unknown> }>(
          getToken,
          `/api/admin/users/${userId}/credits`,
          { method: "PATCH", body: JSON.stringify(data) }
        ),

      deleteProject: (userId: string, projectId: string) =>
        authenticatedFetch<{ success: boolean }>(
          getToken,
          `/api/admin/users/${userId}/projects/${projectId}`,
          { method: "DELETE" }
        ),

      getProjectLogs: (projectId: string, opts?: { level?: string; limit?: number }) => {
        const params = new URLSearchParams();
        if (opts?.level) params.set("level", opts.level);
        if (opts?.limit) params.set("limit", String(opts.limit));
        const qs = params.toString() ? `?${params}` : "";
        return authenticatedFetch<{ logs: any[]; total: number; projectId: string }>(
          getToken,
          `/api/admin/projects/${projectId}/logs${qs}`,
        );
      },

      getUserProjects: (userId: string) =>
        authenticatedFetch<{ projects: { id: string; name: string; type?: string; hasTurso: boolean }[] }>(
          getToken,
          `/api/admin/users/${userId}/projects`,
        ),

      getFlyMachines: () =>
        authenticatedFetch<{ machines: any[]; app: string }>(getToken, "/api/admin/fly/machines"),

      getFlyLogs: (opts?: { region?: string; instance?: string }) => {
        const params = new URLSearchParams();
        if (opts?.region) params.set("region", opts.region);
        if (opts?.instance) params.set("instance", opts.instance);
        const qs = params.toString() ? `?${params}` : "";
        return authenticatedFetch<{ logs: any[]; app: string }>(getToken, `/api/admin/fly/logs${qs}`);
      },

      getCreditsReport: () =>
        authenticatedFetch<{
          credits: { userId: string; remaining: number; total: number; plan: string; updatedAt?: string }[];
          summary: { users: number; totalAllocated: number; totalRemaining: number; totalConsumed: number };
        }>(getToken, "/api/admin/credits/report"),
    },

    testing: {
      submitRun: (data: { testNumber?: string; results: any[]; userName: string; userEmail: string }) =>
        authenticatedFetch<{ success: boolean; id: string }>(getToken, "/api/testing/submit", {
          method: "POST",
          body: JSON.stringify(data),
        }),

      submitFeedback: (data: { type: "bug" | "improvement"; content: string; screenshot?: string; userName: string; userEmail: string }) =>
        authenticatedFetch<{ success: boolean; id: string }>(getToken, "/api/testing/feedback", {
          method: "POST",
          body: JSON.stringify(data),
        }),

      getAdminResults: () =>
        authenticatedFetch<{ submissions: any[]; feedback: any[] }>(getToken, "/api/testing/admin/results"),

      updateFeedbackStatus: (id: string, status: string) =>
        authenticatedFetch<{ success: boolean; feedback: any }>(getToken, `/api/testing/admin/feedback/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        }),
    },
  };
}

export interface ProviderBalance {
  available: boolean;
  balance?: string;
  currency?: string;
  extra?: Record<string, unknown>;
  error?: string;
  dashboardUrl: string;
}

export interface AdminUserSummary {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
  role: string;
  plan: string;
  createdAt: string;
  lastSignInAt: string | null;
}
