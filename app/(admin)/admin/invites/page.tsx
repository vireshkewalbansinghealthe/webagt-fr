"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient, type AdminInvite, type AdminPromoCode } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Mail,
  Send,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Copy,
  Check,
  Trash2,
  Ticket,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminInvitesPage() {
  const { getToken } = useAuth();

  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [promoCodes, setPromoCodes] = useState<AdminPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [email, setEmail] = useState("");
  const [credits, setCredits] = useState(50);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ code: string; emailSent: boolean; emailError?: string } | null>(null);

  // Quick code form
  const [quickCredits, setQuickCredits] = useState(50);
  const [quickMaxUses, setQuickMaxUses] = useState(1);
  const [quickLabel, setQuickLabel] = useState("");
  const [creatingCode, setCreatingCode] = useState(false);

  // Reveal states
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = createApiClient(getToken);
      const [inviteRes, codesRes] = await Promise.all([
        client.admin.getInvites(),
        client.admin.getPromoCodes(),
      ]);
      setInvites(inviteRes.invites);
      setPromoCodes(codesRes.codes);
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  const handleSendInvite = async () => {
    if (!email.includes("@") || credits < 1) return;
    setSending(true);
    setSendResult(null);
    setError(null);
    try {
      const client = createApiClient(getToken);
      const result = await client.admin.sendInvite({ email, credits, message: message || undefined });
      setSendResult(result);
      setRevealedCodes((prev) => new Set(prev).add(result.code));
      setEmail("");
      setMessage("");
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to send invite");
    } finally {
      setSending(false);
    }
  };

  const handleCreateCode = async () => {
    if (quickCredits < 1) return;
    setCreatingCode(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787"}/api/admin/promo-codes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${await getToken()}`,
          },
          body: JSON.stringify({
            credits: quickCredits,
            maxUses: quickMaxUses,
            ...(quickLabel ? { label: quickLabel } : {}),
          }),
        }
      );
      const data = await res.json() as any;
      if (!res.ok) throw new Error(data.error || "Failed");
      setRevealedCodes((prev) => new Set(prev).add(data.code));
      setQuickLabel("");
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to create code");
    } finally {
      setCreatingCode(false);
    }
  };

  const handleDeleteCode = async (code: string) => {
    try {
      const client = createApiClient(getToken);
      await client.admin.deletePromoCode(code);
      await load();
    } catch (e: any) {
      setError(e.message || "Failed to delete");
    }
  };

  const toggleReveal = (code: string) => {
    setRevealedCodes((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const maskCode = (code: string) =>
    code.length <= 2 ? "••••••" : code[0] + "•".repeat(code.length - 2) + code[code.length - 1];

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invites & Promo Codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite users by email or create shareable promo codes.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
        </Button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </div>
      )}

      <Tabs defaultValue="invite" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="invite" className="gap-1.5">
            <Mail className="size-3.5" />
            Email Invite
          </TabsTrigger>
          <TabsTrigger value="codes" className="gap-1.5">
            <Ticket className="size-3.5" />
            Promo Codes
            {promoCodes.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1.5 py-0">{promoCodes.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1.5">
            <Send className="size-3.5" />
            History
            {invites.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1.5 py-0">{invites.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Email Invite ────────────────────────────────────────── */}
        <TabsContent value="invite">
          <div className="rounded-xl border border-border bg-card p-6 space-y-5">
            <div>
              <h3 className="text-sm font-semibold mb-1">Send Email Invite</h3>
              <p className="text-xs text-muted-foreground">
                Generates a unique invite code and sends a beautiful email with instructions to sign up.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Credits to gift</Label>
                <Input
                  type="number"
                  value={credits}
                  onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
                  min={1}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Personal message (optional)</Label>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey! I thought you'd love building with AI..."
              />
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSendInvite} disabled={sending || !email.includes("@") || credits < 1} className="gap-2">
                <Send className="size-3.5" />
                {sending ? "Sending…" : "Send Invite"}
              </Button>

              {sendResult && (
                <div className="flex items-center gap-2 text-sm animate-in fade-in slide-in-from-left-2 duration-300">
                  {sendResult.emailSent ? (
                    <Badge className="bg-emerald-500/15 text-emerald-500 gap-1">
                      <Check className="size-3" /> Email sent
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="size-3" /> {sendResult.emailError || "Email failed"}
                    </Badge>
                  )}
                  <span className="text-muted-foreground">Code:</span>
                  <code className="font-mono font-bold text-primary">{sendResult.code}</code>
                  <CopyButton code={sendResult.code} copiedCode={copiedCode} onCopy={copyCode} />
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 2: Promo Codes ─────────────────────────────────────────── */}
        <TabsContent value="codes" className="space-y-6">
          {/* Create form */}
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-1">Create Promo Code</h3>
              <p className="text-xs text-muted-foreground">Auto-generates a code — no email sent. Share it however you like.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Credits</Label>
                <Input
                  type="number"
                  value={quickCredits}
                  onChange={(e) => setQuickCredits(parseInt(e.target.value) || 0)}
                  min={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max uses</Label>
                <Input
                  type="number"
                  value={quickMaxUses}
                  onChange={(e) => setQuickMaxUses(parseInt(e.target.value) || 1)}
                  min={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Label (optional)</Label>
                <Input
                  value={quickLabel}
                  onChange={(e) => setQuickLabel(e.target.value)}
                  placeholder="Beta testers"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCreateCode} disabled={creatingCode || quickCredits < 1} className="w-full gap-1.5">
                  <Plus className="size-3.5" />
                  {creatingCode ? "Creating…" : "Create"}
                </Button>
              </div>
            </div>
          </div>

          {/* Codes list */}
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : promoCodes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No promo codes yet. Create one above.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Code</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Credits</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Uses</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Label</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Created</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {promoCodes.map((pc) => (
                    <tr key={pc.code} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono text-xs font-bold bg-muted px-1.5 py-0.5 rounded">
                            {revealedCodes.has(pc.code) ? pc.code : maskCode(pc.code)}
                          </code>
                          <RevealButton revealed={revealedCodes.has(pc.code)} onToggle={() => toggleReveal(pc.code)} />
                          <CopyButton code={pc.code} copiedCode={copiedCode} onCopy={copyCode} />
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">{pc.credits}</td>
                      <td className="px-4 py-3">
                        <span className={cn("font-mono", pc.used >= pc.maxUses ? "text-destructive" : "text-muted-foreground")}>
                          {pc.used}/{pc.maxUses}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-40 truncate">{pc.label || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(pc.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteCode(pc.code)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 3: History ─────────────────────────────────────────────── */}
        <TabsContent value="history">
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : invites.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No invitations sent yet. Go to the &quot;Email Invite&quot; tab to send one.
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Credits</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Code</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => (
                    <tr key={inv.code} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 font-medium">{inv.email}</td>
                      <td className="px-4 py-3 font-mono">{inv.credits}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                            {revealedCodes.has(inv.code) ? inv.code : maskCode(inv.code)}
                          </code>
                          <RevealButton revealed={revealedCodes.has(inv.code)} onToggle={() => toggleReveal(inv.code)} />
                          <CopyButton code={inv.code} copiedCode={copiedCode} onCopy={copyCode} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {inv.redeemed ? (
                          <Badge className="bg-emerald-500/15 text-emerald-500 text-[10px]">Redeemed</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">Pending</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(inv.sentAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RevealButton({ revealed, onToggle }: { revealed: boolean; onToggle: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="size-6 p-0 text-muted-foreground" onClick={onToggle}>
      {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
    </Button>
  );
}

function CopyButton({ code, copiedCode, onCopy }: { code: string; copiedCode: string | null; onCopy: (c: string) => void }) {
  return (
    <Button variant="ghost" size="sm" className="size-6 p-0 text-muted-foreground" onClick={() => onCopy(code)}>
      {copiedCode === code ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
    </Button>
  );
}
