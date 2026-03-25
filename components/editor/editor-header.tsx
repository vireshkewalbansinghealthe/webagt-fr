/**
 * components/editor/editor-header.tsx
 *
 * Full-width header bar at the top of the editor view.
 * Responsive design:
 *
 * Desktop (md+):
 * ┌──────────────────────────────────────────────────────────┐
 * │  [Logo] [ProjectName ▼]   │  [Preview][Code]  │ [Share][👤]│
 * │          subtitle          │                   │           │
 * └──────────────────────────────────────────────────────────┘
 *
 * Mobile (<md):
 * ┌──────────────────────────────────────────────────────────┐
 * │  [Logo] [ProjectName ▼]   [Chat][Preview][Code]     [👤] │
 * └──────────────────────────────────────────────────────────┘
 *
 * On mobile the subtitle and Share button are hidden, and a "Chat"
 * tab appears in the pill switcher to toggle between panels.
 *
 * Used by: components/editor/editor-layout.tsx
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Eye,
  Code2,
  MessageSquare,
  History,
  Store,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { openInCodeSandbox } from "@/lib/codesandbox";
import { ProjectMenu } from "./project-menu";
import { ExportButton } from "./export-button";
import { DeviceToggle } from "./device-toggle";
import type { DeviceMode } from "./device-toggle";
import type { EditorTabValue } from "./editor-tabs";

/**
 * Props for the EditorHeader component.
 *
 * @property projectName - Name of the current project
 * @property activeTab - Currently selected tab (preview or code)
 * @property onTabChange - Callback when the user clicks a tab
 * @property mobilePanel - Which panel is visible on mobile ("chat" or "content")
 * @property onMobilePanelChange - Callback to switch the mobile panel
 * @property projectId - Project ID for the export button
 * @property userPlan - User's plan for export gating
 * @property creditsRemaining - Credits left (-1 = unlimited, undefined = loading)
 * @property creditsTotal - Total credits for the plan period
 * @property onRename - Callback when user renames the project
 * @property onDelete - Callback when user deletes the project
 * @property files - Current project files (used by "Open in CodeSandbox" button)
 * @property deviceMode - Currently selected preview device mode
 * @property onDeviceModeChange - Callback when user switches device mode
 */
export interface EditorHeaderProps {
  projectName: string;
  files: Record<string, string>;
  activeTab: EditorTabValue;
  onTabChange: (tab: EditorTabValue) => void;
  mobilePanel: "chat" | "content";
  onMobilePanelChange: (panel: "chat" | "content") => void;
  projectId: string;
  userPlan: "free" | "pro";
  creditsRemaining?: number;
  creditsTotal?: number;
  onRename: (newName: string) => void;
  onDelete: () => void;
  deviceMode: DeviceMode;
  onDeviceModeChange: (mode: DeviceMode) => void;
  projectType?: "website" | "webshop";
}

/**
 * Tab definitions for the center pill switcher (desktop).
 */
const BASE_TABS = [
  { value: "preview" as const, label: "Preview", icon: Eye },
  { value: "code" as const, label: "Code", icon: Code2 },
  { value: "history" as const, label: "History", icon: History },
] as const;

/**
 * EditorHeader renders the full-width header bar above both panels.
 * Contains the logo/project info, tab switcher, and user actions.
 * Fully responsive — adapts layout for mobile screens.
 *
 * @param projectName - Displayed in the project dropdown trigger
 * @param activeTab - Which tab is currently active
 * @param onTabChange - Called when user clicks Preview or Code
 * @param mobilePanel - Current mobile panel ("chat" or "content")
 * @param onMobilePanelChange - Called when user switches mobile panel
 */
