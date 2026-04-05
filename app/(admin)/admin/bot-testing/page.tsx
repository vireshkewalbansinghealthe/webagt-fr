"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
  FileCode2,
  Globe,
  AlertTriangle,
  Copy,
  LogIn,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BotRun {
  id: string;
  status: "running" | "passed" | "failed" | "timeout";
  projectName: string;
  projectUrl: string;
  previewUrl?: string;
  sector: string;
  prompt: string;
  userEmail: string;
  durationMs?: number;
  filesChanged?: string;
  creditsUsed?: string;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

const statusConfig = {
  running: { label: "Running", color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: Clock },
  passed: { label: "Passed", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-rose-500/10 text-rose-600 border-rose-500/20", icon: XCircle },
  timeout: { label: "Timeout", color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: AlertTriangle },
};

const TEST_ACCOUNTS = [
  { label: "Tester 1", email: "e2e-tester-1@webagt.ai", userId: "user_3BvSIKf5Lg448ZoIuqnORV4jxkm", password: "WebAGT-e2e-Test-2026!" },
  { label: "Tester 2", email: "e2e-tester-2@webagt.ai", userId: "user_3BvSIKNS6oW59jmUAys8gYgUGcj", password: "WebAGT-e2e-Test-2026!" },
  { label: "Tester 3", email: "e2e-tester-3@webagt.ai", userId: "user_3BvSIOOxYbPAZv5U3LudsrWVu5k", password: "WebAGT-e2e-Test-2026!" },
];

function CopyButton({ value, label, onCopy }: { value: string; label: string; onCopy?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(`${label} copied`);
        setTimeout(() => setCopied(false), 1500);
        onCopy?.();
      }}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors",
        copied
          ? "bg-emerald-500/10 text-emerald-600"
          : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground",
      )}
      title={`Copy ${label}`}
    >
      {value.length > 30 ? `${value.slice(0, 12)}...${value.slice(-8)}` : value}
      <Copy className="size-2.5 shrink-0" />
    </button>
  );
}

function LoginButton({ userId, email }: { userId: string; email: string }) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";
      const res = await fetch(`${workerUrl}/api/testing/sign-in-token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      } else {
        toast.error(data.error || "Failed to create sign-in token");
      }
    } catch {
      toast.error("Failed to create sign-in link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors",
        "bg-muted hover:bg-primary/10 text-muted-foreground hover:text-primary",
      )}
      title={`Login as ${email}`}
    >
      {loading ? <Loader2 className="size-2.5 animate-spin" /> : <LogIn className="size-2.5" />}
      {email}
    </button>
  );
}

function getAccountForEmail(email: string) {
  return TEST_ACCOUNTS.find((a) => a.email === email);
}

export default function BotTestingPage() {
  const { getToken } = useAuth();
  const [botRuns, setBotRuns] = useState<BotRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const client = createApiClient(getToken);
      const results = await client.testing.getAdminResults();
      setBotRuns(results.botRuns || []);
    } catch {
      toast.error("Failed to fetch bot runs");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const passed = botRuns.filter((r) => r.status === "passed").length;
  const failed = botRuns.filter((r) => r.status === "failed").length;
  const running = botRuns.filter((r) => r.status === "running").length;
  const timedOut = botRuns.filter((r) => r.status === "timeout").length;
  const completedRuns = botRuns.filter((r) => r.durationMs);
  const avgDuration = completedRuns.length > 0
    ? completedRuns.reduce((s, r) => s + (r.durationMs || 0), 0) / completedRuns.length
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bot Testing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Automated E2E test runs — each row is a full login → create project → AI generation flow.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchResults} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : botRuns.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Bot className="size-12 text-muted-foreground/20 mx-auto mb-4" />
          <p className="text-muted-foreground">No bot test runs yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Run <code className="bg-muted px-1.5 py-0.5 rounded">npm run test:e2e:generate</code> to start
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
            <Card className="p-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total</p>
              <p className="text-2xl font-bold mt-1">{botRuns.length}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">Running</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{running}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Passed</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{passed}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">Failed</p>
              <p className="text-2xl font-bold text-rose-600 mt-1">{failed}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">Timeout</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{timedOut}</p>
            </Card>
            <Card className="p-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Avg Time</p>
              <p className="text-2xl font-bold mt-1">{avgDuration > 0 ? `${(avgDuration / 60_000).toFixed(1)}m` : "—"}</p>
            </Card>
          </div>

          {/* Runs table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Project</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Sector</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Duration</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Files</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Credits</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">When</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Username</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {botRuns.map((run) => {
                    const cfg = statusConfig[run.status];
                    const StatusIcon = cfg.icon;
                    const isExpanded = expandedId === run.id;

                    return (
                      <Fragment key={run.id}>
                        <tr
                          className="hover:bg-muted/20 cursor-pointer transition-colors border-b border-border"
                          onClick={() => setExpandedId(isExpanded ? null : run.id)}
                        >
                          <td className="px-4 py-2.5">
                            <Badge variant="outline" className={cn("gap-1", cfg.color)}>
                              <StatusIcon className="size-3" />
                              {cfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-medium">{run.projectName}</span>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <Badge variant="secondary" className="text-[10px]">{run.sector}</Badge>
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell tabular-nums text-muted-foreground">
                            {run.durationMs ? `${(run.durationMs / 60_000).toFixed(1)}m` : "—"}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">
                            {run.filesChanged || "—"}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">
                            {run.creditsUsed || "—"}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">
                            {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
                          </td>
                          <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const acc = getAccountForEmail(run.userEmail);
                              return acc
                                ? <LoginButton userId={acc.userId} email={acc.email} />
                                : <span className="text-muted-foreground text-[11px] font-mono">{run.userEmail}</span>;
                            })()}
                          </td>
                          <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const acc = getAccountForEmail(run.userEmail);
                              return acc ? <CopyButton value={acc.password} label="Password" /> : <span className="text-muted-foreground">—</span>;
                            })()}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-4 py-4 bg-muted/10">
                              <div className="space-y-3 max-w-3xl">
                                <div>
                                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Prompt</p>
                                  <p className="text-sm text-foreground leading-relaxed">{run.prompt}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  {run.projectUrl && (
                                    <a href={run.projectUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                      <FileCode2 className="size-3" /> Open in Editor
                                    </a>
                                  )}
                                  {run.previewUrl && (
                                    <a href={run.previewUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                                      <Globe className="size-3" /> Live Preview
                                    </a>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                  <div>
                                    <p className="text-muted-foreground">Started</p>
                                    <p className="font-medium">{format(new Date(run.startedAt), "dd-MM-yyyy HH:mm:ss")}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Completed</p>
                                    <p className="font-medium">{run.completedAt ? format(new Date(run.completedAt), "dd-MM-yyyy HH:mm:ss") : "—"}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Run ID</p>
                                    <p className="font-mono text-[10px]">{run.id}</p>
                                  </div>
                                </div>
                                {run.error && (
                                  <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20">
                                    <p className="text-xs font-bold text-rose-600 mb-1 flex items-center gap-1">
                                      <XCircle className="size-3" /> Error
                                    </p>
                                    <p className="text-xs text-rose-600/80">{run.error}</p>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
