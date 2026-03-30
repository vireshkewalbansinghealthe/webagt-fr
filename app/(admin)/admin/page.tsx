"use client";

export const dynamic = "force-dynamic";

/**
 * app/(admin)/admin/page.tsx
 *
 * Admin overview dashboard — platform-wide stats and recent signups.
 */

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { createApiClient, type AdminUserSummary, type ProviderBalance } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, FolderOpen, RefreshCw, ArrowRight, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface StatsData {
  totalUsers: number | null;
  totalProjects: number | null;
  latestUsers: AdminUserSummary[];
}

const PROVIDER_META: Record<string, { name: string; logo: string }> = {
  anthropic: { name: "Anthropic", logo: "https://www.anthropic.com/favicon.ico" },
  openai: { name: "OpenAI", logo: "https://openai.com/favicon.ico" },
  deepseek: { name: "DeepSeek", logo: "https://www.deepseek.com/favicon.ico" },
  google: { name: "Google AI", logo: "https://www.gstatic.com/devrel-devsite/prod/v0e0f589edd85502a40d78d7d0825db8ea5ef3b99ab4070381ee86977c9168730/cloud/images/favicons/onecloud/favicon.ico" },
};

export default function AdminOverviewPage() {
  const { getToken } = useAuth();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [balances, setBalances] = useState<Record<string, ProviderBalance> | null>(null);
  const [balancesLoading, setBalancesLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getStats();
      setStats(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  const fetchBalances = useCallback(async () => {
    setBalancesLoading(true);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getProviderBalances();
      setBalances(data);
    } catch {
      // non-fatal
    } finally {
      setBalancesLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchStats();
    fetchBalances();
  }, [fetchStats, fetchBalances]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform-wide stats and recent activity.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard
          icon={<Users className="size-5 text-blue-500" />}
          label="Total Users"
          value={loading ? null : stats?.totalUsers ?? "—"}
          bg="bg-blue-500/10"
        />
        <StatCard
          icon={<FolderOpen className="size-5 text-violet-500" />}
          label="Total Projects"
          value={loading ? null : stats?.totalProjects ?? "—"}
          bg="bg-violet-500/10"
        />
      </div>

      {/* Provider Balances */}
      <div className="rounded-xl border border-border bg-card mb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">LLM Provider Status</h2>
          <Button variant="ghost" size="sm" className="text-xs" onClick={fetchBalances} disabled={balancesLoading}>
            <RefreshCw className={`size-3.5 ${balancesLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
          {(["anthropic", "openai", "deepseek", "google"] as const).map((key) => {
            const meta = PROVIDER_META[key];
            const b = balances?.[key];
            return (
              <div key={key} className="px-4 py-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <img src={meta.logo} alt="" className="size-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-xs font-medium text-muted-foreground">{meta.name}</span>
                </div>
                {balancesLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : b ? (
                  <>
                    <div className="flex items-center gap-1.5">
                      {b.available ? (
                        <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="size-3.5 text-destructive shrink-0" />
                      )}
                      <span className={`text-sm font-semibold ${b.available ? "text-foreground" : "text-destructive"}`}>
                        {b.balance ?? (b.available ? "Active" : "Error")}
                      </span>
                    </div>
                    {b.extra?.period && (
                      <p className="text-[11px] text-muted-foreground">{String(b.extra.period)}</p>
                    )}
                    {b.extra?.note && (
                      <p className="text-[10px] text-amber-500/80 leading-tight">{String(b.extra.note)}</p>
                    )}
                    {b.extra?.byModel && (
                      <div className="mt-1 space-y-0.5">
                        {Object.entries(b.extra.byModel as Record<string, { cost: number; input: number; output: number }>)
                          .sort((a, b) => b[1].cost - a[1].cost)
                          .slice(0, 3)
                          .map(([model, stats]) => (
                            <p key={model} className="text-[10px] text-muted-foreground truncate">
                              {model.replace("claude-", "")}: ${stats.cost.toFixed(4)}
                            </p>
                          ))}
                      </div>
                    )}
                    {b.error && <p className="text-[11px] text-destructive leading-tight">{b.error}</p>}
                    <a
                      href={b.dashboardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-1"
                    >
                      Open console <ExternalLink className="size-2.5" />
                    </a>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent signups */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Recent Signups</h2>
          <Link
            href="/admin/users"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all
            <ArrowRight className="size-3" />
          </Link>
        </div>

        {error && (
          <p className="px-5 py-6 text-sm text-destructive">{error}</p>
        )}

        {loading && (
          <ul className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3 px-5 py-3">
                <Skeleton className="size-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-5 w-10 rounded-full" />
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && stats?.latestUsers.length === 0 && (
          <p className="px-5 py-6 text-sm text-muted-foreground">No users yet.</p>
        )}

        {!loading && !error && (stats?.latestUsers ?? []).length > 0 && (
          <ul className="divide-y divide-border">
            {(stats?.latestUsers ?? []).map((u) => (
              <li key={u.id}>
                <Link
                  href={`/admin/users?highlight=${u.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarImage src={u.imageUrl} />
                    <AvatarFallback className="text-xs">
                      {u.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <PlanBadge plan={u.plan} />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string | null;
  bg: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 flex items-center gap-4">
      <div className={`size-10 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-7 w-16" />
        ) : (
          <p className="text-2xl font-bold mt-0.5">{value.toLocaleString()}</p>
        )}
      </div>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "pro") {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 hover:bg-amber-500/15 text-[10px] px-1.5 py-0">
        Pro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
      Free
    </Badge>
  );
}
