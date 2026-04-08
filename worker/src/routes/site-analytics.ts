/**
 * worker/src/routes/site-analytics.ts
 *
 * Lightweight, privacy-friendly analytics for published websites.
 * No cookies, no PII — only aggregated pageview counts, referrers, and paths.
 *
 * Public endpoint: POST /api/analytics/collect  (called by the injected script)
 * Protected endpoint: GET /api/analytics/site/:projectId (project owner only)
 */

import { Hono } from "hono";
import type { Env, AppVariables } from "../types";

interface SiteDayData {
  pageviews: number;
  visitors: Set<string> | string[];
  pages: Record<string, number>;
  referrers: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
}

interface SiteDaySerialized {
  pageviews: number;
  uniqueVisitors: number;
  visitors: string[];
  pages: Record<string, number>;
  referrers: Record<string, number>;
  countries: Record<string, number>;
  devices: Record<string, number>;
}

interface SiteSummary {
  totalPageviews: number;
  totalUniqueVisitors: number;
  firstSeen: string;
  lastSeen: string;
}

const siteAnalyticsRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashVisitor(ip: string, ua: string, projectId: string): string {
  const raw = `${ip}:${ua}:${projectId}:${todayKey()}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function parseDevice(ua: string): string {
  if (!ua) return "unknown";
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) return "mobile";
  if (/Tablet|iPad/i.test(ua)) return "tablet";
  return "desktop";
}

function parseReferrer(ref: string): string {
  if (!ref) return "direct";
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "");
    if (host.includes("google")) return "Google";
    if (host.includes("bing")) return "Bing";
    if (host.includes("facebook") || host.includes("fb.com")) return "Facebook";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("twitter") || host.includes("x.com")) return "X/Twitter";
    if (host.includes("linkedin")) return "LinkedIn";
    if (host.includes("tiktok")) return "TikTok";
    return host;
  } catch {
    return "direct";
  }
}

// ---------------------------------------------------------------------------
// POST /api/analytics/collect — Public, called by the injected tracking script
// ---------------------------------------------------------------------------
siteAnalyticsRoutes.post("/collect", async (c) => {
  try {
    let body: { pid: string; p: string; r?: string };
    const ct = c.req.header("content-type") || "";
    if (ct.includes("application/json")) {
      body = await c.req.json();
    } else {
      const text = await c.req.text();
      body = JSON.parse(text);
    }

    const { pid, p, r } = body;
    if (!pid || !p) return c.json({ ok: true });

    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "0.0.0.0";
    const ua = c.req.header("user-agent") || "";
    const country = c.req.header("cf-ipcountry") || "XX";

    const visitorHash = hashVisitor(ip, ua, pid);
    const device = parseDevice(ua);
    const referrer = parseReferrer(r || "");
    const pagePath = p.length > 200 ? p.slice(0, 200) : p;
    const date = todayKey();

    const kvKey = `sa:${pid}:${date}`;
    const kv = c.env.METADATA;

    const existing = await kv.get<SiteDaySerialized>(kvKey, "json");

    const day: SiteDaySerialized = existing || {
      pageviews: 0,
      uniqueVisitors: 0,
      visitors: [],
      pages: {},
      referrers: {},
      countries: {},
      devices: {},
    };

    day.pageviews++;
    day.pages[pagePath] = (day.pages[pagePath] || 0) + 1;
    day.referrers[referrer] = (day.referrers[referrer] || 0) + 1;
    day.countries[country] = (day.countries[country] || 0) + 1;
    day.devices[device] = (day.devices[device] || 0) + 1;

    if (!day.visitors.includes(visitorHash)) {
      if (day.visitors.length < 10000) {
        day.visitors.push(visitorHash);
      }
      day.uniqueVisitors = day.visitors.length;
    }

    await kv.put(kvKey, JSON.stringify(day), { expirationTtl: 90 * 86400 });

    // Update summary
    const summaryKey = `sa:${pid}:summary`;
    const summary = await kv.get<SiteSummary>(summaryKey, "json") || {
      totalPageviews: 0,
      totalUniqueVisitors: 0,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    };
    summary.totalPageviews++;
    summary.lastSeen = new Date().toISOString();
    await kv.put(summaryKey, JSON.stringify(summary));

    return c.json({ ok: true });
  } catch {
    return c.json({ ok: true });
  }
});

// ---------------------------------------------------------------------------
// GET /api/analytics/site/:projectId — Protected, project owner only
// ---------------------------------------------------------------------------
siteAnalyticsRoutes.get("/site/:projectId", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("projectId");
  const kv = c.env.METADATA;

  const project = await kv.get(`project:${projectId}`, "json") as any;
  if (!project) return c.json({ error: "Project not found" }, 404);
  if (project.userId !== userId && !project.collaborators?.some((col: any) => col.userId === userId)) {
    return c.json({ error: "Access denied" }, 403);
  }

  // Fetch last 30 days of data
  const days: Array<{
    date: string;
    pageviews: number;
    uniqueVisitors: number;
    pages: Record<string, number>;
    referrers: Record<string, number>;
    countries: Record<string, number>;
    devices: Record<string, number>;
  }> = [];

  const now = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayData = await kv.get<SiteDaySerialized>(`sa:${projectId}:${dateStr}`, "json");
    days.push({
      date: dateStr,
      pageviews: dayData?.pageviews || 0,
      uniqueVisitors: dayData?.uniqueVisitors || 0,
      pages: dayData?.pages || {},
      referrers: dayData?.referrers || {},
      countries: dayData?.countries || {},
      devices: dayData?.devices || {},
    });
  }

  const summary = await kv.get<SiteSummary>(`sa:${projectId}:summary`, "json");

  // Aggregate totals across the 30-day window
  const totals = {
    pageviews: 0,
    uniqueVisitors: 0,
    topPages: {} as Record<string, number>,
    topReferrers: {} as Record<string, number>,
    countries: {} as Record<string, number>,
    devices: {} as Record<string, number>,
  };
  for (const d of days) {
    totals.pageviews += d.pageviews;
    totals.uniqueVisitors += d.uniqueVisitors;
    for (const [k, v] of Object.entries(d.pages)) totals.topPages[k] = (totals.topPages[k] || 0) + v;
    for (const [k, v] of Object.entries(d.referrers)) totals.topReferrers[k] = (totals.topReferrers[k] || 0) + v;
    for (const [k, v] of Object.entries(d.countries)) totals.countries[k] = (totals.countries[k] || 0) + v;
    for (const [k, v] of Object.entries(d.devices)) totals.devices[k] = (totals.devices[k] || 0) + v;
  }

  return c.json({
    projectId,
    projectName: project.name,
    deploymentUrl: project.fqdn || (project.deployment_uuid ? `https://${project.deployment_uuid}.dock.4esh.nl` : null),
    summary: summary || { totalPageviews: 0, totalUniqueVisitors: 0, firstSeen: null, lastSeen: null },
    last30Days: totals,
    daily: days.reverse(),
  });
});

export { siteAnalyticsRoutes };
