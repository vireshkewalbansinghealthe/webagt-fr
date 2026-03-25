import type { Env } from "../types";

export interface EmailDnsRecord {
  record: string;
  name: string;
  value: string;
  ttl: string;
  status: string;
}

export interface ResendDomainResult {
  domainId: string;
  status: "unverified" | "pending" | "verified" | "failed";
  records: EmailDnsRecord[];
}

interface ResendDomainResponse {
  id?: string;
  status?: string;
  records?: Array<{
    record?: string;
    name?: string;
    value?: string;
    ttl?: string | number;
    status?: string;
  }>;
}

function assertResendConfigured(env: Env): string {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured.");
  }
  return env.RESEND_API_KEY;
}

function mapResendStatus(
  status: string | undefined,
): "unverified" | "pending" | "verified" | "failed" {
  const normalized = (status || "").toLowerCase();
  if (normalized === "verified") return "verified";
  if (
    normalized === "failed" ||
    normalized === "temporary_failure" ||
    normalized === "permanent_failure"
  ) {
    return "failed";
  }
  if (normalized === "not_started") return "unverified";
  return "pending";
}

function toDnsRecords(input: ResendDomainResponse["records"]): EmailDnsRecord[] {
  if (!Array.isArray(input)) return [];
  return input.map((record) => ({
    record: record.record || "TXT",
    name: record.name || "@",
    value: record.value || "",
    ttl: String(record.ttl ?? "Auto"),
    status: record.status || "pending",
  }));
}

async function resendRequest<T>(
  env: Env,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = assertResendConfigured(env);
  const response = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Resend API error (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

async function getDomainByName(
  env: Env,
  domain: string,
): Promise<{ id: string } | null> {
  const result = await resendRequest<{ data?: Array<{ id?: string; name?: string }> }>(
    env,
    "/domains",
  );
  const found = (result.data || []).find(
    (item) => item.name?.toLowerCase() === domain.toLowerCase(),
  );
  if (!found?.id) return null;
  return { id: found.id };
}

export async function getResendDomainDetails(
  env: Env,
  domainId: string,
): Promise<ResendDomainResult> {
  const details = await resendRequest<{ data?: ResendDomainResponse }>(
    env,
    `/domains/${domainId}`,
  );
  const domain = details.data || {};
  if (!domain.id) {
    throw new Error("Resend domain response did not include an id.");
  }

  return {
    domainId: domain.id,
    status: mapResendStatus(domain.status),
    records: toDnsRecords(domain.records),
  };
}

export async function upsertResendDomain(
  env: Env,
  domain: string,
  existingDomainId?: string,
): Promise<ResendDomainResult> {
  if (existingDomainId) {
    return getResendDomainDetails(env, existingDomainId);
  }

  const existing = await getDomainByName(env, domain);
  const domainId =
    existing?.id ||
    (
      await resendRequest<{ data?: { id?: string } }>(env, "/domains", {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      })
    ).data?.id;

  if (!domainId) {
    throw new Error("Could not create or find Resend domain.");
  }

  return getResendDomainDetails(env, domainId);
}

export async function verifyResendDomain(
  env: Env,
  domainId: string,
): Promise<ResendDomainResult> {
  await resendRequest(env, `/domains/${domainId}/verify`, { method: "POST" });
  return getResendDomainDetails(env, domainId);
}
