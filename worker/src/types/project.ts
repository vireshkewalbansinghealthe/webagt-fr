/**
 * worker/src/types/project.ts
 *
 * TypeScript interfaces for projects, files, and versions.
 * These mirror the types in the frontend's types/project.ts.
 * Kept in sync manually — both files define the same shapes
 * for data stored in Cloudflare KV and R2.
 *
 * Used by: worker route handlers and AI default project template
 */

/**
 * A user's project — the top-level entity.
 * Stored in KV as `project:{id}`.
 */
export interface Project {
  id: string;
  userId: string;
  name: string;
  model: string;
  type?: "website" | "webshop";
  templateId?: string;
  databaseUrl?: string;
  databaseToken?: string;
  stripeAccountId?: string;
  stripeTestAccountId?: string;
  stripeLiveAccountId?: string;
  stripePaymentMethods?: string[];
  paymentMode?: "off" | "test" | "live";
  deployment_uuid?: string;
  deployToken?: string;
  ownerNotificationEmail?: string;
  ownerNotificationEmails?: string[];
  orderCustomerEmailsEnabled?: boolean;
  emailSenderMode?: "platform" | "owner_verified";
  emailDomain?: string;
  emailDomainId?: string;
  emailDomainStatus?: "unverified" | "pending" | "verified" | "failed";
  emailLastVerificationAt?: string;
  emailLastError?: string;
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A single file within a project version.
 */
export interface ProjectFile {
  path: string;
  content: string;
}

/**
 * A snapshot of the project at a specific point in time.
 * Stored in R2 as `{projectId}/v{versionNumber}/files.json`.
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
 * Same as Version but without the full files array.
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
