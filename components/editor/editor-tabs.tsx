/**
 * components/editor/editor-tabs.tsx
 *
 * Tab switcher for the right panel of the editor.
 * Toggles between Preview (Sandpack live preview) and Code (Monaco editor).
 *
 * Styled as a simple segmented control that sits at the top
 * of the right panel. The active tab gets a highlighted background.
 *
 * Used by: components/editor/editor-layout.tsx
 */

"use client";

import { cn } from "@/lib/utils";
import { Eye, Code2, History, Store } from "lucide-react";

/**
 * The possible tab values for the right panel.
 * "preview" shows Sandpack live preview.
 * "code" shows Monaco editor with file explorer.
 * "history" shows version timeline and diff viewer.
 * "shop-manager" shows the webshop management dashboard.
 */
export type EditorTabValue = "preview" | "code" | "history" | "shop-manager";

/**
 * Props for the EditorTabs component.
 *
 * @property activeTab - Currently selected tab
 * @property onTabChange - Callback when a tab is clicked
 * @property projectType - Type of the project to conditionally show tabs
 */
export interface EditorTabsProps {
  activeTab: EditorTabValue;
  onTabChange: (tab: EditorTabValue) => void;
  projectType?: "website" | "webshop";
}

/**
 * Tab definitions with icons and labels.
 * Each tab maps to a different view in the right panel.
 */
const BASE_TABS = [
  { value: "preview" as const, label: "Preview", icon: Eye },
  { value: "code" as const, label: "Code", icon: Code2 },
  { value: "history" as const, label: "History", icon: History },
] as const;

/**
 * EditorTabs renders a segmented control to switch between
 * Preview and Code views in the editor's right panel.
 *
 * @param activeTab - The currently selected tab
 * @param onTabChange - Handler called when a tab is clicked
 * @param projectType - Project type
 */
export function EditorTabs({ activeTab, onTabChange, projectType }: EditorTabsProps) {
  // Dynamically add the Shop tab if it's a webshop project
  const tabs: Array<{ value: EditorTabValue; label: string; icon: any }> = [...BASE_TABS];
  if (projectType === "webshop") {
    tabs.push({ value: "shop-manager", label: "Shop", icon: Store });
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary/50 p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
