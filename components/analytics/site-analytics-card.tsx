"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Globe,
  Eye,
  Users,
  ArrowUpRight,
  ExternalLink,
  Monitor,
  Smartphone,
  Tablet,
  MapPin,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createApiClient } from "@/lib/api-client";
import type { SiteAnalyticsResponse } from "@/types/analytics";

interface PublishedProject {
  projectId: string;
  projectName: string;
}

export function SiteAnalyticsCard({ publishedProjects }: { publishedProjects: PublishedProject[] }) {
  const { getToken } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>(publishedProjects[0]?.projectId || "");
  const [data, setData] = useState<SiteAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSiteAnalytics = useCallback(async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    try {
      const client = createApiClient(getToken);
      const result = await client.analytics.getSiteAnalytics(pid);
      setData(result);
    } catch (err) {
      console.error("Failed to fetch site analytics:", err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (selectedProjectId) fetchSiteAnalytics(selectedProjectId);
  }, [selectedProjectId, fetchSiteAnalytics]);

  if (publishedProjects.length === 0) return null;

  const topPages = data
    ? Object.entries(data.last30Days.topPages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];
  const topReferrers = data
    ? Object.entries(data.last30Days.topReferrers)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];
  const devices = data?.last30Days.devices || {};
  const countries = data
    ? Object.entries(data.last30Days.countries)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    : [];

  const maxPageviews = data ? Math.max(...data.daily.map((d) => d.pageviews), 1) : 1;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-blue-500" />
            Website Analytics
          </CardTitle>
          {publishedProjects.length > 1 && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs border rounded-md px-2 py-1 bg-background"
            >
              {publishedProjects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </option>
              ))}
            </select>
          )}
          {publishedProjects.length === 1 && (
            <span className="text-xs text-muted-foreground">{publishedProjects[0].projectName}</span>
          )}
        </div>
        {data?.deploymentUrl && (
          <a
            href={data.deploymentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline flex items-center gap-1 mt-1"
          >
            {data.deploymentUrl.replace("https://", "")}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            Loading analytics...
          </div>
        )}

        {!loading && !data && (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground">
            <BarChart3 className="h-8 w-8 mb-2 opacity-40" />
            <p>No analytics data yet</p>
            <p className="text-xs mt-1">Data appears after your site receives visitors</p>
          </div>
        )}

        {!loading && data && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Eye className="h-3.5 w-3.5" />
                  Pageviews (30d)
                </div>
                <p className="text-2xl font-bold">{data.last30Days.pageviews.toLocaleString()}</p>
              </div>
              <div className="rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Users className="h-3.5 w-3.5" />
                  Visitors (30d)
                </div>
                <p className="text-2xl font-bold">{data.last30Days.uniqueVisitors.toLocaleString()}</p>
              </div>
            </div>

            {/* Daily chart */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Daily pageviews</h4>
              <div className="flex items-end gap-[2px] h-16">
                {data.daily.map((d) => (
                  <div
                    key={d.date}
                    className="flex-1 bg-blue-500/80 hover:bg-blue-500 rounded-t-sm transition-colors cursor-default"
                    style={{ height: `${Math.max((d.pageviews / maxPageviews) * 100, 2)}%` }}
                    title={`${d.date}: ${d.pageviews} pageviews`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">{data.daily[0]?.date}</span>
                <span className="text-[10px] text-muted-foreground">{data.daily[data.daily.length - 1]?.date}</span>
              </div>
            </div>

            {/* Top pages */}
            {topPages.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Top pages</h4>
                <div className="space-y-1.5">
                  {topPages.map(([path, count]) => (
                    <div key={path} className="flex items-center justify-between text-xs">
                      <span className="truncate text-foreground font-mono">{path}</span>
                      <span className="text-muted-foreground ml-2 flex-shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Referrers */}
            {topReferrers.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">Traffic sources</h4>
                <div className="space-y-1.5">
                  {topReferrers.map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{source}</span>
                      <span className="text-muted-foreground ml-2 flex-shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Devices + Countries side by side */}
            <div className="grid grid-cols-2 gap-4">
              {Object.keys(devices).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Devices</h4>
                  <div className="space-y-1.5">
                    {Object.entries(devices)
                      .sort((a, b) => b[1] - a[1])
                      .map(([device, count]) => (
                        <div key={device} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 capitalize text-foreground">
                            {device === "desktop" && <Monitor className="h-3 w-3" />}
                            {device === "mobile" && <Smartphone className="h-3 w-3" />}
                            {device === "tablet" && <Tablet className="h-3 w-3" />}
                            {device}
                          </span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              {countries.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Countries</h4>
                  <div className="space-y-1.5">
                    {countries.map(([code, count]) => (
                      <div key={code} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 text-foreground">
                          <MapPin className="h-3 w-3" />
                          {code}
                        </span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {data.summary.firstSeen && (
              <p className="text-[10px] text-muted-foreground pt-1">
                Tracking since {new Date(data.summary.firstSeen).toLocaleDateString()}
                {data.summary.totalPageviews > 0 && ` · ${data.summary.totalPageviews.toLocaleString()} total pageviews`}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
