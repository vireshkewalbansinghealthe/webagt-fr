/**
 * types/project.ts
 *
 * TypeScript interfaces for projects, files, and versions.
 * These types are shared between the frontend and define the shape
 * of data stored in Cloudflare KV (metadata) and R2 (file contents).
 *
 * Used by: dashboard components, editor components, API client, worker routes
 */

/**
 * A user's project — the top-level entity that contains all versions and files.
 * Stored in KV as `project:{id}` with this shape.
 *
 * @property id - Unique identifier (nanoid or UUID)
 * @property userId - Clerk user ID that owns this project
 * @property name - Display name chosen by the user
 * @property model - AI model ID used for generation (e.g., "claude-sonnet-4-5-20250929")
 * @property currentVersion - Latest version number (starts at 0)
 * @property createdAt - ISO 8601 timestamp of project creation
 * @property updatedAt - ISO 8601 timestamp of last modification
 */
/** A collaborator on a project — invited by the owner and added after acceptance. */
export interface Collaborator {
  userId: string;
  email: string;
  role: "editor" | "viewer";
  joinedAt: string;
}

export interface Project {
  id: string;
  userId: string;
  name: string;
  model: string;
  type?: "website" | "webshop"; // Optional for backwards compatibility
  templateId?: string; // Selected starter template ID for remix projects
  databaseUrl?: string; // Turso DB URL
  databaseToken?: string; // Turso Auth Token
  stripeAccountId?: string; // Stripe Connect Account ID
  stripeTestAccountId?: string; // Stripe test-mode connected account
  stripeLiveAccountId?: string; // Stripe live-mode connected account
  stripePaymentMethods?: string[]; // Array of enabled payment method types
  paymentMode?: "off" | "test" | "live"; // Payment availability on published shops
  deployment_uuid?: string; // Coolify App UUID
  customDomain?: string; // Custom domain (without protocol), e.g. "shop.mybrand.com"
  customDomainVerified?: boolean; // Whether DNS has been verified
  deployToken?: string; // Token for public file access during deployment
  ownerNotificationEmail?: string; // Shop owner email for new order alerts
  ownerNotificationEmails?: string[]; // Multiple owner emails for order alerts
  orderCustomerEmailsEnabled?: boolean; // Whether customer confirmations are enabled
  emailSenderMode?: "platform" | "owner_verified"; // Active sender strategy
  emailDomain?: string; // Requested custom sender domain (e.g. shop.com)
  emailDomainId?: string; // Resend domain ID
  emailDomainStatus?: "unverified" | "pending" | "verified" | "failed";
  emailLastVerificationAt?: string;
  emailLastError?: string;
  collaborators?: Collaborator[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A single file within a project version.
 * Files are stored as a flat list — the path includes the directory
 * structure (e.g., "src/components/Button.tsx").
 *
 * @property path - Relative file path within the project (e.g., "src/App.tsx")
 * @property content - Full text content of the file
 */
export interface ProjectFile {
  path: string;
  content: string;
}

/**
 * A snapshot of the project at a specific point in time.
 * Each AI generation, manual edit, or restore creates a new version.
 * Stored in R2 as `{projectId}/v{versionNumber}/files.json`.
 *
 * @property versionNumber - Sequential version number (0, 1, 2, ...)
 * @property prompt - The user prompt that triggered this version (empty for manual edits)
 * @property model - The AI model used for this generation
 * @property files - Complete list of all project files at this version
 * @property changedFiles - Paths of files that changed from the previous version
 * @property type - How this version was created
 * @property createdAt - ISO 8601 timestamp of version creation
 */
export interface Version {
  versionNumber: number;
  prompt: string;
  model: string;
  files: ProjectFile[];
  changedFiles: string[];
  type: "ai" | "manual" | "restore";
  createdAt: string;
  fileCount: number;
  restoredFrom?: number;
}

/**
 * Lightweight version metadata for the version timeline.
 * Same as Version but without the full files array — used by
 * the list versions endpoint to avoid sending all file contents.
 *
 * @property versionNumber - Sequential version number (0, 1, 2, ...)
 * @property type - How this version was created
 * @property prompt - The user prompt or description for this version
 * @property model - The AI model used (empty for manual edits and restores)
 * @property createdAt - ISO 8601 timestamp
 * @property fileCount - Number of files in this version
 * @property changedFiles - Paths of files that changed from previous version
 * @property restoredFrom - Version number this was restored from (only for "restore" type)
 */
export interface VersionMeta {
  versionNumber: number;
  type: "ai" | "manual" | "restore";
  prompt: string;
  model: string;
  createdAt: string;
  fileCount: number;
  changedFiles: string[];
  restoredFrom?: number;
}
