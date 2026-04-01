"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { createApiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft, 
  Send, 
  Bug, 
  Lightbulb,
  ClipboardCheck,
  Loader2,
  ImagePlus,
  X,
  Hash
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Test cases derived from the provided spreadsheet.
 */
const TEST_CATEGORIES = [
  {
    id: "onboarding",
    name: "Onboarding",
    items: [
      "Gebruiker kan registreren",
      "Gebruiker kan inloggen",
      "Abonneren op Pro via iDEAL (Testmodus)",
      "Getting Started tooltip verschijnt en werkt",
      "Persoonlijke analytics laden correct",
      "Instellingen pagina is bereikbaar en functioneel"
    ]
  },
  {
    id: "create_project",
    name: "Project Creatie",
    items: [
      "Template remixen zonder errors",
      "Website genereren via prompt"
    ]
  },
  {
    id: "editor",
    name: "Workspace Editor",
    items: [
      "Website generatie voltooid zonder errors",
      "AI Agent stelt verduidelijkende vraag na prompt",
      "Autofix herstelt fouten bij genereren (indien nodig)",
      "Laadscherm van de Live Preview werkt naar behoren",
      "Shop Manager opent zonder foutmeldingen",
      "Tekst aanpassen via Visuele Editor",
      "AI Agent voert 2 wijzigingen correct uit",
      "Bijlage-functie (foto's) uploaden en tonen",
      "Responsive switch (Tablet/Mobiel) werkt"
    ]
  },
  {
    id: "shop_management",
    name: "Shop Management",
    items: [
      "Dashboard statistieken/aantallen kloppen",
      "Productenoverzicht pagina laadt",
      "Nieuw product toevoegen",
      "Bestaand product wijzigen (Naam/Prijs)",
      "Zoekfunctie voor producten",
      "Filteren van producten",
      "Kolommen toevoegen aan tabel",
      "Voorraad (Quantity) aanpassen en opslaan",
      "Shipping zones instellen en opslaan"
    ]
  },
  {
    id: "payments_deploy",
    name: "Payments & Deploy",
    items: [
      "Stripe Onboarding (Test) succesvol",
      "Schakelen tussen Test/Live modus",
      "Website succesvol online zetten (Deploy)",
      "Eigen domein koppelen (Vercel DNS check)",
      "Redepoyen om updates te pushen"
    ]
  },
  {
    id: "orders",
    name: "Bestellingen & Orders",
    items: [
      "Testorder plaatsen op live site",
      "Afrekenen via Stripe succesvol",
      "Webhook: Betaling komt binnen in dashboard",
      "Orderbevestiging mail naar admin",
      "Orderbevestiging mail naar klant",
      "Order annuleren (Cancel)",
      "Mail naar klant na annulering",
      "Order verwijderen",
      "Refund proces via Stripe koppeling"
    ]
  },
  {
    id: "misc",
    name: "Overig & Dashboard",
    items: [
      "Wijziging ongedaan maken (Restore)",
      "Notificatie pagina werkt",
      "Instellingen pagina (Shop) werkt",
      "Logs van gepubliceerde site inzien",
      "Afmelden (Logout)",
      "Bestaand project hernoemen",
      "Bestaand project verwijderen",
      "Filteren/Zoeken/Sorteren van projecten"
    ]
  },
  {
    id: "admin",
    name: "Admin Panel",
    items: [
      "Inloggen als Administrator",
      "Gebruikersoverzicht inzien",
      "Gebruikersgegevens wijzigen",
      "Abonnementenoverzicht inzien",
      "Token verbruik monitoren",
      "Logs exporteren/uitdraaien"
    ]
  }
];

type TestStatus = "working" | "not_working" | "skipped";

interface ResultState {
  [key: string]: {
    status: TestStatus;
    bugReport?: string;
    screenshot?: string; // base64 data URL
  };
}

/** Generate a unique session test number, e.g. T-20260401-A3F2 */
function generateTestNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `T-${date}-${rand}`;
}

/** Compress an image File to a small JPEG data URL */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 1200;
      const scale = img.width > maxW ? maxW / img.width : 1;
      const canvas = document.createElement("canvas");
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = reject;
    img.src = url;
  });
}

