export interface Collaborator {
  userId: string;
  email: string;
  role: "editor" | "viewer";
  joinedAt: string;
}

export interface ProjectInvite {
  projectId: string;
  invitedEmail: string;
  invitedByUserId: string;
  role: "editor" | "viewer";
  expiresAt: string;
}

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
  collaborators?: Collaborator[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectFile {
  path: string;
  content: string;
}

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
