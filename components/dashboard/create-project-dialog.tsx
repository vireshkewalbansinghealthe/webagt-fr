/**
 * components/dashboard/create-project-dialog.tsx
 *
 * Dialog for creating a new project. Collects:
 * - Project name (required, min 1 character)
 * - AI model selection (dropdown with all supported models)
 * - Description (required — sent as the first AI prompt)
 *
 * On submit, calls the provided onSubmit callback with the form data.
 * The dialog is controlled via open/onOpenChange props from the parent.
 *
 * Used by: app/(app)/dashboard/page.tsx
 */

"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Globe, Loader2, Search, ShoppingBag, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { AVAILABLE_TEMPLATES, TemplatePicker } from "./template-picker";

/**
 * Available AI models for project generation.
 * Each entry has a machine-readable value and a human-readable label.
 */
const AI_MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gemini-2-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2-pro", label: "Gemini 2.0 Pro" },
  { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { value: "deepseek-v3", label: "DeepSeek V3" },
  { value: "deepseek-r1", label: "DeepSeek R1" },
] as const;

/**
 * Data submitted when the user creates a new project.
 */
export interface CreateProjectData {
  name: string;
  model: string;
  description: string;
  type: "website" | "webshop";
  templateId?: string;
  ownerNotificationEmail?: string;
}

/**
 * Props for the CreateProjectDialog component.
 *
 * @property open - Whether the dialog is currently visible
 * @property onOpenChange - Callback to toggle dialog visibility
 * @property onSubmit - Callback with form data when the user clicks "Create"
 */
export interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateProjectData) => Promise<void>;
}

/**
 * CreateProjectDialog renders a modal form for creating a new project.
 * Validates that the project name is non-empty before allowing submission.
 */
