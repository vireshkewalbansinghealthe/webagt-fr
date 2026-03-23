/**
 * components/editor/export-button.tsx
 *
 * Download button that exports the current project as a ZIP file.
 * Fetches the ZIP from the Worker export endpoint and triggers
 * a browser download. Shows a loading spinner during the request.
 *
 * For free users, shows an upgrade CTA dialog instead of exporting.
 *
 * Used by: components/editor/editor-header.tsx
 */

"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Download, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { WORKER_URL } from "@/lib/api-client";
import { cn } from "@/lib/utils";

/**
 * Props for the ExportButton component.
 *
 * @property projectId - The project ID to export
 * @property projectName - Display name for the downloaded file
 * @property userPlan - User's plan — "free" shows upgrade CTA, "pro" allows export
 */
export interface ExportButtonProps {
  projectId: string;
  projectName: string;
  userPlan: "free" | "pro";
}

/**
 * ExportButton triggers a ZIP download of the project.
 * Pro users get the download, free users see an upgrade prompt.
 *
 * @param projectId - Used to construct the export API URL
 * @param projectName - Displayed in the upgrade CTA dialog
 * @param userPlan - Controls whether export is allowed
 */
export function ExportButton({
  projectId,
  projectName,
  userPlan,
}: ExportButtonProps) {
  const { getToken } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  /**
   * Handles the export click.
   * Free users see the upgrade dialog.
   * Pro users trigger the ZIP download.
   */
  async function handleExport() {
    // Gate behind Pro plan
    if (userPlan === "free") {
      setShowUpgradeDialog(true);
      return;
    }

    setIsExporting(true);

    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");

      const response = await fetch(
        `${WORKER_URL}/api/projects/${projectId}/export`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({
          error: "Export failed",
        }));
        throw new Error(
          (errorBody as { error?: string }).error || `HTTP ${response.status}`
        );
      }

      // Get the ZIP blob and trigger browser download
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      // Extract filename from Content-Disposition or use project name
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || `${projectName}.zip`;

      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      toast.success("Project exported successfully!");
    } catch (error) {
      console.error("Export failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Export failed. Try again."
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        disabled={isExporting}
        className="hidden gap-1.5 text-xs sm:flex"
      >
        {isExporting ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : userPlan === "free" ? (
          <Lock className="size-3.5" />
        ) : (
          <Download className="size-3.5" />
        )}
        Export
      </Button>

      {/* Upgrade CTA dialog for free users */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Export requires Pro</DialogTitle>
            <DialogDescription>
              Upgrade to Pro to download &quot;{projectName}&quot; as a
              standalone project with all config files included.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Download className="size-3.5 text-primary" />
                Full project ZIP with Vite + Tailwind setup
              </li>
              <li className="flex items-center gap-2">
                <Download className="size-3.5 text-primary" />
                Ready to run with npm install &amp;&amp; npm run dev
              </li>
              <li className="flex items-center gap-2">
                <Download className="size-3.5 text-primary" />
                Includes package.json, tsconfig, and README
              </li>
            </ul>
            <Button
              className="w-full"
              onClick={() => {
                setShowUpgradeDialog(false);
                window.open("/pricing", "_blank");
              }}
            >
              Upgrade to Pro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
