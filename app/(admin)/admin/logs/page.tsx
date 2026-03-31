"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient, type AdminUserSummary } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Search,
  RefreshCw,
  Trash2,
  ScrollText,
  Database,
  ChevronRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Info,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const LOG_ICON: Record<string, typeof Info> = {
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
};
const LOG_COLOR: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-amber-400",
  error: "text-red-400",
};

interface LogEntry {
  id: number;
  level: string;
  source: string | null;
  message: string;
  detail: string | null;
  createdAt: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  type?: string;
  hasTurso: boolean;
}

export default function AdminLogsPage() {
  const { getToken } = useAuth();

  // Mode: "input" (enter project ID) or "browse" (pick user → project)
  const [mode, setMode] = useState<"input" | "browse">("input");

  // Direct project ID input
  const [projectIdInput, setProjectIdInput] = useState("");

  // User search for browse mode
  const [userSearch, setUserSearch] = useState("");
  const [users, setUsers] = useState<(AdminUserSummary & { projectCount: number })[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selected user's projects
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);

  // Active project logs
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "info" | "warn" | "error">("all");

  const searchUsers = useCallback(
    async (q: string) => {
      if (!q.trim()) { setUsers([]); return; }
      setUsersLoading(true);
      try {
        const client = createApiClient(getToken);
        const data = await client.admin.listUsers({ limit: 10, q });
        setUsers(data.users);
      } catch {
        toast.error("Failed to search users");
      } finally {
        setUsersLoading(false);
      }
    },
    [getToken],
  );

  function handleUserSearch(val: string) {
    setUserSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchUsers(val), 300);
  }

  async function selectUser(user: AdminUserSummary) {
    setSelectedUser(user);
    setProjectsLoading(true);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getUserProjects(user.id);
      setProjects(data.projects);
    } catch {
      toast.error("Failed to load projects");
    } finally {
      setProjectsLoading(false);
    }
  }

  const fetchLogs = useCallback(
    async (projectId: string) => {
      setLogsLoading(true);
      setLogsError(null);
      try {
        const client = createApiClient(getToken);
        const data = await client.admin.getProjectLogs(projectId, { limit: 300 });
        setLogs(data.logs as LogEntry[]);
      } catch (e: any) {
        setLogsError(e.message || "Failed to fetch logs");
        setLogs([]);
      } finally {
        setLogsLoading(false);
      }
    },
    [getToken],
  );

  function openProjectLogs(projectId: string, name?: string) {
    setActiveProjectId(projectId);
    setActiveProjectName(name || projectId);
    setFilter("all");
    fetchLogs(projectId);
  }

  function handleDirectLookup() {
    const id = projectIdInput.trim();
    if (!id) return;
    openProjectLogs(id, id);
  }

  const filtered = filter === "all" ? logs : logs.filter((l) => l.level === filter);

  // If viewing logs, show log viewer
  if (activeProjectId) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <button
          onClick={() => { setActiveProjectId(null); setLogs([]); setLogsError(null); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back
        </button>

        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ScrollText className="size-5" />
              Project Logs
            </h1>
            <p className="mt-1 text-sm text-muted-foreground font-mono">{activeProjectName}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5 gap-0.5">
              {(["all", "info", "warn", "error"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setFilter(l)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all capitalize",
                    filter === l
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs(activeProjectId)}
              disabled={logsLoading}
            >
              <RefreshCw className={cn("size-3.5", logsLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>

        {logsError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2 mb-4">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            {logsError}
          </div>
        )}

        {logsLoading && logs.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border rounded-lg bg-card p-12 text-center text-muted-foreground text-sm">
            <ScrollText className="size-10 mx-auto mb-3 text-muted-foreground/30" />
            {logs.length === 0 ? "No logs found for this project." : `No ${filter} logs.`}
          </div>
        ) : (
          <div className="border rounded-lg bg-card overflow-hidden">
            <div className="max-h-[600px] overflow-y-auto font-mono text-xs divide-y divide-border">
              {filtered.map((log) => {
                const Icon = LOG_ICON[log.level] || Info;
                return (
                  <div key={log.id} className="px-4 py-2.5 hover:bg-muted/20 flex items-start gap-3">
                    <Icon className={cn("size-3.5 shrink-0 mt-0.5", LOG_COLOR[log.level])} />
                    <span className={cn("uppercase font-bold w-12 shrink-0", LOG_COLOR[log.level] || "text-muted-foreground")}>
                      {log.level?.toUpperCase()}
                    </span>
                    <span className="text-muted-foreground/50 w-20 shrink-0 text-[10px]">
                      {log.createdAt
                        ? new Date(log.createdAt + "Z").toLocaleString("nl-NL", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            day: "2-digit",
                            month: "short",
                          })
                        : "—"}
                    </span>
                    {log.source && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {log.source}
                      </Badge>
                    )}
                    <span className="text-foreground break-all flex-1">{log.message}</span>
                    {log.detail && (
                      <details className="text-muted-foreground/50 shrink-0 max-w-xs">
                        <summary className="cursor-pointer text-[10px] hover:text-foreground">detail</summary>
                        <pre className="mt-1 whitespace-pre-wrap text-[10px] max-h-32 overflow-y-auto">{log.detail}</pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Showing {filtered.length} of {logs.length} log entries
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Project Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Debug any project&apos;s database logs — seed events, errors, and operations.
        </p>
      </div>

      {/* Two modes */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Direct project ID lookup */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold mb-1">Lookup by Project ID</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Paste a project ID to fetch its logs directly.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. m2r4rQhB9x-N7"
              value={projectIdInput}
              onChange={(e) => setProjectIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDirectLookup()}
              className="font-mono text-sm"
            />
            <Button onClick={handleDirectLookup} disabled={!projectIdInput.trim()}>
              <ScrollText className="size-4" />
              Fetch
            </Button>
          </div>
        </div>

        {/* Browse by user */}
        <div className="rounded-xl border bg-card p-6">
          <h2 className="text-sm font-semibold mb-1">Browse by User</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Search for a user, then pick a project.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by name or email…"
              value={userSearch}
              onChange={(e) => handleUserSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {usersLoading && (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}

          {!usersLoading && users.length > 0 && (
            <ul className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              {users.map((u) => (
                <li key={u.id}>
                  <button
                    onClick={() => selectUser(u)}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm text-left transition-colors hover:bg-muted/50",
                      selectedUser?.id === u.id && "bg-muted",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Selected user's projects */}
      {selectedUser && (
        <div className="mt-6">
          <Separator className="mb-6" />
          <div className="flex items-center gap-2 mb-4">
            <Database className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">
              Projects for {selectedUser.name}
            </h2>
            <Badge variant="outline" className="text-[10px]">{projects.length}</Badge>
          </div>

          {projectsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects found.</p>
          ) : (
            <div className="grid gap-2">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => p.hasTurso && openProjectLogs(p.id, p.name)}
                  disabled={!p.hasTurso}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                    p.hasTurso
                      ? "hover:bg-muted/50 cursor-pointer"
                      : "opacity-50 cursor-not-allowed",
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.id}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.type && (
                      <Badge variant="outline" className="text-[10px]">{p.type}</Badge>
                    )}
                    {p.hasTurso ? (
                      <Badge className="bg-green-500/15 text-green-600 border-green-500/20 text-[10px]">
                        Turso
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        No DB
                      </Badge>
                    )}
                    {p.hasTurso && <ChevronRight className="size-4 text-muted-foreground" />}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
