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
    throw new Error("Not authenticated — no session token available");
  }

  const response = await fetch(`${WORKER_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  }).catch(err => {
    console.error(`Fetch failed for ${path}:`, err);
    throw err;
  });

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
    stripe: {
      createAccount: (projectId: string, mode: "test" | "live" = "test") => 
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
  };
}
