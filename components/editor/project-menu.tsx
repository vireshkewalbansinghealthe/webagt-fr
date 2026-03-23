/**
 * components/editor/project-menu.tsx
 *
 * Dropdown menu triggered by the project name in the editor header.
 * Shows navigation options, user info, credit usage, and settings.
 *
 * Functional features:
 * - Go to Dashboard: navigates to /dashboard
 * - User info: shows Clerk avatar, name, and plan badge (live data)
 * - Credits: shows real credit usage from props
 * - Settings: navigates to /settings
 * - Rename project: opens inline rename dialog, persists via API
 * - Delete project: confirmation dialog, deletes via API, redirects
 * - Appearance: Light/Dark/System theme switching via ThemeProvider
 * - Help: navigates to /settings (account & billing section)
 *
 * Used by: components/editor/editor-header.tsx
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Settings,
  Pencil,
  Palette,
  HelpCircle,
  ChevronDown,
  Moon,
  Sun,
  Monitor,
  Trash2,
  Check,
} from "lucide-react";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Props for the ProjectMenu component.
 *
 * @property projectName - Name of the current project (shown as trigger)
 * @property projectId - Project ID for rename/delete API calls
 * @property creditsRemaining - Credits left (-1 = unlimited, undefined = loading)
 * @property creditsTotal - Total credits for the plan period (e.g. 50)
 * @property userPlan - User's current plan ("free" or "pro")
 * @property onRename - Callback after project is renamed with new name
 * @property onDelete - Callback to delete the project
 */
export interface ProjectMenuProps {
  projectName: string;
  projectId: string;
  creditsRemaining?: number;
  creditsTotal?: number;
  userPlan: "free" | "pro";
  onRename: (newName: string) => void;
  onDelete: () => void;
}

/**
 * Appearance option definitions for the theme submenu.
 */
const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Moon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * ProjectMenu renders a dropdown triggered by the project name.
 * Contains navigation, user info, credits, settings, rename,
 * delete, appearance, and help — all fully wired up.
 *
 * @param projectName - The project name displayed in the trigger button
 * @param projectId - Project ID for API operations
 * @param creditsRemaining - Live credit count
 * @param creditsTotal - Total credits for the billing period
 * @param userPlan - "free" or "pro"
 * @param onRename - Called with the new name after user confirms rename
 * @param onDelete - Called when user confirms project deletion
 */
export function ProjectMenu({
  projectName,
  projectId,
  creditsRemaining,
  creditsTotal = 50,
  userPlan,
  onRename,
  onDelete,
}: ProjectMenuProps) {
  const { user } = useUser();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  /** Whether the rename dialog is open */
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  /** Whether the delete confirmation dialog is open */
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  /** Value of the rename input */
  const [renameValue, setRenameValue] = useState(projectName);

  /** Ref for auto-focusing the rename input */
  const renameInputRef = useRef<HTMLInputElement>(null);

  /** Sync rename input when projectName changes */
  useEffect(() => {
    setRenameValue(projectName);
  }, [projectName]);

  /** Auto-focus and select the rename input when dialog opens */
  useEffect(() => {
    if (!isRenameOpen) return;

    // Small delay to ensure the dialog has rendered
    const timer = setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 50);

    return () => clearTimeout(timer);
  }, [isRenameOpen]);

  /**
   * Handles rename confirmation.
   * Only calls onRename if the name actually changed and is non-empty.
   */
  function handleRenameConfirm() {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== projectName) {
      onRename(trimmed);
    }
    setIsRenameOpen(false);
  }

  /**
   * Handles keyboard events in the rename input.
   * Enter confirms, Escape cancels.
   */
  function handleRenameKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      handleRenameConfirm();
    }
    if (event.key === "Escape") {
      setIsRenameOpen(false);
    }
  }

  /** Compute credits display values */
  const isUnlimited = creditsRemaining === -1;
  const isPro = userPlan === "pro";
  const displayRemaining = isUnlimited ? creditsTotal : (creditsRemaining ?? 0);
  const progressPercent = isUnlimited ? 100 : creditsTotal > 0 ? (displayRemaining / creditsTotal) * 100 : 0;

  return (
    <>
      <DropdownMenu>
        {/* Trigger — project name + chevron */}
        <DropdownMenuTrigger asChild>
          <button className="flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 transition-colors duration-150 hover:bg-accent/50 sm:px-1.5">
            <span className="max-w-[80px] truncate text-sm font-medium sm:max-w-[180px] sm:text-base">
              {projectName}
            </span>
            <ChevronDown className="size-3 text-muted-foreground sm:size-3.5" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          {/* Go to Dashboard */}
          <DropdownMenuItem onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="mr-2 size-4" />
            Go to Dashboard
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* User info row */}
          <div className="flex items-center gap-3 px-2 py-2">
            {user?.imageUrl ? (
              <img
                src={user.imageUrl}
                alt={user.fullName ?? "User avatar"}
                className="size-8 rounded-full"
              />
            ) : (
              <div className="size-8 rounded-full bg-secondary" />
            )}
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {user?.fullName ?? "User"}
              </span>
              <Badge
                variant="secondary"
                className="mt-0.5 w-fit text-[10px] px-1.5 py-0"
              >
                {isPro ? "Pro plan" : "Free plan"}
              </Badge>
            </div>
          </div>

          {/* Credits progress — live data */}
          <div className="px-2 pb-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Credits</span>
              <span>
                {isUnlimited ? "Unlimited" : `${creditsRemaining ?? 0} / ${creditsTotal}`}
              </span>
            </div>
            {!isUnlimited && (
              <div className="h-1.5 w-full rounded-full bg-secondary">
                <div
                  className="h-1.5 rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.min(100, progressPercent)}%` }}
                />
              </div>
            )}
          </div>

          <DropdownMenuSeparator />

          {/* Settings */}
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>

          {/* Rename project */}
          <DropdownMenuItem onClick={() => setIsRenameOpen(true)}>
            <Pencil className="mr-2 size-4" />
            Rename project
          </DropdownMenuItem>

          {/* Appearance submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Palette className="mr-2 size-4" />
              Appearance
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {THEME_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                >
                  <option.icon className="mr-2 size-4" />
                  {option.label}
                  {theme === option.value && (
                    <Check className="ml-auto size-3.5 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* Delete project */}
          <DropdownMenuItem
            onClick={() => setIsDeleteOpen(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete project
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Help */}
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <HelpCircle className="mr-2 size-4" />
            Help
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* === Rename Dialog === */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>
              Enter a new name for your project.
            </DialogDescription>
          </DialogHeader>
          <Input
            ref={renameInputRef}
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={handleRenameKeyDown}
            placeholder="Project name"
            maxLength={100}
          />
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRenameConfirm}
              disabled={!renameValue.trim() || renameValue.trim() === projectName}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Delete Confirmation Dialog === */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{projectName}</strong> and all
              its files, versions, and chat history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