export function CreateProjectDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateProjectDialogProps) {
  const { user } = useUser();
  const [name, setName] = useState("");
  const [model, setModel] = useState<string>(AI_MODELS[0].value);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"website" | "webshop" | null>(null);
  const [templateId, setTemplateId] = useState<string>("blank-ai");
  const [templateBrowserOpen, setTemplateBrowserOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(false);

  function resetForm() {
    setName("");
    setModel(AI_MODELS[0].value);
    setDescription("");
    setType(null);
    setTemplateId("blank-ai");
    setTemplateBrowserOpen(false);
    setTemplateSearch("");
    setTemplateCategory("all");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName || !type) return;

    const resolvedTemplateId = type === "webshop" ? templateId : undefined;
    const isUsingTemplate = resolvedTemplateId && resolvedTemplateId !== "blank-ai";

    // For AI-generated projects, description is required
    if (!isUsingTemplate && !description.trim()) return;

    setIsLoading(true);
    try {
      const accountEmail =
        user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ||
        user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase() ||
        undefined;

      await onSubmit({
        name: trimmedName,
        model,
        description: description.trim() || (isUsingTemplate ? `Remix of ${resolvedTemplateId} template` : ""),
        type: type as "website" | "webshop",
        templateId: resolvedTemplateId,
        ownerNotificationEmail: type === "webshop" ? accountEmail : undefined,
      });
      resetForm();
    } catch {
      // Parent already shows an error toast — just re-enable the form
    } finally {
      setIsLoading(false);
    }
  }

  const isUsingTemplate = type === "webshop" && templateId !== "blank-ai";
  const canSubmit = name.trim() && type && (isUsingTemplate || description.trim());
  const templateCategories = [
    "all",
    ...Array.from(
      new Set(
        AVAILABLE_TEMPLATES
          .filter((tpl) => tpl.id !== "blank-ai")
          .map((tpl) => tpl.category),
      ),
    ),
  ];
  const filteredTemplates = AVAILABLE_TEMPLATES.filter((tpl) => {
    if (tpl.id === "blank-ai") return false;
    if (templateCategory !== "all" && tpl.category !== templateCategory) return false;
    if (!templateSearch.trim()) {
      return true;
    }
    const q = templateSearch.trim().toLowerCase();
    return (
      tpl.name.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
  const shouldUseExpandedTemplateBrowser = type === "webshop" && templateBrowserOpen;


  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isLoading) onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          "p-0 gap-0 overflow-hidden",
          // Mobile: full-screen sheet
          "max-sm:top-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:w-screen max-sm:h-[100dvh] max-sm:max-w-none max-sm:rounded-none max-sm:border-0",
          // Desktop: modal sizing
          shouldUseExpandedTemplateBrowser
            ? "sm:max-w-[1040px] sm:h-[88vh] sm:max-h-[88vh]"
            : "sm:max-w-[620px] sm:max-h-[90vh] sm:w-[95vw]",
        )}
      >
        <form
          onSubmit={handleSubmit}
          className={cn(
            "flex flex-col h-full",
            shouldUseExpandedTemplateBrowser ? "sm:max-h-[88vh]" : "sm:max-h-[90vh]",
          )}
        >
          {/* ── Header ── */}
          <DialogHeader className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 shrink-0">
            <DialogTitle className="text-xl font-semibold">New Project</DialogTitle>
            <p className="text-sm text-muted-foreground">
              What are you building today?
            </p>
          </DialogHeader>

          <Separator />

          {/* ── Body ── */}
          <div className={cn(
            "flex flex-1 min-h-0 overflow-hidden",
            shouldUseExpandedTemplateBrowser ? "sm:flex-row flex-col" : "",
          )}>

            {/* ── LEFT — project settings ── */}
            <div
              className={cn(
                "flex flex-col gap-5 px-5 sm:px-6 py-5 overflow-y-auto",
                shouldUseExpandedTemplateBrowser
                  ? "sm:w-[330px] sm:border-r sm:border-border sm:shrink-0 sm:flex-none"
                  : "flex-1",
                shouldUseExpandedTemplateBrowser ? "max-sm:shrink-0" : "",
              )}
            >

              {/* ── Type cards — first & most prominent ── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Type
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    {
                      t: "website" as const,
                      icon: Globe,
                      label: "Website",
                      sub: "Landing pages, web apps & more",
                    },
                    {
                      t: "webshop" as const,
                      icon: ShoppingBag,
                      label: "Webshop",
                      sub: "With payments, orders & products",
                    },
                  ]).map(({ t, icon: Icon, label, sub }) => {
                    const selected = type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setType(t);
                          if (t !== "webshop") setTemplateBrowserOpen(false);
                        }}
                        disabled={isLoading}
                        className="flex flex-col items-start gap-2 px-4 py-4 rounded-xl border border-border text-left disabled:pointer-events-none disabled:opacity-50 hover:border-primary/40 transition-colors"
                        style={selected ? { animation: "rainbow-outline 3s linear infinite", outline: "2px solid #a855f7", outlineOffset: "2px" } : undefined}
                      >
                        <div className={cn(
                          "flex size-9 items-center justify-center rounded-lg",
                          selected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold leading-tight text-foreground">{label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <style>{`
                  @property --angle {
                    syntax: "<angle>";
                    initial-value: 0deg;
                    inherits: false;
                  }
                  @keyframes ai-border-spin {
                    to { --angle: 360deg; }
                  }
                  @keyframes rainbow-outline {
                    0%,100% { outline-color: #a855f7; }
                    20%     { outline-color: #06b6d4; }
                    40%     { outline-color: #ec4899; }
                    60%     { outline-color: #f59e0b; }
                    80%     { outline-color: #22c55e; }
                  }
                `}</style>

                {/* Template picker (webshop only) */}
                {type === "webshop" && !shouldUseExpandedTemplateBrowser && (
                  <div className="rounded-xl border bg-muted/10 p-3 mt-1 space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">Start from</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { setTemplateId("blank-ai"); setTemplateBrowserOpen(false); }}
                        disabled={isLoading}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:pointer-events-none disabled:opacity-50",
                          templateId === "blank-ai"
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                        )}
                      >
                        ✦ AI Prompt
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplateBrowserOpen(true)}
                        disabled={isLoading}
                        className={cn(
                          "px-3 py-2 rounded-lg text-sm font-medium border transition-colors disabled:pointer-events-none disabled:opacity-50",
                          templateId !== "blank-ai"
                            ? "bg-primary/10 text-primary border-primary/30"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
                        )}
                      >
                        📦 Template
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Project name ── */}
              <div className="space-y-1.5">
                <label htmlFor="project-name" className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                  Project name
                </label>
                <Input
                  id="project-name"
                  placeholder="My awesome app"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  disabled={isLoading}
                  className="h-10"
                />
              </div>

              {/* ── Description / AI prompt ── */}
              {!isUsingTemplate && (
                <div className="space-y-1.5 flex-1">
                  <label htmlFor="project-description" className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                      Describe your idea
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground/50">
                      <Sparkles className="size-3" />
                      First AI prompt
                    </span>
                  </label>
                  <Textarea
                    id="project-description"
                    placeholder={
                      type === "webshop"
                        ? "e.g. A minimalist sneaker shop with dark theme, product listings and Stripe checkout…"
                        : "e.g. A SaaS landing page for a project management tool with a hero, pricing table and FAQ…"
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={shouldUseExpandedTemplateBrowser ? 8 : 5}
                    disabled={isLoading}
                    className={cn(
                      "resize-none overflow-y-auto text-sm",
                      shouldUseExpandedTemplateBrowser ? "min-h-[168px] max-h-[300px]" : "min-h-[120px] max-h-[200px]",
                    )}
                  />
                </div>
              )}
            </div>

            {/* ── TEMPLATE BROWSER — right side on desktop, full expansion on mobile ── */}
            {shouldUseExpandedTemplateBrowser && (
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden border-t border-border sm:border-t-0">
              <div className="px-4 sm:px-5 py-3 shrink-0 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Choose a template
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
                  <div className="h-full min-h-0 flex flex-col gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        onClick={() => setTemplateBrowserOpen(false)}
                        disabled={isLoading}
                      >
                        <ArrowLeft className="size-4" />
                        Back
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTemplateId("blank-ai");
                          setTemplateBrowserOpen(false);
                        }}
                        disabled={isLoading}
                      >
                        Start from scratch
                      </Button>
                      <div className="relative flex-1 min-w-[140px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                        <Input
                          value={templateSearch}
                          onChange={(e) => setTemplateSearch(e.target.value)}
                          placeholder="Search templates..."
                          className="pl-9"
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {templateCategories.map((category) => (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setTemplateCategory(category)}
                          disabled={isLoading}
                          className={cn(
                            "whitespace-nowrap px-3 py-1.5 rounded-md border text-xs transition-colors disabled:pointer-events-none disabled:opacity-50",
                            templateCategory === category
                              ? "bg-primary/10 text-primary border-primary/40"
                              : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                          )}
                        >
                          {category === "all" ? "All sectors" : category}
                        </button>
                      ))}
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                      <TemplatePicker
                        value={templateId}
                        onChange={setTemplateId}
                        templates={filteredTemplates}
                        variant="visual"
                        className="max-h-full overflow-y-auto pr-1"
                      />
                    </div>
                  </div>
              </div>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Footer ── */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 shrink-0">
            <p className="text-xs text-muted-foreground hidden sm:block">
              {isUsingTemplate
                ? "Template files load instantly — no wait."
                : "AI generation starts after you click create."}
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canSubmit || isLoading}
                className="flex-1 sm:flex-none sm:min-w-[120px]"
                style={isLoading ? { animation: "rainbow-outline 1.5s linear infinite", outline: "2px solid #a855f7", outlineOffset: "2px" } : undefined}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {isUsingTemplate ? "Remixing…" : "Creating…"}
                  </>
                ) : isUsingTemplate ? (
                  "Remix template"
                ) : (
                  "Create project"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
