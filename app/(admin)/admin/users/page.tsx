"use client";

export const dynamic = "force-dynamic";

/**
 * app/(admin)/admin/users/page.tsx
 *
 * Paginated user management table with search, plan filter, credit override,
 * and per-user project list in a slide-out detail sheet.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";
import { createApiClient, type AdminUserSummary } from "@/lib/api-client";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Eye,
  Trash2,
  Zap,
  FolderOpen,
  ExternalLink,
  UserCog,
  BarChart3,
  CreditCard,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { AnalyticsData } from "@/types/analytics";
import {
  StatsCards,
  ModelBreakdownCard,
  CreditsChart,
} from "@/components/analytics";

const PAGE_SIZE = 20;

interface UserWithCount extends AdminUserSummary {
  projectCount: number;
}

interface UserDetail {
  user: AdminUserSummary;
  projects: { id: string; name: string; updatedAt: string; type?: string }[];
  credits: Record<string, unknown> | null;
}

export default function AdminUsersPage() {
  const { getToken } = useAuth();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<UserWithCount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detail sheet
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Usage analytics
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Edit user dialog
  const [editUserDialogOpen, setEditUserDialogOpen] = useState(false);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Credits override dialog
  const [creditsDialogOpen, setCreditsDialogOpen] = useState(false);
  const [creditsRemaining, setCreditsRemaining] = useState("");
  const [creditsTotal, setCreditsTotal] = useState("");
  const [creditsPlan, setCreditsPlan] = useState("");
  const [creditsSaving, setCreditsSaving] = useState(false);

  // Delete project confirm
  const [deleteTarget, setDeleteTarget] = useState<{ userId: string; projectId: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchUsers = useCallback(
    async (pageNum: number, q: string) => {
      setLoading(true);
      try {
        const client = createApiClient(getToken);
        const data = await client.admin.listUsers({ limit: PAGE_SIZE, offset: pageNum * PAGE_SIZE, q: q || undefined });
        setUsers(data.users);
        setTotalCount(data.totalCount);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load users");
      } finally {
        setLoading(false);
      }
    },
    [getToken]
  );

  useEffect(() => {
    fetchUsers(page, search);
  }, [page, fetchUsers]); // intentionally exclude search; handled below

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setSearch(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(0);
      fetchUsers(0, val);
    }, 350);
  }

  async function openDetail(userId: string) {
    setSelectedUserId(userId);
    setDetail(null);
    setDetailLoading(true);
    setAnalytics(null);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getUser(userId);
      setDetail(data);
      // Pre-fill credits form
      const cr = data.credits as Record<string, unknown> | null;
      setCreditsRemaining(String(cr?.remaining ?? ""));
      setCreditsTotal(String(cr?.total ?? ""));
      setCreditsPlan(String(cr?.plan ?? "free"));
      
      // Pre-fill edit user form
      const nameParts = data.user.name.split(" ");
      setEditFirstName(nameParts[0] || "");
      setEditLastName(nameParts.slice(1).join(" ") || "");
      setEditRole(data.user.role || "user");
      setEditPlan(data.user.plan || "free");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load user detail");
    } finally {
      setDetailLoading(false);
    }
  }

  async function fetchUserAnalytics(userId: string) {
    setAnalyticsLoading(true);
    try {
      const client = createApiClient(getToken);
      const data = await client.admin.getUserAnalytics(userId);
      setAnalytics(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load usage analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }

  async function saveUserData() {
    if (!selectedUserId) return;
    setEditSaving(true);
    try {
      const client = createApiClient(getToken);
      await client.admin.updateUser(selectedUserId, {
        firstName: editFirstName,
        lastName: editLastName,
        role: editRole,
        plan: editPlan,
      });
      toast.success("Gebruikersgegevens gewijzigd");
      setEditUserDialogOpen(false);
      openDetail(selectedUserId); // refresh
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update user data");
    } finally {
      setEditSaving(false);
    }
  }

  async function saveCredits() {
    if (!selectedUserId) return;
    setCreditsSaving(true);
    try {
      const client = createApiClient(getToken);
      await client.admin.updateCredits(selectedUserId, {
        remaining: creditsRemaining !== "" ? Number(creditsRemaining) : undefined,
        total: creditsTotal !== "" ? Number(creditsTotal) : undefined,
        plan: creditsPlan || undefined,
      });
      toast.success("Credits updated");
      setCreditsDialogOpen(false);
      openDetail(selectedUserId); // refresh
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update credits");
    } finally {
      setCreditsSaving(false);
    }
  }

  async function confirmDeleteProject() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const client = createApiClient(getToken);
      await client.admin.deleteProject(deleteTarget.userId, deleteTarget.projectId);
      toast.success(`Deleted project "${deleteTarget.name}"`);
      setDeleteTarget(null);
      if (selectedUserId) openDetail(selectedUserId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete project");
    } finally {
      setDeleteLoading(false);
    }
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gebruikersoverzicht</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Laden…" : `${totalCount.toLocaleString()} gebruikers totaal`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchUsers(page, search)}
          disabled={loading}
        >
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Vernieuwen
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Zoeken op naam of e-mail…"
          value={search}
          onChange={handleSearchChange}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Gebruiker</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Abonnement</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Projecten</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Lid sinds</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Laatst actief</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Skeleton className="size-8 rounded-full shrink-0" />
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-40" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell"><Skeleton className="h-5 w-12 rounded-full" /></td>
                  <td className="px-4 py-3 hidden md:table-cell"><Skeleton className="h-4 w-6" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3 hidden lg:table-cell"><Skeleton className="h-4 w-24" /></td>
                  <td className="px-4 py-3"><Skeleton className="h-7 w-16 ml-auto" /></td>
                </tr>
              ))}

            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                  No users found.
                </td>
              </tr>
            )}

            {!loading &&
              users.map((u) => (
                <tr
                  key={u.id}
                  className={`transition-colors hover:bg-accent/40 ${
                    searchParams.get("highlight") === u.id ? "bg-primary/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 shrink-0">
                        <AvatarImage src={u.imageUrl} />
                        <AvatarFallback className="text-xs">
                          {u.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{u.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <PlanBadge plan={u.plan} />
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">
                    {u.projectCount}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {u.lastSignInAt
                      ? formatDistanceToNow(new Date(u.lastSignInAt), { addSuffix: true })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openDetail(u.id)}
                      className="text-xs"
                    >
                      <Eye className="size-3.5" />
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── User Detail Dialog ── */}
      <Dialog open={!!selectedUserId} onOpenChange={(o) => { if (!o) setSelectedUserId(null); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
          {detailLoading || !detail ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-60" />
              <Skeleton className="h-32 w-full mt-4" />
            </div>
          ) : (
            <>
              <DialogHeader className="p-6 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarImage src={detail.user.imageUrl} />
                      <AvatarFallback>{detail.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle>{detail.user.name}</DialogTitle>
                      <DialogDescription>{detail.user.email}</DialogDescription>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setEditUserDialogOpen(true)}>
                    <UserCog className="size-3.5 mr-1" />
                    Bewerken
                  </Button>
                </div>
              </DialogHeader>

              <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden" onValueChange={(v) => {
                if (v === "analytics" && !analytics) fetchUserAnalytics(detail.user.id);
              }}>
                <div className="px-6 border-b">
                  <TabsList className="bg-transparent h-auto p-0 gap-6">
                    <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2.5 text-sm">
                      <User className="size-3.5 mr-2" />
                      Overzicht
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-0 py-2.5 text-sm">
                      <BarChart3 className="size-3.5 mr-2" />
                      Token verbruik
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  <TabsContent value="overview" className="mt-0 space-y-6">
                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <InfoRow label="Abonnement" value={<PlanBadge plan={detail.user.plan} />} />
                      <InfoRow label="Rol" value={<Badge variant="outline" className="text-xs uppercase">{detail.user.role}</Badge>} />
                      <InfoRow
                        label="Lid sinds"
                        value={format(new Date(detail.user.createdAt), "PPP")}
                      />
                      <InfoRow
                        label="Laatst actief"
                        value={
                          detail.user.lastSignInAt
                            ? formatDistanceToNow(new Date(detail.user.lastSignInAt), { addSuffix: true })
                            : "—"
                        }
                      />
                    </div>

                    {/* Credits */}
                    {detail.credits && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold">Credits & Abonnement</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => setCreditsDialogOpen(true)}
                          >
                            <Zap className="size-3 h-3 mr-1" />
                            Overschrijven
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {(["remaining", "total", "plan"] as const).map((k) => {
                            const raw = detail.credits?.[k];
                            const display =
                              raw === -1 ? "∞ (Pro)"
                              : typeof raw === "number" && raw > 9999 ? `${(raw / 1000).toFixed(0)}k ⚠️`
                              : String(raw ?? "—");
                            return (
                              <div key={k} className="rounded-lg border bg-muted/30 px-3 py-2">
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{k}</p>
                                <p className="text-sm font-semibold mt-0.5">{display}</p>
                              </div>
                            );
                          })}
                        </div>
                        {/* Credit cost explanation */}
                        <div className="rounded-lg border border-dashed bg-muted/10 px-3 py-2 text-[10px] text-muted-foreground space-y-0.5">
                          <p className="font-semibold text-foreground/70 mb-1">Kosten per generatie</p>
                          <p>Lite (DeepSeek): 1 credit kort · 2 medium · 3 lang · 4 zeer lang</p>
                          <p>Premium (Claude Sonnet): 2 · 3 · 4 · 5 credits</p>
                          <p className="mt-1 opacity-70">Lang = prompt &gt;1500 tekens · Zeer lang &gt;8000 tekens</p>
                        </div>
                      </div>
                    )}

                    {/* Projects */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="size-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">
                          Projecten ({detail.projects.length})
                        </p>
                      </div>
                      {detail.projects.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Geen projecten gevonden.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {detail.projects.map((proj) => (
                            <li
                              key={proj.id}
                              className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{proj.name}</p>
                                {proj.updatedAt && (
                                  <p className="text-[11px] text-muted-foreground">
                                    Bijgewerkt {formatDistanceToNow(new Date(proj.updatedAt), { addSuffix: true })}
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <a
                                  href={`/project/${proj.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Button variant="ghost" size="icon-xs" title="Open project">
                                    <ExternalLink className="size-3.5" />
                                  </Button>
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  title="Verwijder project"
                                  onClick={() =>
                                    setDeleteTarget({
                                      userId: detail.user.id,
                                      projectId: proj.id,
                                      name: proj.name,
                                    })
                                  }
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="analytics" className="mt-0">
                    {analyticsLoading ? (
                      <div className="space-y-4 pt-4">
                        <Skeleton className="h-32 w-full" />
                        <div className="grid grid-cols-2 gap-4">
                          <Skeleton className="h-40 w-full" />
                          <Skeleton className="h-40 w-full" />
                        </div>
                      </div>
                    ) : analytics ? (
                      <div className="space-y-6 pt-2">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3 border rounded-lg bg-card">
                            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Totaal Generaties</p>
                            <p className="text-xl font-bold">{analytics.totalGenerations}</p>
                          </div>
                          <div className="p-3 border rounded-lg bg-card">
                            <p className="text-[10px] uppercase text-muted-foreground font-medium mb-1">Credits Verbruikt</p>
                            <p className="text-xl font-bold">{analytics.creditsUsed} / {analytics.creditsTotal}</p>
                          </div>
                        </div>

                        <ModelBreakdownCard 
                          modelBreakdown={analytics.modelBreakdown}
                          totalGenerations={analytics.totalGenerations}
                        />

                        <CreditsChart 
                          creditsUsed={analytics.creditsUsed}
                          creditsTotal={analytics.creditsTotal}
                          plan={analytics.plan as any}
                          periodEnd={analytics.periodEnd}
                        />
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <BarChart3 className="size-10 text-muted-foreground/20 mx-auto mb-3" />
                        <p className="text-sm text-muted-foreground">Geen verbruiksgegevens beschikbaar.</p>
                      </div>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit User Data Dialog */}
      <Dialog open={editUserDialogOpen} onOpenChange={setEditUserDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Gebruikersgegevens wijzigen</DialogTitle>
            <DialogDescription>
              Wijzig de basisgegevens van deze gebruiker in Clerk.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase">Voornaam</label>
                <Input
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  placeholder="e.g. John"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase">Achternaam</label>
                <Input
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  placeholder="e.g. Doe"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">Rol</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase">Abonnement</label>
              <select
                value={editPlan}
                onChange={(e) => setEditPlan(e.target.value)}
                className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditUserDialogOpen(false)}>Annuleren</Button>
            <Button disabled={editSaving} onClick={saveUserData}>
              {editSaving ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credits override dialog */}
      <Dialog open={creditsDialogOpen} onOpenChange={setCreditsDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Override Credits</DialogTitle>
            <DialogDescription>
              Manually set this user&apos;s credit balance and plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Remaining credits</label>
              <Input
                type="number"
                value={creditsRemaining}
                onChange={(e) => setCreditsRemaining(e.target.value)}
                placeholder="e.g. 100"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Total credits</label>
              <Input
                type="number"
                value={creditsTotal}
                onChange={(e) => setCreditsTotal(e.target.value)}
                placeholder="e.g. 200"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Plan</label>
              <Input
                value={creditsPlan}
                onChange={(e) => setCreditsPlan(e.target.value)}
                placeholder="free / pro"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setCreditsDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={creditsSaving} onClick={saveCredits}>
              {creditsSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete project confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.name}&rdquo; and all its files. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteLoading}
              onClick={confirmDeleteProject}
            >
              {deleteLoading ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "pro") {
    return (
      <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/20 hover:bg-amber-500/15 text-[10px] px-1.5">
        Pro
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground">
      Free
    </Badge>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
