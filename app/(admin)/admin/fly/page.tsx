"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Server,
  RefreshCw,
  Play,
  Square,
  Wifi,
  WifiOff,
  ChevronDown,
  Terminal,
  Globe,
  Cpu,
  MemoryStick,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface FlyMachine {
  id: string;
  name: string;
  state: string;
  region: string;
  config?: {
    image?: string;
    guest?: { cpus?: number; memory_mb?: number };
    env?: Record<string, string>;
  };
  image_ref?: { digest?: string; labels?: Record<string, string> };
  created_at?: string;
  updated_at?: string;
  private_ip?: string;
  checks?: Array<{ name: string; status: string; output?: string }>;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level?: string;
  message?: string;
  instance?: string;
  region?: string;
  meta?: Record<string, string>;
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  error:   "text-rose-400",
  warn:    "text-amber-400",
  warning: "text-amber-400",
  info:    "text-sky-400",
  debug:   "text-slate-400",
};

const STATE_COLORS: Record<string, string> = {
  started:  "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  stopped:  "bg-slate-500/15 text-slate-400 border-slate-500/30",
  stopping: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  starting: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  error:    "bg-rose-500/15 text-rose-500 border-rose-500/30",
};

function MachineCard({ m }: { m: FlyMachine }) {
  const cpus = m.config?.guest?.cpus ?? "—";
  const memMb = m.config?.guest?.memory_mb;
  const mem = memMb ? `${memMb >= 1024 ? `${memMb / 1024}GB` : `${memMb}MB`}` : "—";
  const stateClass = STATE_COLORS[m.state] ?? STATE_COLORS.stopped;
  const isUp = m.state === "started";

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn("size-8 rounded-lg flex items-center justify-center shrink-0",
            isUp ? "bg-emerald-500/10" : "bg-muted")}>
            <Server className={cn("size-4", isUp ? "text-emerald-500" : "text-muted-foreground")} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{m.name || m.id}</p>
            <p className="text-xs text-muted-foreground font-mono truncate">{m.id}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn("shrink-0 text-[11px] border", stateClass)}>
          {m.state}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Globe className="size-3 shrink-0" />
          <span>{m.region?.toUpperCase() || "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Cpu className="size-3 shrink-0" />
          <span>{cpus} vCPU</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <MemoryStick className="size-3 shrink-0" />
          <span>{mem}</span>
        </div>
        {m.private_ip && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Wifi className="size-3 shrink-0" />
            <span className="font-mono truncate">{m.private_ip}</span>
          </div>
        )}
      </div>

      {m.checks && m.checks.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          {m.checks.map((chk, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px]">
              {chk.status === "passing" ? (
                <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
              ) : (
                <AlertCircle className="size-3 text-rose-500 shrink-0" />
              )}
              <span className="text-muted-foreground">{chk.name}</span>
              <span className={chk.status === "passing" ? "text-emerald-500" : "text-rose-500"}>
                {chk.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {m.updated_at && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="size-2.5" />
          Updated {formatDistanceToNow(new Date(m.updated_at), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}

export default function FlyAdminPage() {
  const { getToken } = useAuth();

  // Machines
  const [machines, setMachines] = useState<FlyMachine[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [machinesError, setMachinesError] = useState<string | null>(null);
  const [appName, setAppName] = useState("webagt-chat");

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logError, setLogError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [filterInstance, setFilterInstance] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [seenIds] = useState(() => new Set<string>());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchMachines = useCallback(async () => {
    setMachinesLoading(true);
    setMachinesError(null);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getFlyMachines();
      setMachines(data.machines ?? []);
      setAppName(data.app);
    } catch (e) {
      setMachinesError(e instanceof Error ? e.message : "Failed to load machines");
    } finally {
      setMachinesLoading(false);
    }
  }, [getToken]);

  const fetchLogs = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getFlyLogs({
        instance: filterInstance || undefined,
      });
      const newLogs: LogEntry[] = [];
      for (const entry of (data.logs ?? [])) {
        const id = entry.id || `${entry.timestamp}-${entry.message}`;
        if (!seenIds.has(id)) {
          seenIds.add(id);
          newLogs.push({ ...entry, id });
        }
      }
      if (newLogs.length > 0) {
        setLogs((prev) => {
          const combined = [...prev, ...newLogs];
          // Cap at 2000 lines
          return combined.slice(-2000);
        });
      }
      setLogError(null);
    } catch (e) {
      setLogError(e instanceof Error ? e.message : "Log fetch failed");
    }
  }, [getToken, filterInstance, seenIds]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  // Detect user scrolling up → disable auto-scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
  };

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    setIsPolling(true);
    fetchLogs();
    pollRef.current = setInterval(fetchLogs, 3000);
  }, [fetchLogs]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setIsPolling(false);
  }, []);

  // Start polling when filter changes - restart
  useEffect(() => {
    if (isPolling) {
      stopPolling();
      seenIds.clear();
      setLogs([]);
      // Small delay then restart
      const t = setTimeout(startPolling, 200);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInstance]);

  useEffect(() => {
    fetchMachines();
    return () => { stopPolling(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const uniqueInstances = Array.from(new Set(
    machines.filter(m => m.state === "started").map(m => m.id)
  ));

  const filteredLogs = filterLevel
    ? logs.filter(l => (l.level || "info").toLowerCase() === filterLevel)
    : logs;

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Server className="size-6 text-primary" />
            Fly.io Monitoring
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            App: <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{appName}</code>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMachines} disabled={machinesLoading}>
          <RefreshCw className={cn("size-4 mr-2", machinesLoading && "animate-spin")} />
          Vernieuwen
        </Button>
      </div>

      {/* Machines */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Machines ({machines.length})
        </h2>
        {machinesError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            {machinesError}
          </div>
        )}
        {machinesLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : machines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
            Geen machines gevonden
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines.map(m => <MachineCard key={m.id} m={m} />)}
          </div>
        )}
      </section>

      {/* Real-time logs */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Terminal className="size-4" />
            Live Logs
            {isPolling && (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            )}
          </h2>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Instance filter */}
            {uniqueInstances.length > 0 && (
              <select
                value={filterInstance}
                onChange={(e) => setFilterInstance(e.target.value)}
                className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 outline-none font-mono"
              >
                <option value="">Alle machines</option>
                {uniqueInstances.map(id => (
                  <option key={id} value={id}>{id.slice(0, 12)}</option>
                ))}
              </select>
            )}

            {/* Level filter */}
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="text-xs bg-muted border border-border rounded-md px-2 py-1.5 outline-none"
            >
              <option value="">Alle niveaus</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
            </select>

            {/* Clear */}
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-2"
              onClick={() => { seenIds.clear(); setLogs([]); }}
            >
              Wissen
            </Button>

            {/* Start / Stop */}
            {isPolling ? (
              <Button size="sm" variant="destructive" className="h-7 px-3 gap-1 text-xs" onClick={stopPolling}>
                <Square className="size-3" /> Stop
              </Button>
            ) : (
              <Button size="sm" className="h-7 px-3 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={startPolling}>
                <Play className="size-3" /> Start Live
              </Button>
            )}
          </div>
        </div>

        {logError && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-2 text-xs text-destructive mb-2">
            {logError}
          </div>
        )}

        {!autoScroll && (
          <button
            onClick={() => { setAutoScroll(true); logEndRef.current?.scrollIntoView({ behavior: "smooth" }); }}
            className="mb-2 flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary hover:bg-primary/20 transition-colors"
          >
            <ChevronDown className="size-3" /> Scroll naar beneden
          </button>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="bg-[#0d1117] rounded-xl border border-border h-[480px] overflow-y-auto p-4 font-mono text-xs leading-5"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
              <Terminal className="size-8 opacity-30" />
              <p>{isPolling ? "Wachten op logs…" : "Druk op 'Start Live' om logs te streamen."}</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {filteredLogs.map((log, i) => {
                const level = (log.level || "info").toLowerCase();
                const levelColor = LOG_LEVEL_COLORS[level] || "text-slate-300";
                const ts = log.timestamp
                  ? format(new Date(log.timestamp), "HH:mm:ss.SSS")
                  : "——";
                const machine = log.meta?.instance || log.instance;

                return (
                  <div key={`${log.id}-${i}`} className="flex gap-2 hover:bg-white/[0.03] rounded px-1 py-0.5">
                    <span className="text-slate-600 shrink-0 w-[80px]">{ts}</span>
                    {machine && (
                      <span className="text-slate-600 shrink-0 font-mono text-[10px] w-[72px] truncate">
                        {machine.slice(0, 8)}
                      </span>
                    )}
                    <span className={cn("shrink-0 w-[40px] font-bold uppercase text-[10px]", levelColor)}>
                      {level.slice(0, 4)}
                    </span>
                    <span className="text-slate-300 break-all whitespace-pre-wrap">
                      {log.message || JSON.stringify(log)}
                    </span>
                  </div>
                );
              })}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {filteredLogs.length} regels • elke 3s bijgewerkt • max 2000 regels
        </p>
      </section>
    </div>
  );
}