export function EditorHeader({
  projectName,
  files,
  activeTab,
  onTabChange,
  mobilePanel,
  onMobilePanelChange,
  projectId,
  userPlan,
  creditsRemaining,
  creditsTotal,
  onRename,
  onDelete,
  deviceMode,
  onDeviceModeChange,
  projectType,
}: EditorHeaderProps) {
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);
  const { user } = useUser();

  const userInitials = user
    ? (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? user.emailAddresses?.[0]?.emailAddress?.[0] ?? "")
    : "";
  const userEmail = user?.emailAddresses?.[0]?.emailAddress ?? "";
  const userDisplayName = user?.fullName || user?.firstName || userEmail.split("@")[0] || "Account";

  const tabs: Array<{ value: EditorTabValue; label: string; icon: any }> = [...BASE_TABS];
  if (projectType === "webshop") {
    tabs.push({ value: "shop-manager", label: "Shop", icon: Store });
  }

  /** Creates a CodeSandbox sandbox and opens the live .csb.app URL directly */
  async function handleOpenPreview() {
    setIsOpeningPreview(true);
    try {
      await openInCodeSandbox(files);
    } catch {
      toast.error("Failed to open preview. Try again.");
    } finally {
      setIsOpeningPreview(false);
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center border-b border-border bg-background px-1.5 sm:px-3">
      {/* === Left section: Logo + Project name === */}
      <div className="flex items-center gap-1.5 sm:gap-4">
        {/* Web AGT logo — links back to dashboard */}
        <Link
          href="/dashboard"
          className="flex items-center gap-2 group shrink-0 transition-opacity duration-150 hover:opacity-90"
          aria-label="Go to dashboard"
        >
          <div className="relative size-8 overflow-hidden rounded-lg border border-border bg-black shadow-sm group-hover:border-primary/50 transition-colors">
            <img
              src="/logo.svg"
              alt="WebAGT Logo"
              className="size-full object-cover"
            />
          </div>
          <div className="hidden lg:flex flex-col">
            <span className="font-outfit text-sm font-bold tracking-tight leading-none text-foreground">
              WebAGT
            </span>
            <span className="font-outfit text-[10px] font-medium text-muted-foreground leading-none mt-0.5">
              From prompt to live storefront
            </span>
          </div>
        </Link>

        {/* Vertical divider */}
        <div className="hidden sm:block w-px h-6 bg-border mx-1" />

        {/* Project name dropdown + subtitle */}
        <div className="flex flex-col">
          <ProjectMenu
            projectName={projectName}
            projectId={projectId}
            creditsRemaining={creditsRemaining}
            creditsTotal={creditsTotal}
            userPlan={userPlan}
            onRename={onRename}
            onDelete={onDelete}
          />
          <span className="hidden px-1.5 text-xs text-muted-foreground sm:block">
            Previewing last saved version
          </span>
        </div>
      </div>

      {/* === Center section: Pill-shaped tab switcher === */}
      {/* Desktop: absolute centered, shows Preview/Code */}
      <div className="hidden md:block absolute left-1/2 -translate-x-1/2">
        <div className="flex items-center gap-0.5 rounded-full bg-secondary/60 p-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.value;
            // Highlight the Shop tab with a primary color when active
            const isShopTab = tab.value === "shop-manager";
            
            return (
              <button
                key={tab.value}
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  "flex cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? isShopTab 
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile: inline tabs with Chat + Preview (Code disabled on mobile) */}
      <div className="mx-auto md:hidden">
        <div className="flex items-center gap-0.5 rounded-full bg-secondary/60 p-0.5">
          {/* Chat tab */}
          <button
            onClick={() => onMobilePanelChange("chat")}
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
              mobilePanel === "chat"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <MessageSquare className="size-3" />
            Chat
          </button>

          {/* Preview tab */}
          <button
            onClick={() => {
              onTabChange("preview");
              onMobilePanelChange("content");
            }}
            className={cn(
              "flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
              mobilePanel === "content"
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Eye className="size-3" />
            Preview
          </button>
        </div>
      </div>

      {/* === Right section: Device toggle + Export + User avatar === */}
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        {/* Device toggle — only visible on desktop when Preview tab is active */}
        {activeTab === "preview" && (
          <div className="hidden md:flex items-center gap-1.5">
            <DeviceToggle
              deviceMode={deviceMode}
              onDeviceModeChange={onDeviceModeChange}
            />
          </div>
        )}

        {/* Open live preview — icon-only on mobile, icon+label on desktop */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleOpenPreview}
          disabled={isOpeningPreview}
          className="gap-1.5 text-xs"
          title="Open live preview in new tab"
        >
          {isOpeningPreview ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ExternalLink className="size-3.5" />
          )}
          <span className="hidden sm:inline">Preview</span>
        </Button>
        <ExportButton
          projectId={projectId}
          projectName={projectName}
          userPlan={userPlan}
        />
        {/* User profile widget — avatar + name + email */}
        <div className="hidden sm:flex items-center gap-2 rounded-full border border-border/50 bg-secondary/40 pl-1 pr-3 py-1 hover:bg-secondary/70 transition-colors cursor-pointer">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: "size-6",
                userButtonPopoverCard: "shadow-xl",
              },
            }}
          />
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
              {userDisplayName}
            </span>
            {userEmail && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                {userEmail}
              </span>
            )}
          </div>
        </div>
        {/* Mobile — icon only */}
        <div className="sm:hidden">
          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: { avatarBox: "size-7" },
            }}
          />
        </div>
      </div>
    </header>
  );
}
