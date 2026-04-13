/**
 * components/editor/export-button.tsx
 *
 * Download button that exports the current project as a ZIP file.
 * Fetches the ZIP from the Worker export endpoint and triggers
 * a browser download. Shows a loading spinner during the request.
 *
 * Used by: components/editor/editor-header.tsx
 */

"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WORKER_URL } from "@/lib/api-client";

/**
 * Props for the ExportButton component.
 *
 * @property projectId - The project ID to export
 * @property projectName - Display name for the downloaded file
 * @property userPlan - Legacy prop; ignored
 */
export interface ExportButtonProps {
  projectId: string;
  projectName: string;
  userPlan?: "pro" | "free";
}

/**
 * ExportButton triggers a ZIP download of the project.
 *
 * @param projectId - Used to construct the export API URL
 * @param projectName - Used for the downloaded filename fallback
 */
export function ExportButton({
  projectId,
  projectName,
  userPlan: _userPlan,
}: ExportButtonProps) {
  const { getToken } = useAuth();
  const [isExporting, setIsExporting] = useState(false);

  async function handleExport() {
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
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className="hidden gap-1.5 text-xs sm:flex"
    >
      {isExporting ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Download className="size-3.5" />
      )}
      Export
    </Button>
  );
}
