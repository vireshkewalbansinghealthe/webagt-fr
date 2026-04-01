"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  User, 
  Bug, 
  Lightbulb, 
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  Hash,
  Image
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminTestingDashboard() {
  const { getToken } = useAuth();
  const [data, setData] = useState<{ submissions: any[]; feedback: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSubmission, setExpandedSubmission] = useState<string | null>(null);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const client = createApiClient(getToken);
      const results = await client.testing.getAdminResults();
      setData(results);
    } catch (e) {
      toast.error("Fout bij het ophalen van testresultaten");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const updateStatus = async (id: string, status: string) => {
    try {
      const client = createApiClient(getToken);
      await client.testing.updateFeedbackStatus(id, status);
      toast.success("Status bijgewerkt");
      fetchResults(); // refresh
    } catch (e) {
      toast.error("Fout bij het bijwerken van status");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Testen & Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Beheer publieke testrapporten en meldingen.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchResults} disabled={loading}>
          <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
          Vernieuwen
        </Button>
      </div>

      <Tabs defaultValue="submissions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="submissions" className="gap-2">
            <ClipboardList className="size-4" />
            Testrapporten
            {data?.submissions && data.submissions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[20px] justify-center">
                {data.submissions.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <Bug className="size-4" />
            Losse Meldingen
            {data?.feedback && data.feedback.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[20px] justify-center">
                {data.feedback.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="submissions">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Card key={i} className="h-24 animate-pulse bg-muted/50" />)}
            </div>
          ) : !data?.submissions || data.submissions.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <ClipboardList className="size-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Nog geen testrapporten ontvangen.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.submissions.map((sub) => (
                <Card key={sub.id} className="overflow-hidden">
                  <div 
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedSubmission(expandedSubmission === sub.id ? null : sub.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="size-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{sub.userName}</p>
                        <p className="text-xs text-muted-foreground">{sub.userEmail}</p>
                        {sub.testNumber && (
                          <p className="text-[10px] text-muted-foreground/60 font-mono flex items-center gap-1 mt-0.5">
                            <Hash className="size-2.5" />{sub.testNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right hidden sm:block">
                        <div className="flex gap-1.5">
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            {sub.results.filter((r: any) => r.status === "working").length} Werkt
                          </Badge>
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20">
                            {sub.results.filter((r: any) => r.status === "not_working").length} Fout
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-end gap-1">
                          <Clock className="size-3" />
                          {formatDistanceToNow(new Date(sub.submittedAt), { addSuffix: true })}
                        </p>
                      </div>
                      {expandedSubmission === sub.id ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </div>
                  </div>

                  {expandedSubmission === sub.id && (
                    <CardContent className="p-0 border-t">
                      <div className="divide-y divide-border">
                        {sub.results.map((res: any, idx: number) => (
                          <div key={idx} className="p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-tight">{res.category}</span>
                                <span className="text-sm font-medium">{res.testCase}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {res.status === "working" ? (
                                  <Badge className="bg-emerald-500 hover:bg-emerald-500">Werkt</Badge>
                                ) : res.status === "not_working" ? (
                                  <Badge variant="destructive">Fout</Badge>
                                ) : (
                                  <Badge variant="secondary">Overgeslagen</Badge>
                                )}
                              </div>
                            </div>
                            {res.bugReport && (
                              <div className="mt-1 p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 text-xs italic">
                                <p className="font-bold text-rose-600 mb-1 flex items-center gap-1">
                                  <Bug className="size-3" /> Bug Report:
                                </p>
                                {res.bugReport}
                              </div>
                            )}
                            {res.screenshot && (
                              <div className="mt-2">
                                <img
                                  src={res.screenshot}
                                  alt="Screenshot"
                                  className="max-h-60 rounded-lg border border-border object-contain cursor-pointer hover:opacity-90"
                                  onClick={(e) => { e.stopPropagation(); window.open(res.screenshot, "_blank"); }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="feedback">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Card key={i} className="h-32 animate-pulse bg-muted/50" />)}
            </div>
          ) : !data?.feedback || data.feedback.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Bug className="size-12 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground">Nog geen losse meldingen ontvangen.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.feedback.map((f) => (
                <Card key={f.id} className={cn(
                  "flex flex-col h-full border-l-4",
                  f.type === "bug" ? "border-l-rose-500" : "border-l-amber-500"
                )}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {f.type === "bug" ? (
                          <div className="size-7 rounded-full bg-rose-500/10 flex items-center justify-center">
                            <Bug className="size-4 text-rose-600" />
                          </div>
                        ) : (
                          <div className="size-7 rounded-full bg-amber-500/10 flex items-center justify-center">
                            <Lightbulb className="size-4 text-amber-600" />
                          </div>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {f.type === "bug" ? "BUG" : "VERBETERING"}
                        </Badge>
                      </div>
                      <select 
                        value={f.status}
                        onChange={(e) => updateStatus(f.id, e.target.value)}
                        className="text-[10px] bg-muted border rounded px-1.5 py-0.5 font-medium outline-none"
                      >
                        <option value="pending">Pending</option>
                        <option value="planned">In Planning</option>
                        <option value="fixed">Gefixed</option>
                        <option value="wont_fix">Niet oplossen</option>
                      </select>
                    </div>
                    <CardTitle className="text-sm font-medium leading-relaxed italic border-l-2 pl-3 border-muted-foreground/20 py-1">
                      &quot;{f.content}&quot;
                    </CardTitle>
                    {f.screenshot && (
                      <div className="mt-3">
                        <img
                          src={f.screenshot}
                          alt="Screenshot"
                          className="max-h-48 rounded-lg border border-border object-contain cursor-pointer hover:opacity-90 w-full"
                          onClick={() => window.open(f.screenshot, "_blank")}
                        />
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 pb-3">
                    <div className="flex items-center gap-3 mt-4">
                      <div className="size-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                        {f.userName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{f.userName}</p>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Calendar className="size-2.5" />
                          {format(new Date(f.submittedAt), "dd-MM-yyyy HH:mm")}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  {f.status === "fixed" && (
                    <div className="px-4 py-2 bg-emerald-500/5 border-t border-emerald-500/10 flex items-center gap-2">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-tight">Opgelost</span>
                      {f.fixedAt && (
                        <span className="text-[10px] text-emerald-600/60 ml-auto">
                          {format(new Date(f.fixedAt), "dd-MM")}
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
