"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createApiClient, type AdminUserSummary } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Coins,
  FolderOpen,
  Save,
  CheckCircle2,
  AlertCircle,
  Crown,
  Clock,
  DollarSign,
  Hash,
  MessageSquare,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

interface UserCredits {
  remaining: number;
  total: number;
  plan: string;
  apiSpendUsd?: number;
  updatedAt?: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  updatedAt: string;
  type?: string;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  model?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
    userPaysUsd?: number;
    creditsUsed?: number;
  };
}

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { getToken } = useAuth();

  const [user, setUser] = useState<AdminUserSummary | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [credits, setCredits] = useState<UserCredits | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit credits
  const [editRemaining, setEditRemaining] = useState<number>(0);
  const [editTotal, setEditTotal] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Chat history per project
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // All messages across projects (for chart)
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  const [allMessagesLoading, setAllMessagesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getUser(userId);
      setUser(data.user);
      setProjects(data.projects);
      const creds = data.credits as UserCredits | null;
      setCredits(creds);
      if (creds) {
        setEditRemaining(creds.remaining);
        setEditTotal(creds.total);
      }

      // Load all chat histories for the chart
      if (data.projects.length > 0) {
        setAllMessagesLoading(true);
        const results = await Promise.allSettled(
          data.projects.map((p) => client.admin.getProjectChat(p.id))
        );
        const msgs: ChatMessage[] = [];
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.messages) {
            msgs.push(...r.value.messages);
          }
        }
        setAllMessages(msgs);
        setAllMessagesLoading(false);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [getToken, userId]);

  useEffect(() => { load(); }, [load]);

  const handleSaveCredits = async () => {
    setSaving(true);
    setError(null);
    try {
      const client = createApiClient(getToken);
      await client.admin.updateCredits(userId, {
        remaining: editRemaining,
        total: editTotal,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to save credits");
    } finally {
      setSaving(false);
    }
  };

  const loadChat = async (projectId: string) => {
    setSelectedProject(projectId);
    setChatLoading(true);
    setChatMessages([]);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getProjectChat(projectId);
      setChatMessages(data.messages ?? []);
    } catch {
      // silently fail
    } finally {
      setChatLoading(false);
    }
  };

  const assistantMessages = chatMessages.filter(m => m.role === "assistant" && m.tokenUsage);
  const totalCreditsUsed = assistantMessages.reduce((s, m) => s + (m.tokenUsage?.creditsUsed ?? 0), 0);
  const totalApiSpend = assistantMessages.reduce((s, m) => s + (m.tokenUsage?.costUsd ?? 0), 0);

  // Chart data: aggregate credits & API spend per day across all projects
  const chartData = useMemo(() => {
    const byDay = new Map<string, { credits: number; apiCost: number; count: number }>();
    for (const m of allMessages) {
      if (m.role !== "assistant" || !m.tokenUsage) continue;
      const day = m.timestamp ? format(new Date(m.timestamp), "MMM d") : "Unknown";
      const existing = byDay.get(day) || { credits: 0, apiCost: 0, count: 0 };
      existing.credits += m.tokenUsage.creditsUsed ?? 0;
      existing.apiCost += m.tokenUsage.costUsd ?? 0;
      existing.count += 1;
      byDay.set(day, existing);
    }
    return Array.from(byDay.entries()).map(([day, data]) => ({ day, ...data }));
  }, [allMessages]);

  return (
    <div className="p-8 max-w-4xl">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 gap-1.5 text-muted-foreground -ml-2"
        onClick={() => router.back()}
      >
        <ArrowLeft className="size-3.5" />
        Back
      </Button>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error && !user ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="size-4" />
          {error}
        </div>
      ) : user ? (
        <div className="space-y-8">
          {/* User header */}
          <div className="flex items-start gap-4">
            {user.imageUrl ? (
              <img src={user.imageUrl} alt="" className="size-14 rounded-xl border border-border" />
            ) : (
              <div className="size-14 rounded-xl bg-muted flex items-center justify-center">
                <User className="size-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold">{user.name || "Unnamed"}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Mail className="size-3.5" />
                  {user.email}
                </span>
                <Badge className="bg-amber-500/15 text-amber-600 text-[10px] gap-0.5">
                  <Crown className="size-2.5" /> {user.role === "admin" ? "Admin" : "Pro"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3" />
                  Joined {new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                {user.lastSignInAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    Last seen {formatDistanceToNow(new Date(user.lastSignInAt), { addSuffix: true })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Credits section */}
          <section>
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <Coins className="size-4 text-primary" />
              Credits
            </h2>

            {credits ? (
              <div className="rounded-xl border border-border bg-card p-6 space-y-5">
                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="text-2xl font-bold tabular-nums">{credits.remaining.toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Total Allocated</p>
                    <p className="text-2xl font-bold tabular-nums">{credits.total.toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Used</p>
                    <p className="text-2xl font-bold tabular-nums">{(credits.total - credits.remaining).toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">API Spend</p>
                    <p className={cn("text-2xl font-bold tabular-nums font-mono", (credits.apiSpendUsd ?? 0) > 0 ? "text-rose-400" : "")}>
                      ${(credits.apiSpendUsd ?? 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Edit credits */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground mb-3">Adjust credits</p>
                  <div className="flex items-end gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Remaining</Label>
                      <Input
                        type="number"
                        value={editRemaining}
                        onChange={(e) => setEditRemaining(parseInt(e.target.value) || 0)}
                        className="w-32"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Total</Label>
                      <Input
                        type="number"
                        value={editTotal}
                        onChange={(e) => setEditTotal(parseInt(e.target.value) || 0)}
                        className="w-32"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={handleSaveCredits}
                      disabled={saving}
                      className="gap-1.5"
                    >
                      {saved ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Save className="size-3.5" />}
                      {saved ? "Saved!" : saving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>

                {credits.updatedAt && (
                  <p className="text-[10px] text-muted-foreground">
                    Last updated {formatDistanceToNow(new Date(credits.updatedAt), { addSuffix: true })}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No credit data found for this user.</p>
            )}
          </section>

          <Separator />

          {/* Usage Chart */}
          <section>
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Usage History
            </h2>

            {allMessagesLoading ? (
              <Skeleton className="h-48 w-full rounded-xl" />
            ) : chartData.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-6 text-center">
                <TrendingUp className="size-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No usage data yet.</p>
              </div>
            ) : (
              <UsageChart data={chartData} />
            )}
          </section>

          <Separator />

          {/* Projects */}
          <section>
            <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
              <FolderOpen className="size-4 text-primary" />
              Projects ({projects.length})
            </h2>

            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => loadChat(p.id)}
                    className={cn(
                      "w-full rounded-lg border px-4 py-3 text-left transition-all flex items-center justify-between",
                      selectedProject === p.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <span className="font-mono">{p.id.slice(0, 8)}</span>
                        {p.type && (
                          <Badge variant="outline" className="text-[9px] py-0">{p.type}</Badge>
                        )}
                        {p.updatedAt && (
                          <span>{formatDistanceToNow(new Date(p.updatedAt), { addSuffix: true })}</span>
                        )}
                      </div>
                    </div>
                    <MessageSquare className="size-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Chat history for selected project */}
          {selectedProject && (
            <>
              <Separator />
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <MessageSquare className="size-4 text-primary" />
                    Generation History
                  </h2>
                  {assistantMessages.length > 0 && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="size-3" />
                        {assistantMessages.length} generations
                      </span>
                      <span className="flex items-center gap-1">
                        <Coins className="size-3" />
                        {totalCreditsUsed} credits
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <DollarSign className="size-3" />
                        ${totalApiSpend.toFixed(4)} API
                      </span>
                    </div>
                  )}
                </div>

                {chatLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
                  </div>
                ) : assistantMessages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No generations found for this project.</p>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">#</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Model</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Input</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Output</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Credits</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">API Cost</th>
                          <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assistantMessages.map((m, i) => (
                          <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className="text-[10px] py-0 font-mono">
                                {m.model || "—"}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 tabular-nums font-mono text-xs">
                              {(m.tokenUsage?.inputTokens ?? 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums font-mono text-xs">
                              {(m.tokenUsage?.outputTokens ?? 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums font-medium">
                              {m.tokenUsage?.creditsUsed ?? "—"}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums font-mono text-xs text-rose-400">
                              ${(m.tokenUsage?.costUsd ?? 0).toFixed(4)}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                              {m.timestamp
                                ? formatDistanceToNow(new Date(m.timestamp), { addSuffix: true })
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="size-4" />
              {error}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Bar Chart
// ---------------------------------------------------------------------------
interface ChartDatum { day: string; credits: number; apiCost: number; count: number }

function UsageChart({ data }: { data: ChartDatum[] }) {
  const maxCredits = Math.max(...data.map(d => d.credits), 1);
  const totalCredits = data.reduce((s, d) => s + d.credits, 0);
  const totalCost = data.reduce((s, d) => s + d.apiCost, 0);
  const totalGens = data.reduce((s, d) => s + d.count, 0);

  const chartH = 160;
  const barGap = 4;
  const barWidth = Math.min(40, Math.max(16, (600 - barGap * data.length) / data.length));

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Coins className="size-3" />
          <span className="font-semibold text-foreground">{totalCredits}</span> credits total
        </span>
        <span className="flex items-center gap-1.5">
          <DollarSign className="size-3" />
          <span className="font-semibold text-foreground font-mono">${totalCost.toFixed(2)}</span> API cost
        </span>
        <span className="flex items-center gap-1.5">
          <Hash className="size-3" />
          <span className="font-semibold text-foreground">{totalGens}</span> generations
        </span>
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <div className="min-w-fit">
          <svg
            width={Math.max(data.length * (barWidth + barGap) + 40, 200)}
            height={chartH + 40}
            className="w-full"
          >
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <g key={pct}>
                <line
                  x1={30}
                  x2={data.length * (barWidth + barGap) + 30}
                  y1={chartH - pct * chartH + 10}
                  y2={chartH - pct * chartH + 10}
                  stroke="currentColor"
                  strokeOpacity={0.07}
                  strokeDasharray={pct === 0 ? "" : "4,4"}
                />
                <text
                  x={26}
                  y={chartH - pct * chartH + 14}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.3}
                  fontSize={9}
                  fontFamily="monospace"
                >
                  {Math.round(maxCredits * pct)}
                </text>
              </g>
            ))}

            {/* Bars */}
            {data.map((d, i) => {
              const h = (d.credits / maxCredits) * chartH;
              const x = i * (barWidth + barGap) + 34;
              return (
                <g key={d.day}>
                  <rect
                    x={x}
                    y={chartH - h + 10}
                    width={barWidth}
                    height={h}
                    rx={3}
                    fill="hsl(var(--primary))"
                    fillOpacity={0.7}
                    className="transition-all duration-300 hover:fill-opacity-100"
                  />
                  {/* Hover tooltip area */}
                  <title>{`${d.day}: ${d.credits} credits, ${d.count} gens, $${d.apiCost.toFixed(4)}`}</title>
                  {/* Day label */}
                  <text
                    x={x + barWidth / 2}
                    y={chartH + 26}
                    textAnchor="middle"
                    fill="currentColor"
                    fillOpacity={0.4}
                    fontSize={9}
                  >
                    {d.day}
                  </text>
                  {/* Value on top */}
                  {d.credits > 0 && (
                    <text
                      x={x + barWidth / 2}
                      y={chartH - h + 4}
                      textAnchor="middle"
                      fill="currentColor"
                      fillOpacity={0.5}
                      fontSize={9}
                      fontFamily="monospace"
                    >
                      {d.credits}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
