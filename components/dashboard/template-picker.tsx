"use client";

import { useState } from "react";
import { ExternalLink, Check, Sparkles, Tag, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  previewUrl: string;
  thumbnailUrl: string;
  features: string[];
  isNew?: boolean;
}

export const AVAILABLE_TEMPLATES: TemplateDefinition[] = [
  {
    id: "blank-ai",
    name: "Start from scratch",
    description:
      "No template - describe your shop and let the AI generate everything from your prompt.",
    category: "AI Generated",
    tags: ["Custom", "AI", "Flexible"],
    previewUrl: "",
    thumbnailUrl: "",
    features: [
      "Fully AI-generated layout",
      "Any style, any niche",
      "You describe it, AI builds it",
    ],
  },
  {
    id: "pardole_parfum_vite",
    name: "Koning Parfum (Vite)",
    description:
      "Luxury parfum storefront template with category routing, cart drawer, reviews, newsletter, and popup flows.",
    category: "Fashion & Luxury",
    tags: ["Fragrance", "Luxury", "Vite", "Cart", "React Router"],
    previewUrl: "https://pardole-064724.dock.4esh.nl",
    thumbnailUrl:
      "https://image.thum.io/get/width/1200/noanimate/https://pardole-064724.dock.4esh.nl",
    features: [
      "Full product catalogue with filters",
      "Category pages (Dames, Heren, Unisex, Niche…)",
      "Product detail page with scent notes",
      "Slide-out cart drawer",
      "2+1 free promotion logic",
      "Newsletter + exit-intent popup",
      "Customer reviews carousel",
      "Store locator section",
      "Responsive header & footer",
    ],
    isNew: true,
  },
];

export interface TemplatePickerProps {
  value: string;
  onChange: (templateId: string) => void;
  templates?: TemplateDefinition[];
  className?: string;
  variant?: "default" | "visual";
}

export function TemplatePicker({
  value,
  onChange,
  templates = AVAILABLE_TEMPLATES,
  className,
  variant = "default",
}: TemplatePickerProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const isVisualVariant = variant === "visual";

  return (
    <div className={cn(isVisualVariant ? "grid grid-cols-2 gap-3" : "space-y-1.5", className)}>
      {templates.map((tpl) => {
        const isSelected = value === tpl.id;
        const isBlank = tpl.id === "blank-ai";
        const isHovered = hovered === tpl.id;

        return (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onChange(tpl.id)}
            onMouseEnter={() => setHovered(tpl.id)}
            onMouseLeave={() => setHovered(null)}
            className={cn(
              "w-full text-left rounded-lg border transition-all duration-200 overflow-hidden",
              isSelected
                ? "border-primary ring-1 ring-primary/20"
                : "border-border hover:border-primary/40"
            )}
          >
            {/* ── Thumbnail ── */}
            {!isBlank ? (
              <div
                className="relative w-full overflow-hidden bg-muted"
                style={{ height: isVisualVariant ? 168 : 104 }}
              >
                {tpl.previewUrl ? (
                  <div className="w-full h-full overflow-hidden">
                    <iframe
                      src={tpl.previewUrl}
                      title={`${tpl.name} preview`}
                      loading="lazy"
                      className={cn(
                        "w-full h-full border-0 pointer-events-none transition-transform duration-500",
                        isHovered ? "scale-[1.03]" : "scale-100",
                      )}
                    />
                  </div>
                ) : tpl.thumbnailUrl ? (
                  <img
                    src={tpl.thumbnailUrl}
                    alt={tpl.name}
                    className={cn(
                      "w-full h-full object-cover transition-transform duration-500",
                      isHovered ? "scale-105" : "scale-100",
                    )}
                    loading="lazy"
                  />
                ) : (
                  <div
                    className={cn(
                      "w-full h-full flex items-center justify-center px-4 text-center transition-colors",
                      isSelected ? "bg-primary/8" : "bg-muted"
                    )}
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold leading-tight">{tpl.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Template preview
                      </p>
                    </div>
                  </div>
                )}
                {/* Dark overlay on hover */}
                <div
                  className={cn(
                    "absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-200",
                    isHovered ? "opacity-100" : "opacity-0"
                  )}
                >
                  {tpl.previewUrl && (
                    <a
                      href={tpl.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-black text-xs font-semibold shadow-lg hover:bg-white/90 transition-colors"
                    >
                      <Eye className="size-3.5" />
                      Open preview
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>

                {/* Selected badge overlay */}
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 size-6 rounded-full bg-primary flex items-center justify-center shadow">
                    <Check className="size-3.5 text-primary-foreground" />
                  </div>
                )}

                {/* New badge */}
                {tpl.isNew && (
                  <div className="absolute top-2.5 left-2.5">
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-emerald-500 text-white border-0 shadow"
                    >
                      New
                    </Badge>
                  </div>
                )}
              </div>
            ) : (
              /* Blank template placeholder */
              <div
                className={cn(
                  "relative w-full flex items-center justify-center transition-colors duration-200",
                  isSelected ? "bg-primary/8" : "bg-muted/60 hover:bg-muted"
                )}
                style={{ height: isVisualVariant ? 168 : 76 }}
              >
                <Sparkles
                  className={cn(
                    "size-7 transition-colors",
                    isSelected ? "text-primary/60" : "text-muted-foreground/40"
                  )}
                />
                {isSelected && (
                  <div className="absolute top-2.5 right-2.5 size-6 rounded-full bg-primary flex items-center justify-center shadow">
                    <Check className="size-3.5 text-primary-foreground" />
                  </div>
                )}
              </div>
            )}

            {isVisualVariant && !isBlank && (
              <div className="px-2.5 py-2 text-xs font-medium truncate">
                {tpl.name}
              </div>
            )}

            {!isVisualVariant && (
              <>
                {/* ── Card body ── */}
                <div
                  className={cn(
                    "px-3 py-2.5 transition-colors",
                    isSelected ? "bg-primary/5" : "bg-background"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold leading-tight">{tpl.name}</span>
                    <span className="text-[10px] text-muted-foreground">{tpl.category}</span>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed mb-2 line-clamp-2">
                    {tpl.description}
                  </p>

                  <div className="flex items-center gap-1 flex-wrap">
                    {tpl.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                      >
                        <Tag className="size-2.5" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* ── Feature list when selected ── */}
                {isSelected && !isBlank && (
                  <div className="border-t border-border/60 bg-muted/40 px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      Included
                    </p>
                    <div className="grid grid-cols-2 gap-x-2.5 gap-y-1">
                      {tpl.features.slice(0, 6).map((f) => (
                        <div key={f} className="flex items-start gap-1.5">
                          <Check className="size-3 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-[11px] text-muted-foreground leading-tight">{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
