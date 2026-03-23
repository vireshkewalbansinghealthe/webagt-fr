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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

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

const WEBSHOP_TEMPLATES = [
  { value: "none", label: "Blank (AI Generated)" },
  { value: "modern-electronics", label: "Modern Electronics" },
  { value: "minimalist-fashion", label: "Minimalist Fashion" },
  { value: "cozy-furniture", label: "Cozy Furniture" },
  { value: "luxury-watches", label: "Luxury Watches" },
] as const;

/**
 * Data submitted when the user creates a new project.
 */
export interface CreateProjectData {
  name: string;
  model: string;
  description: string;
  type: "website" | "webshop";
  template?: string;
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
  onSubmit: (data: CreateProjectData) => void;
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
  const [name, setName] = useState("");
  const [model, setModel] = useState<string>(AI_MODELS[0].value);
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"website" | "webshop">("website");
  const [template, setTemplate] = useState<string>(WEBSHOP_TEMPLATES[0].value);

  /**
   * Handles form submission. Validates name, calls onSubmit, and resets form.
   */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return;

    let finalDescription = description.trim();
    
    // Append template instruction if webshop and template is selected
    if (type === "webshop" && template !== "none") {
      const selectedTemplate = WEBSHOP_TEMPLATES.find(t => t.value === template)?.label;
      finalDescription += finalDescription 
        ? `\n\nAdditionally, please base the design and styling on a "${selectedTemplate}" template.`
        : `Please base the design and styling on a "${selectedTemplate}" template.`;
    }

    onSubmit({ 
      name: trimmedName, 
      model, 
      description: finalDescription, 
      type,
      template: type === "webshop" ? template : undefined 
    });

    // Reset form state after submission
    setName("");
    setModel(AI_MODELS[0].value);
    setDescription("");
    setType("website");
    setTemplate(WEBSHOP_TEMPLATES[0].value);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Give your project a name and describe what you want to build.
            Your description will be sent as the first AI prompt.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project name */}
          <div className="space-y-2">
            <label htmlFor="project-name" className="text-sm font-medium">
              Project Name
            </label>
            <Input
              id="project-name"
              placeholder="My awesome app"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>

          {/* AI model selection */}
          <div className="space-y-2">
            <label htmlFor="ai-model" className="text-sm font-medium">
              AI Model
            </label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger id="ai-model">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {AI_MODELS.map((aiModel) => (
                  <SelectItem key={aiModel.value} value={aiModel.value}>
                    {aiModel.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description — sent as the first AI prompt */}
          <div className="space-y-2">
            <label htmlFor="project-description" className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id="project-description"
              placeholder="Describe the app you want to build, e.g. 'A todo app with categories and dark mode'"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>

          {/* Project Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Type</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setType("website")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all",
                  type === "website"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Globe className={cn("size-6", type === "website" ? "text-primary" : "text-muted-foreground")} />
                <div className="text-sm font-medium">Website</div>
              </button>
              <button
                type="button"
                onClick={() => setType("webshop")}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-all",
                  type === "webshop"
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                    : "border-border hover:border-primary/50"
                )}
              >
                <ShoppingBag className={cn("size-6", type === "webshop" ? "text-primary" : "text-muted-foreground")} />
                <div className="text-sm font-medium">Webshop</div>
              </button>
            </div>
            {type === "webshop" && (
              <div className="mt-4 space-y-2 border-t pt-4">
                <label htmlFor="webshop-template" className="text-sm font-medium">
                  Webshop Template
                </label>
                <Select value={template} onValueChange={setTemplate}>
                  <SelectTrigger id="webshop-template">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {WEBSHOP_TEMPLATES.map((tmpl) => (
                      <SelectItem key={tmpl.value} value={tmpl.value}>
                        {tmpl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  A fully functional webshop will be provisioned with a dedicated Turso database and ready-to-use API routes.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !description.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