/** Drag-and-drop / click-to-upload image area */
function ImageDropZone({
  value,
  onChange,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Alleen afbeeldingen zijn toegestaan");
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      onChange(dataUrl);
    } catch {
      toast.error("Afbeelding kon niet worden geladen");
    }
  }, [onChange]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  if (value) {
    return (
      <div className="relative mt-2 inline-block">
        <img
          src={value}
          alt="Screenshot"
          className="max-h-48 rounded-lg border border-border object-contain"
        />
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-destructive text-white shadow"
        >
          <X className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mt-2 flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-3 text-center transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:border-muted-foreground/40 hover:bg-muted/50"
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <ImagePlus className="size-4 text-muted-foreground" />
      <p className="text-xs text-muted-foreground">
        Sleep een screenshot hier of <span className="text-primary underline">klik om te uploaden</span>
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export default function PublicTestingPage() {
  const { getToken } = useAuth();
  const { user } = useUser();
  
  const [testNumber] = useState<string>(() => generateTestNumber());
  const [activeTab, setActiveTab] = useState<"form" | "feedback">("form");
  const [currentCategoryIndex, setCurrentCategoryIndex] = useState(0);
  const [results, setResults] = useState<ResultState>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Feedback state
  const [feedbackType, setFeedbackType] = useState<"bug" | "improvement">("bug");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackScreenshot, setFeedbackScreenshot] = useState<string | undefined>();
  
  const currentCategory = TEST_CATEGORIES[currentCategoryIndex];
  const progress = ((currentCategoryIndex + 1) / TEST_CATEGORIES.length) * 100;

  const handleStatusChange = (testId: string, status: TestStatus) => {
    setResults(prev => ({
      ...prev,
      [testId]: { ...prev[testId], status }
    }));
  };

  const handleBugReportChange = (testId: string, bugReport: string) => {
    setResults(prev => ({
      ...prev,
      [testId]: { ...prev[testId], bugReport }
    }));
  };

  const handleScreenshotChange = (testId: string, screenshot: string | undefined) => {
    setResults(prev => ({
      ...prev,
      [testId]: { ...prev[testId], screenshot }
    }));
  };

  const nextCategory = () => {
    if (currentCategoryIndex < TEST_CATEGORIES.length - 1) {
      setCurrentCategoryIndex(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const prevCategory = () => {
    if (currentCategoryIndex > 0) {
      setCurrentCategoryIndex(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  const submitTestRun = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const client = createApiClient(getToken);
      const testResults = Object.entries(results).map(([testId, data]) => {
        let categoryName = "";
        let testCaseName = "";
        for (const cat of TEST_CATEGORIES) {
          for (const item of cat.items) {
            if (`${cat.id}:${item}` === testId) {
              categoryName = cat.name;
              testCaseName = item;
              break;
            }
          }
        }
        return {
          testId,
          category: categoryName,
          testCase: testCaseName,
          status: data.status,
          bugReport: data.bugReport,
          screenshot: data.screenshot,
        };
      });

      await client.testing.submitRun({
        testNumber,
        results: testResults,
        userName: user.fullName || user.username || "Unknown",
        userEmail: user.primaryEmailAddress?.emailAddress || "Unknown"
      });

      toast.success("Testrapport succesvol verzonden! Bedankt voor je hulp.");
      setResults({});
      setCurrentCategoryIndex(0);
    } catch {
      toast.error("Fout bij het verzenden van testrapport");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitFeedback = async () => {
    if (!user || !feedbackContent.trim()) return;
    setIsSubmitting(true);
    try {
      const client = createApiClient(getToken);
      await client.testing.submitFeedback({
        type: feedbackType,
        content: feedbackContent,
        screenshot: feedbackScreenshot,
        userName: user.fullName || user.username || "Unknown",
        userEmail: user.primaryEmailAddress?.emailAddress || "Unknown"
      });
      toast.success(feedbackType === "bug" ? "Bug gemeld! We gaan er naar kijken." : "Verbetering verzonden! Bedankt voor het meedenken.");
      setFeedbackContent("");
      setFeedbackScreenshot(undefined);
    } catch {
      toast.error("Fout bij het verzenden van feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8">
        {/* Test number badge — top left */}
        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-mono text-muted-foreground">
            <Hash className="size-3" />
            {testNumber}
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Web AGT Public Testing</h1>
          <p className="text-muted-foreground">
            Help ons het platform te verbeteren door de verschillende functies te testen.
          </p>
        </div>
      </div>

      <div className="flex justify-center mb-8">
        <div className="inline-flex p-1 bg-muted rounded-lg border">
          <button
            onClick={() => setActiveTab("form")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
              activeTab === "form" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ClipboardCheck className="size-4" />
            Volledige Test
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
              activeTab === "feedback" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Bug className="size-4" />
            Losse Melding
          </button>
        </div>
      </div>

      {activeTab === "form" ? (
        <div className="space-y-6">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Voortgang</span>
              <span>Stap {currentCategoryIndex + 1} van {TEST_CATEGORIES.length}</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-in-out" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <Card className="border-2">
            <CardHeader className="bg-muted/30">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="bg-background">{currentCategory.name}</Badge>
              </div>
              <CardTitle>{currentCategory.name}</CardTitle>
              <CardDescription>Test de volgende onderdelen in deze categorie.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {currentCategory.items.map((item) => {
                  const testId = `${currentCategory.id}:${item}`;
                  const result = results[testId] || { status: "skipped" };
                  
                  return (
                    <div key={item} className="p-6 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <p className="font-medium">{item}</p>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={result.status === "working" ? "default" : "outline"}
                            className={cn(
                              "h-8 rounded-full px-3",
                              result.status === "working" && "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                            )}
                            onClick={() => handleStatusChange(testId, "working")}
                          >
                            <CheckCircle2 className="size-3.5 mr-1.5" />
                            Werkt
                          </Button>
                          <Button
                            size="sm"
                            variant={result.status === "not_working" ? "destructive" : "outline"}
                            className={cn(
                              "h-8 rounded-full px-3",
                              result.status === "not_working" && "bg-rose-600 hover:bg-rose-700"
                            )}
                            onClick={() => handleStatusChange(testId, "not_working")}
                          >
                            <XCircle className="size-3.5 mr-1.5" />
                            Fout
                          </Button>
                          <Button
                            size="sm"
                            variant={result.status === "skipped" ? "secondary" : "ghost"}
                            className="h-8 rounded-full px-3"
                            onClick={() => handleStatusChange(testId, "skipped")}
                          >
                            Overslaan
                          </Button>
                        </div>
                      </div>

                      {result.status === "not_working" && (
                        <div className="animate-in slide-in-from-top-2 duration-200 space-y-2">
                          <Textarea
                            placeholder="Beschrijf de bug die je bent tegengekomen..."
                            className="text-sm min-h-[80px]"
                            value={result.bugReport || ""}
                            onChange={(e) => handleBugReportChange(testId, e.target.value)}
                          />
                          <ImageDropZone
                            value={result.screenshot}
                            onChange={(v) => handleScreenshotChange(testId, v)}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="flex justify-between p-6 bg-muted/10 border-t">
              <Button
                variant="outline"
                onClick={prevCategory}
                disabled={currentCategoryIndex === 0}
              >
                <ChevronLeft className="size-4 mr-2" />
                Vorige
              </Button>
              
              {currentCategoryIndex < TEST_CATEGORIES.length - 1 ? (
                <Button onClick={nextCategory}>
                  Volgende
                  <ChevronRight className="size-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  onClick={submitTestRun} 
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Send className="size-4 mr-2" />}
                  Testrapport verzenden
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      ) : (
        <Card className="border-2">
          <CardHeader>
            <CardTitle>Losse Melding maken</CardTitle>
            <CardDescription>Meld een bug of geef een suggestie voor verbetering.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Type Melding</label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setFeedbackType("bug")}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-center",
                    feedbackType === "bug" 
                      ? "border-rose-500 bg-rose-500/5 text-rose-600 dark:text-rose-400" 
                      : "border-border bg-card text-muted-foreground hover:border-border/80"
                  )}
                >
                  <Bug className={cn("size-8", feedbackType === "bug" ? "text-rose-500" : "text-muted-foreground/40")} />
                  <div>
                    <p className="font-bold text-sm">Bug Melden</p>
                    <p className="text-[11px] opacity-80">Er gaat iets fout</p>
                  </div>
                </button>
                <button
                  onClick={() => setFeedbackType("improvement")}
                  className={cn(
                    "flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all text-center",
                    feedbackType === "improvement" 
                      ? "border-amber-500 bg-amber-500/5 text-amber-600 dark:text-amber-400" 
                      : "border-border bg-card text-muted-foreground hover:border-border/80"
                  )}
                >
                  <Lightbulb className={cn("size-8", feedbackType === "improvement" ? "text-amber-500" : "text-muted-foreground/40")} />
                  <div>
                    <p className="font-bold text-sm">Verbetering</p>
                    <p className="text-[11px] opacity-80">Een goed idee of suggestie</p>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Omschrijving</label>
              <Textarea
                placeholder={feedbackType === "bug" ? "Wat gaat er precies fout?" : "Wat kunnen we verbeteren?"}
                className="min-h-[150px] text-base"
                value={feedbackContent}
                onChange={(e) => setFeedbackContent(e.target.value)}
              />
              <ImageDropZone
                value={feedbackScreenshot}
                onChange={setFeedbackScreenshot}
              />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t p-6">
            <Button 
              className="w-full h-11 text-base" 
              disabled={isSubmitting || !feedbackContent.trim()}
              onClick={submitFeedback}
            >
              {isSubmitting ? (
                <Loader2 className="size-5 mr-2 animate-spin" />
              ) : (
                <Send className="size-5 mr-2" />
              )}
              Melding verzenden
            </Button>
          </CardFooter>
        </Card>
      )}

      <div className="mt-12 p-6 rounded-2xl bg-muted/30 border border-dashed text-center">
        <AlertCircle className="size-6 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground max-w-md mx-auto italic">
          Jouw feedback is cruciaal voor de stabiliteit van Web AGT. Alle meldingen worden door ons team bekeken en verwerkt.
        </p>
      </div>
    </div>
  );
}
