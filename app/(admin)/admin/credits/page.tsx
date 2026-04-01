"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Coins,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Users,
  Search,
  ArrowUpDown,
  Crown,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface CreditEntry {
  userId: string;
  remaining: number;
  total: number;
  plan: string;
  updatedAt?: string;
}

interface Summary {
  users: number;
  totalAllocated: number;
  totalRemaining: number;
  totalConsumed: number;
}

type SortKey = "consumed" | "remaining" | "pct" | "total" | "plan";

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number | null;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-5 flex items-start gap-4">
      <div className={cn("size-10 rounded-lg flex items-center justify-center shrink-0", accent ?? "bg-muted")}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
        {value === null ? (
          <Skeleton className="mt-1 h-7 w-20" />
        ) : (
          <p className="text-2xl font-bold mt-0.5">{value}</p>
        )}
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function UsageBar({ pct }: { pct: number }) {
  const color =
    pct >= 90 ? "bg-rose-500" :
    pct >= 70 ? "bg-amber-500" :
    pct >= 40 ? "bg-sky-500" :
    "bg-emerald-500";

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground w-9 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function CreditsReportPage() {
  const { getToken } = useAuth();
  const [credits, setCredits] = useState<CreditEntry[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("consumed");
  const [sortAsc, setSortAsc] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getCreditsReport();
      setCredits(data.credits);
      setSummary(data.summary);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load credits");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { fetch(); }, [fetch]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setSortAsc(p => !p);
    else { setSort(key); setSortAsc(false); }
  };

  const processed = credits
    .map(c => ({
      ...c,
      consumed: c.total - c.remaining,
      pct: c.total > 0 ? ((c.total - c.remaining) / c.total) * 100 : 0,
    }))
    .filter(c =>
      !search || c.userId.toLowerCase().includes(search.toLowerCase()) ||
      c.plan.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sort as keyof typeof a] as number | string;
      const bVal = b[sort as keyof typeof b] as number | string;
      const cmp = typeof aVal === "number" && typeof bVal === "number"
        ? aVal - bVal
        : String(aVal).localeCompare(String(bVal));
      return sortAsc ? cmp : -cmp;
    });

  const Th = ({ label, sortKey }: { label: string; sortKey: SortKey }) => (
    <th
      className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => toggleSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("size-3", sort === sortKey ? "text-primary" : "opacity-30")} />
      </span>
    </th>
  );

  const pctAllocUsed = summary
    ? ((summary.totalConsumed / (summary.totalAllocated || 1)) * 100).toFixed(1)
    : null;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Coins className="size-6 text-primary" />
            Credit Consumption
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Overzicht van kredietverbruik per gebruiker
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
          Vernieuwen
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="size-5 text-violet-500" />}
          label="Gebruikers"
          value={loading ? null : summary?.users ?? 0}
          accent="bg-violet-500/10"
        />
        <StatCard
          icon={<Coins className="size-5 text-amber-500" />}
          label="Totaal Uitgegeven"
          value={loading ? null : fmt(summary?.totalAllocated ?? 0)}
          accent="bg-amber-500/10"
        />
        <StatCard
          icon={<TrendingDown className="size-5 text-rose-500" />}
          label="Verbruikt"
          value={loading ? null : fmt(summary?.totalConsumed ?? 0)}
          sub={pctAllocUsed ? `${pctAllocUsed}% van totaal` : undefined}
          accent="bg-rose-500/10"
        />
        <StatCard
          icon={<TrendingUp className="size-5 text-emerald-500" />}
          label="Resterend"
          value={loading ? null : fmt(summary?.totalRemaining ?? 0)}
          accent="bg-emerald-500/10"
        />
      </div>

      {/* Platform-wide bar */}
      {summary && summary.totalAllocated > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Platform verbruik</p>
            <span className="text-xs text-muted-foreground">
              {fmt(summary.totalConsumed)} / {fmt(summary.totalAllocated)} credits
            </span>
          </div>
          <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-rose-500 rounded-full transition-all"
              style={{ width: `${Math.min((summary.totalConsumed / summary.totalAllocated) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[11px] text-muted-foreground">
            <span>Verbruikt: {((summary.totalConsumed / summary.totalAllocated) * 100).toFixed(1)}%</span>
            <span>Resterend: {((summary.totalRemaining / summary.totalAllocated) * 100).toFixed(1)}%</span>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Gebruikers ({processed.length})</h2>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Zoek gebruiker..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-5 py-3 flex gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : processed.length === 0 ? (
          <div className="px-5 py-12 text-center text-muted-foreground text-sm">
            Geen resultaten
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    User ID
                  </th>
                  <Th label="Plan" sortKey="plan" />
                  <Th label="Verbruikt" sortKey="consumed" />
                  <Th label="Resterend" sortKey="remaining" />
                  <Th label="Totaal" sortKey="total" />
                  <Th label="%" sortKey="pct" />
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Bijgewerkt
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {processed.map((c) => (
                  <tr key={c.userId} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {c.userId}
                    </td>
                    <td className="px-4 py-3">
                      {c.plan === "pro" ? (
                        <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 hover:bg-amber-500/15 text-[10px] px-1.5 py-0 gap-0.5">
                          <Crown className="size-2.5" /> Pro
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          Free
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium tabular-nums">
                      {fmt(c.consumed)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {fmt(c.remaining)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {fmt(c.total)}
                    </td>
                    <td className="px-4 py-3 w-48">
                      <UsageBar pct={c.pct} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {c.updatedAt
                        ? formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
