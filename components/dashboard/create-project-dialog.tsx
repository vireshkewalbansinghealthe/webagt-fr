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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Globe, Loader2, Search, ShoppingBag, Wand2 } from "lucide-react";
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
          "w-[95vw] p-0 gap-0 overflow-hidden",
          shouldUseExpandedTemplateBrowser
            ? "sm:max-w-[1040px] h-[88vh] max-h-[88vh]"
            : "sm:max-w-[620px]",
        )}
      >
        <form
          onSubmit={handleSubmit}
          className={cn(
            "flex flex-col h-full",
            shouldUseExpandedTemplateBrowser ? "max-h-[88vh]" : "",
          )}
        >
          {/* ── Header ── */}
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle className="text-xl">New Project</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Configure your project, pick a type, and optionally start from a template.
            </p>
          </DialogHeader>

          <Separator />

          {/* ── Body ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* ── LEFT — project settings ── */}
            <div
              className={cn(
                "shrink-0 flex flex-col gap-5 px-6 py-5 overflow-y-auto",
                shouldUseExpandedTemplateBrowser ? "w-[330px] border-r border-border" : "w-full",
              )}
            >

              {/* Project name */}
              <div className="space-y-1.5">
                <label htmlFor="project-name" className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">1</span>
                  Project Name
                </label>
                <Input
                  id="project-name"
                  placeholder="My awesome app"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  disabled={isLoading}
                />
              </div>

              {/* Project type */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">2</span>
                  Project Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["website", "webshop"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setType(t);
                        if (t !== "webshop") {
                          setTemplateBrowserOpen(false);
                        }
                      }}
                      disabled={isLoading}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
                        type === t
                          ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {t === "website" ? (
                        <Globe className="size-4 shrink-0" />
                      ) : (
                        <ShoppingBag className="size-4 shrink-0" />
                      )}
                      {t === "website" ? "Website" : "Webshop"}
                    </button>
                  ))}
                </div>
                {type === "webshop" && !shouldUseExpandedTemplateBrowser && (
                  <div className="rounded-lg border bg-muted/20 p-2.5 mt-2 space-y-2">
                    <p className="text-sm font-medium">Template</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTemplateId("blank-ai");
                          setTemplateBrowserOpen(false);
                        }}
                        disabled={isLoading}
                        className={cn(
                          "px-3 py-2 rounded-md text-sm font-medium border transition-colors disabled:pointer-events-none disabled:opacity-50",
                          templateId === "blank-ai"
                            ? "bg-primary/10 text-primary border-primary/40"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                        )}
                      >
                        Start from scratch
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplateBrowserOpen(true)}
                        disabled={isLoading}
                        className={cn(
                          "px-3 py-2 rounded-md text-sm font-medium border transition-colors disabled:pointer-events-none disabled:opacity-50",
                          templateId !== "blank-ai"
                            ? "bg-primary/10 text-primary border-primary/40"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
                        )}
                      >
                        Choose template
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Description (hidden when remixing from a template) */}
              {!isUsingTemplate && (
                <div className="space-y-1.5 flex-1">
                  <label htmlFor="project-description" className="flex items-center gap-2 text-sm font-medium">
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">3</span>
                    <Wand2 className="size-3.5 text-muted-foreground" />
                    Description
                  </label>
                  <Textarea
                    id="project-description"
                    placeholder="Describe what you want to build — this is sent as the first AI prompt."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={shouldUseExpandedTemplateBrowser ? 8 : 5}
                    disabled={isLoading}
                    className={cn(
                      "resize-none",
                      shouldUseExpandedTemplateBrowser ? "min-h-[168px]" : "min-h-[132px]",
                    )}
                  />
                </div>
              )}

              {/* AI model */}
              <div className="space-y-1.5">
                <label htmlFor="ai-model" className="flex items-center gap-2 text-sm font-medium">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground shrink-0">{isUsingTemplate ? "3" : "4"}</span>
                  AI Model
                </label>
                <Select value={model} onValueChange={setModel} disabled={isLoading}>
                  <SelectTrigger id="ai-model" className="w-full">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── RIGHT — template picker (expanded mode only) ── */}
            {shouldUseExpandedTemplateBrowser && (
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <div className="px-5 py-3 shrink-0 border-b border-border bg-muted/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Choose a template
                </p>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                  <div className="h-full min-h-0 flex flex-col gap-2.5">
                    <div className="flex items-center gap-2">
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
                      <div className="relative">
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

                    <div className="min-h-0 overflow-hidden">
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
          <div className="flex items-center justify-between px-6 py-4 shrink-0">
            <p className="text-xs text-muted-foreground">
              {isUsingTemplate
                ? "Template files load instantly — no wait."
                : "AI generation starts after you click create."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canSubmit || isLoading}
                className="min-w-[120px]"
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
