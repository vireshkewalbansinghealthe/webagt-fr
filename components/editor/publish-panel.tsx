"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Globe,
  Loader2,
  CheckCircle2,
  ExternalLink,
  RotateCw,
  ChevronRight,
  Activity,
  Link2,
  Link2Off,
  RefreshCcw,
  AlertTriangle,
  ShieldCheck,
  XCircle,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createApiClient } from "@/lib/api-client";
import { toast } from "sonner";

interface PublishPanelProps {
  project: Project;
  onProjectChange?: (project: Project) => void;
}

export function PublishPanel({ project: initialProject, onProjectChange }: PublishPanelProps) {
  const [project, setProject] = useState(initialProject);
  const { getToken } = useAuth();

  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [domainMode, setDomainMode] = useState<"subdomain" | "custom">("subdomain");
  const [customDomain, setCustomDomain] = useState("");
  const [deployedUrl, setDeployedUrl] = useState<string | null>(null);

  const [domainInput, setDomainInput] = useState(project.customDomain ?? "");
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainRemoving, setDomainRemoving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    verified: boolean;
    serverIp: string | null;
    domainIp: string | null;
    cname: string | null;
    serverHostname: string;
  } | null>(null);
  const [serverIp, setServerIp] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setProject(initialProject); }, [initialProject]);

  useEffect(() => {
    const client = createApiClient(getToken);
    client.projects.get(project.id)
      .then(({ project: fresh }) => { setProject(fresh); onProjectChange?.(fresh); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch("https://cloudflare-dns.com/dns-query?name=dock.4esh.nl&type=A", {
      headers: { Accept: "application/dns-json" },
    })
      .then((r) => r.json())
      .then((data: any) => {
        const ip = data?.Answer?.find((r: any) => r.type === 1)?.data ?? null;
        setServerIp(ip);
      })
      .catch(() => {});
  }, []);

  const isAlreadyDeployed = !!project.deployment_uuid;
  const siteUrl = deployedUrl || `https://agt-${project.id.substring(0, 8)}.dock.4esh.nl`;
  const isDeploySuccess = logs.some((log) => log.includes("✨ Deployment completed successfully!"));
  const isDeployFailed = logs.some((log) => log.includes("❌ Deployment failed"));
  const isDeploying = loading;

  const fireConfetti = () => {
    if (typeof window === "undefined") return;
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js";
    script.onload = () => {
      (window as any).confetti?.({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#26ccff", "#a25afd", "#ff5e7e", "#88ff5a", "#fcff42", "#ffa62d", "#ff36ff"],
      });
    };
    document.head.appendChild(script);
  };

  const startPolling = useCallback(
    (deploymentUuid: string, url: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setLoading(true);
      let isFinished = false;
      let lastLogsHash = "";
      const client = createApiClient(getToken);

      pollRef.current = setInterval(async () => {
        try {
          const statusData = await client.projects.getDeploymentStatus(project.id, deploymentUuid);

          if (statusData.logs) {
            try {
              const currentLogsHash = statusData.logs.length.toString();
              if (currentLogsHash !== lastLogsHash) {
                lastLogsHash = currentLogsHash;
                const parsedLogs = JSON.parse(statusData.logs);
                const outputLogs = parsedLogs
                  .map((l: any) => l.output || "")
                  .filter(Boolean)
                  .map((log: string) => log.trim())
                  .filter((log: string) => log.length > 0);
                if (outputLogs.length > 0) {
                  const uniqueLogs = outputLogs.filter(
                    (log: string, index: number, arr: string[]) => index === 0 || log !== arr[index - 1]
                  );
                  setLogs(["Deployment in progress...", ...uniqueLogs]);
                }
              }
            } catch {
              // Ignore parse errors
            }
          }

          if (statusData.status === "finished") {
            isFinished = true;
            if (pollRef.current) clearInterval(pollRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setLoading(false);
            setLogs((prev) => [...prev, "✨ Deployment completed successfully!", `URL: ${url}`]);
            fireConfetti();
            toast.success("Project published successfully!");
            client.projects
              .update(project.id, { lastDeployStatus: "success" })
              .then(({ project: p }) => {
                setProject(p);
                onProjectChange?.(p);
              })
              .catch(() => {});
          } else if (statusData.status === "failed") {
            isFinished = true;
            if (pollRef.current) clearInterval(pollRef.current);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setLoading(false);
            setLogs((prev) => [...prev, "❌ Deployment failed. Please check the logs above."]);
            toast.error("Deployment failed");
            client.projects
              .update(project.id, { lastDeployStatus: "failed" })
              .then(({ project: p }) => {
                setProject(p);
                onProjectChange?.(p);
              })
              .catch(() => {});
          }
        } catch (e) {
          console.error("Polling error:", e);
        }
      }, 3000);

      timeoutRef.current = setTimeout(() => {
        if (!isFinished && pollRef.current) {
          clearInterval(pollRef.current);
          setLoading(false);
          setLogs((prev) => [
            ...prev,
            "Deployment is taking a long time. It might still be running in the background.",
          ]);
        }
      }, 5 * 60 * 1000);
    },
    [getToken, project.id, onProjectChange]
  );

  useEffect(() => {
    if (project.lastDeployStatus === "deploying" && project.lastDeploymentUuid && !pollRef.current) {
      const url = project.customDomain
        ? `https://${project.customDomain}`
        : `https://agt-${project.id.substring(0, 8)}.dock.4esh.nl`;
      setLogs(["Resuming deployment progress..."]);
      startPolling(project.lastDeploymentUuid, url);
    }
  }, [project.lastDeployStatus, project.lastDeploymentUuid, project.id, project.customDomain, startPolling]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handlePublish = async () => {
    setLoading(true);
    setLogs(["Pushing code to GitHub and initiating deployment on Coolify..."]);
    try {
      const payload: any = {};
      if (domainMode === "custom" && customDomain.trim()) {
        payload.customDomain = customDomain.trim();
      }

      const client = createApiClient(getToken);
      const data = await client.projects.publish(project.id, payload.customDomain);
      const refreshedProject = await client.projects.get(project.id);
      setProject(refreshedProject.project);
      onProjectChange?.(refreshedProject.project);

      if (data.url) setDeployedUrl(data.url);

      if (!data.deploymentUuid) {
        setLogs((prev) => [...prev, "Deployment triggered, but no tracking UUID returned.", `URL: ${data.url}`]);
        toast.success("Project published successfully!");
        setLoading(false);
        return;
      }

      client.projects.update(project.id, { lastDeploymentUuid: data.deploymentUuid }).catch(() => {});
      setLogs((prev) => [...prev, "Deployment started. Fetching real-time logs..."]);
      startPolling(data.deploymentUuid, data.url);
    } catch (err: any) {
      console.error(err);
      setLogs((prev) => [...prev, `Error: ${err.message}`]);
      toast.error(err.message || "Failed to publish");
      setLoading(false);
    }
  };

  const handleAddDomain = async () => {
    const d = domainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
    if (!d) return;
    setDomainSaving(true);
    setVerifyResult(null);
    try {
      const token = await getToken();
      const { WORKER_URL } = await import("@/lib/api-client");
      const res = await fetch(`${WORKER_URL}/api/projects/${project.id}/custom-domain`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d }),
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Failed to add domain");
      const refreshed = await (await import("@/lib/api-client")).createApiClient(getToken).projects.get(project.id);
      setProject(refreshed.project);
      onProjectChange?.(refreshed.project);
      toast.success("Domain added! Now configure your DNS records below.");
    } catch (err: any) {
      toast.error(err.message || "Failed to add domain");
    } finally {
      setDomainSaving(false);
    }
  };

  const handleRemoveDomain = async () => {
    setDomainRemoving(true);
    setVerifyResult(null);
    try {
      const token = await getToken();
      const { WORKER_URL } = await import("@/lib/api-client");
      const res = await fetch(`${WORKER_URL}/api/projects/${project.id}/custom-domain`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to remove domain");
      const refreshed = await (await import("@/lib/api-client")).createApiClient(getToken).projects.get(project.id);
      setProject(refreshed.project);
      onProjectChange?.(refreshed.project);
      setDomainInput("");
      toast.success("Custom domain removed.");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove domain");
    } finally {
      setDomainRemoving(false);
    }
  };

  const handleVerifyDomain = async () => {
    setDomainVerifying(true);
    try {
      const token = await getToken();
      const { WORKER_URL } = await import("@/lib/api-client");
      const res = await fetch(`${WORKER_URL}/api/projects/${project.id}/custom-domain/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = (await res.json()) as any;
      if (!res.ok) throw new Error(data.error || "Verification failed");
      setVerifyResult(data);
      if (data.verified) {
        const refreshed = await (await import("@/lib/api-client")).createApiClient(getToken).projects.get(project.id);
        setProject(refreshed.project);
        onProjectChange?.(refreshed.project);
        toast.success("Domain verified! Your custom domain is active.");
      } else {
        toast.info("DNS not propagated yet. It can take up to 48 hours — try again later.");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed");
    } finally {
      setDomainVerifying(false);
    }
  };

  // Smooth progress bar: ramps from 0→95% over ~3 minutes using easing
  const deployProgress = useDeployProgress(isDeploying, isDeploySuccess || isDeployFailed);

  const isLive = isAlreadyDeployed && project.lastDeployStatus !== "failed" && project.lastDeployStatus !== "deploying";

  // ── Already deployed: live status view ──
  if ((isLive && !isDeploying && logs.length === 0) || isDeploySuccess) {
    const savedDomain = project.customDomain;
    const isVerified = project.customDomainVerified;
    const activeSiteUrl = savedDomain ? `https://${savedDomain}` : siteUrl;

    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h3 className="text-lg font-semibold">Publish Website</h3>
          <p className="text-sm text-muted-foreground">Deploy your website to the live internet.</p>
        </div>

        {/* Live status card */}
        <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl text-center space-y-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="mx-auto w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle2 className="size-6 text-green-600" />
          </div>
          <h3 className="text-lg font-bold text-green-700 dark:text-green-400">Your site is live!</h3>
          <div className="font-mono text-sm text-green-700 dark:text-green-400 bg-green-500/10 rounded-lg py-2 px-4 inline-block">
            {activeSiteUrl}
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Button
              onClick={() => window.open(activeSiteUrl, "_blank")}
              className="bg-green-600 hover:bg-green-700 text-white shadow-sm gap-2"
            >
              <ExternalLink className="size-4" /> View Site
            </Button>
            <Button
              variant="outline"
              onClick={() => { setLogs([]); handlePublish(); }}
              disabled={loading}
              className="gap-2"
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              Redeploy
            </Button>
          </div>
        </div>

        {/* Custom Domain Section */}
        <CustomDomainSection
          project={project}
          savedDomain={savedDomain}
          isVerified={isVerified}
          domainInput={domainInput}
          setDomainInput={setDomainInput}
          domainSaving={domainSaving}
          domainRemoving={domainRemoving}
          domainVerifying={domainVerifying}
          verifyResult={verifyResult}
          serverIp={serverIp}
          onAdd={handleAddDomain}
          onRemove={handleRemoveDomain}
          onVerify={handleVerifyDomain}
        />

        {/* Deploy logs */}
        <DeployLogs logs={logs} isDeployFailed={isDeployFailed} />
      </div>
    );
  }

  // ── Not yet deployed or deploying ──
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Publish Website</h3>
        <p className="text-sm text-muted-foreground">
          Deploy your website to the live internet with one click.
        </p>
      </div>

      {project.lastDeployStatus === "failed" && isAlreadyDeployed && (
        <div className="rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-6 space-y-2">
          <div className="flex items-start gap-3">
            <XCircle className="size-5 text-red-600 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-semibold text-red-900 dark:text-red-400">Last deployment failed</h4>
              <p className="text-sm text-red-800/90 dark:text-red-400/80">
                Try publishing again — if the issue persists, check deployment logs for details.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 border rounded-xl bg-card shadow-sm space-y-6">
        {/* Domain config */}
        <div className="space-y-4">
          <h4 className="font-medium">Domain Configuration</h4>
          <div className="flex gap-4">
            <button
              onClick={() => setDomainMode("subdomain")}
              className={cn(
                "flex-1 p-4 rounded-xl border text-left transition-all",
                domainMode === "subdomain"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-primary/50"
              )}
            >
              <div className="font-medium mb-1">Free Subdomain</div>
              <div className="text-xs text-muted-foreground">
                agt-{project.id.substring(0, 8)}.dock.4esh.nl
              </div>
            </button>
            <button
              onClick={() => setDomainMode("custom")}
              className={cn(
                "flex-1 p-4 rounded-xl border text-left transition-all",
                domainMode === "custom"
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:border-primary/50"
              )}
            >
              <div className="font-medium mb-1">Custom Domain</div>
              <div className="text-xs text-muted-foreground">Use your own domain</div>
            </button>
          </div>

          {domainMode === "custom" && (
            <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Your Domain</label>
                <Input
                  placeholder="e.g. mysite.com"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                />
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-2">
                  <Activity className="size-4" />
                  DNS Configuration Required
                </h5>
                <p className="text-xs text-blue-600 dark:text-blue-400/80 mb-3">
                  Add an A record in your DNS settings pointing to our server IP:
                </p>
                <div className="bg-background border rounded font-mono text-sm p-3 flex justify-between items-center">
                  <span>{process.env.NEXT_PUBLIC_COOLIFY_IP || "62.251.109.139"}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      navigator.clipboard.writeText(process.env.NEXT_PUBLIC_COOLIFY_IP || "62.251.109.139");
                      toast.success("IP copied to clipboard");
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Publish button */}
        <div className="pt-4 border-t flex items-center justify-between">
          <div>
            <h4 className="font-medium">Live Deployment</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Your site will be built and deployed publicly.
            </p>
          </div>
          <Button
            onClick={handlePublish}
            disabled={loading || (domainMode === "custom" && !customDomain.trim())}
            className="gap-2"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Rocket className="size-4" />
            )}
            {loading ? "Publishing..." : "Publish Now"}
          </Button>
        </div>
      </div>

      {/* Deploy progress + logs */}
      {logs.length > 0 && (
        <div className="space-y-4">
          {isDeploying && (
            <div className="p-6 border rounded-xl bg-card shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity className="size-4 text-blue-500 animate-pulse" />
                  Deployment Progress
                </h4>
                <span className="text-xs text-muted-foreground font-mono tabular-nums">
                  {Math.round(deployProgress)}%
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="bg-primary h-2 rounded-full transition-[width] duration-700 ease-out"
                  style={{ width: `${deployProgress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {deployProgress < 15
                  ? "Pushing code to GitHub..."
                  : deployProgress < 40
                    ? "Building container..."
                    : deployProgress < 70
                      ? "Installing dependencies..."
                      : deployProgress < 90
                        ? "Starting application..."
                        : "Finalizing deployment..."}
              </p>
            </div>
          )}

          {isDeployFailed && (
            <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-center space-y-3">
              <h4 className="font-medium text-red-700">Deployment Failed</h4>
              <p className="text-sm text-red-600/80">Check the logs below for details.</p>
            </div>
          )}

          <DeployLogs logs={logs} isDeployFailed={isDeployFailed} />
        </div>
      )}
    </div>
  );
}

/**
 * Smooth progress that ramps from 0→95% over time using exponential easing.
 * Starts slow, accelerates in the middle, then slows down approaching 95%.
 * Jumps to 100% when deployment finishes.
 */
function useDeployProgress(isDeploying: boolean, isFinished: boolean): number {
  const [progress, setProgress] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isFinished) {
      setProgress(100);
      startTimeRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (!isDeploying) {
      setProgress(0);
      startTimeRef.current = null;
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }

    const tick = () => {
      const elapsed = (Date.now() - startTimeRef.current!) / 1000;
      const p = 95 * (1 - Math.exp(-elapsed / 60));
      setProgress(Math.round(p));
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isDeploying, isFinished]);

  return progress;
}

function CustomDomainSection({
  project,
  savedDomain,
  isVerified,
  domainInput,
  setDomainInput,
  domainSaving,
  domainRemoving,
  domainVerifying,
  verifyResult,
  serverIp,
  onAdd,
  onRemove,
  onVerify,
}: {
  project: Project;
  savedDomain?: string;
  isVerified?: boolean;
  domainInput: string;
  setDomainInput: (v: string) => void;
  domainSaving: boolean;
  domainRemoving: boolean;
  domainVerifying: boolean;
  verifyResult: { verified: boolean; serverIp: string | null; domainIp: string | null; cname: string | null } | null;
  serverIp: string | null;
  onAdd: () => void;
  onRemove: () => void;
  onVerify: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Globe className="size-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Custom Domain</span>
        {savedDomain &&
          (isVerified ? (
            <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-medium">
              <ShieldCheck className="size-3.5" /> Verified
            </span>
          ) : (
            <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 font-medium">
              <AlertTriangle className="size-3.5" /> Pending DNS
            </span>
          ))}
      </div>

      <div className="p-4 space-y-4">
        {!savedDomain ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your own domain instead of the default Coolify URL.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 font-mono text-sm"
                  placeholder="www.yourdomain.com"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && onAdd()}
                />
              </div>
              <Button onClick={onAdd} disabled={domainSaving || !domainInput.trim()} className="gap-1.5 shrink-0">
                {domainSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                Add Domain
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 font-mono text-sm font-medium">{savedDomain}</span>
              {isVerified && <ShieldCheck className="size-4 text-green-600 shrink-0" />}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-muted-foreground hover:text-destructive h-7 px-2 shrink-0"
                disabled={domainRemoving}
                onClick={onRemove}
              >
                {domainRemoving ? <Loader2 className="size-3.5 animate-spin" /> : <Link2Off className="size-3.5" />}
                Remove
              </Button>
            </div>

            {!isVerified && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-400">
                  <AlertTriangle className="size-4" />
                  Configure your DNS records
                </div>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/70">
                  Add one of the following records at your DNS provider:
                </p>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                    Option A — Subdomain (recommended)
                  </p>
                  <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-black/20 overflow-hidden text-xs font-mono">
                    <div className="grid grid-cols-[80px_1fr_1fr] divide-x divide-amber-100 dark:divide-amber-900 text-amber-900/60 dark:text-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5">
                      <span>Type</span><span>Name</span><span>Value</span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr_1fr] divide-x divide-amber-100 dark:divide-amber-900 px-3 py-2">
                      <span className="text-blue-600 font-bold">CNAME</span>
                      <span className="px-2 text-foreground">
                        {savedDomain.split(".").length > 2 ? savedDomain.split(".")[0] : "@"}
                      </span>
                      <span className="px-2 text-foreground">dock.4esh.nl</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                    Option B — Root / apex domain
                  </p>
                  <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-black/20 overflow-hidden text-xs font-mono">
                    <div className="grid grid-cols-[80px_1fr_1fr] divide-x divide-amber-100 dark:divide-amber-900 text-amber-900/60 dark:text-amber-400/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5">
                      <span>Type</span><span>Name</span><span>Value</span>
                    </div>
                    <div className="grid grid-cols-[80px_1fr_1fr] divide-x divide-amber-100 dark:divide-amber-900 px-3 py-2">
                      <span className="text-purple-600 font-bold">A</span>
                      <span className="px-2 text-foreground">@</span>
                      <span className="px-2 text-foreground">{serverIp ?? "loading…"}</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-amber-700/70 dark:text-amber-400/60">
                  DNS changes can take <strong>up to 48 hours</strong> to propagate. Once done, click Verify below.
                </p>
              </div>
            )}

            {isVerified && (
              <div className="rounded-lg border border-green-200 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20 p-3 flex items-center gap-3 text-sm text-green-700 dark:text-green-400">
                <ShieldCheck className="size-4 shrink-0" />
                <span>
                  DNS verified — <strong>https://{savedDomain}</strong> is active.
                </span>
              </div>
            )}

            {verifyResult && !verifyResult.verified && (
              <div className="rounded-lg border bg-muted/30 p-3 text-xs font-mono space-y-1 text-muted-foreground">
                <p>Server IP: <span className="text-foreground">{verifyResult.serverIp ?? "n/a"}</span></p>
                <p>Your domain A: <span className="text-foreground">{verifyResult.domainIp ?? "not found"}</span></p>
                <p>Your domain CNAME: <span className="text-foreground">{verifyResult.cname ?? "not found"}</span></p>
              </div>
            )}

            <Button
              variant={isVerified ? "outline" : "default"}
              size="sm"
              className="gap-1.5 w-full"
              disabled={domainVerifying}
              onClick={onVerify}
            >
              {domainVerifying ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCcw className="size-3.5" />}
              {isVerified ? "Re-verify DNS" : "Verify DNS Configuration"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function DeployLogs({ logs, isDeployFailed }: { logs: string[]; isDeployFailed: boolean }) {
  if (logs.length === 0) return null;
  return (
    <details className="group" open={isDeployFailed}>
      <summary className="flex items-center gap-2 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
        Deployment Logs
      </summary>
      <div className="mt-4 p-4 bg-muted/50 border rounded-lg font-mono text-xs space-y-1 max-h-64 overflow-y-auto flex flex-col-reverse shadow-inner">
        <div>
          {logs.map((log, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap py-0.5",
                log.startsWith("Error") || log.startsWith("Oops")
                  ? "text-red-500 font-medium"
                  : log.startsWith("✨")
                    ? "text-green-500 font-medium"
                    : log.startsWith("URL:")
                      ? "text-blue-500 underline cursor-pointer"
                      : "text-muted-foreground"
              )}
            >
              {log}
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}
