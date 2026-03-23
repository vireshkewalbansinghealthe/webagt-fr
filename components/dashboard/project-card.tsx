/**
 * components/dashboard/project-card.tsx
 *
 * Renders a single project card in the dashboard grid.
 * Shows a pre-rendered screenshot thumbnail, project name,
 * relative time since last edit, and a dropdown menu for actions
 * (rename, duplicate, delete).
 *
 * Falls back to a gradient with initials if thumbnail isn't loaded yet.
 *
 * Clicking the card navigates to /project/{projectId} for editing.
 * The dropdown menu stops click propagation so actions don't trigger navigation.
 *
 * Used by: components/dashboard/project-grid.tsx
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Project } from "@/types/project";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createApiClient } from "@/lib/api-client";

/**
 * Fixed height for the thumbnail area in pixels.
 */
const THUMBNAIL_HEIGHT = 160;

/**
 * Props for the ProjectCard component.
 */
export interface ProjectCardProps {
  project: Project;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Computes a relative time string like "2 hours ago" from an ISO date.
 */
function getRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffInSeconds = Math.floor((now - then) / 1000);

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  for (const [unit, secondsInUnit] of units) {
    if (diffInSeconds >= secondsInUnit) {
      const value = Math.floor(diffInSeconds / secondsInUnit);
      return formatter.format(-value, unit);
    }
  }

  return "just now";
}

/**
 * Extracts initials from a project name for the fallback thumbnail.
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProjectCard({
  project,
  onRename,
  onDelete,
}: ProjectCardProps) {
  const router = useRouter();
  const { getToken } = useAuth();
  const initials = getInitials(project.name);
  
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch the saved thumbnail image.
   */
  useEffect(() => {
    let mounted = true;
    const client = createApiClient(getToken);
    
    client.projects.getThumbnail(project.id)
      .then((data) => {
        if (!mounted) return;
        setThumbnailUrl(data.thumbnail || null);
      })
      .catch((err) => {
        console.error("Failed to load thumbnail", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [project.id, getToken]);

  return (
    <div onClick={() => router.push(`/project/${project.id}`)}>
      <Card className="group cursor-pointer gap-0 overflow-hidden p-0 transition-all duration-150 hover:border-white/20 hover:brightness-[1.05]">
        {/* Preview thumbnail — fixed height, clipped. Actual image or gradient fallback. */}
        <div
          className={cn(
            "relative overflow-hidden flex w-full items-center justify-center",
            thumbnailUrl ? "bg-[#1a1a1a]" : "bg-gradient-to-br from-[#6d9cff]/20 via-[#c084fc]/20 to-[#f87171]/20"
          )}
          style={{ height: THUMBNAIL_HEIGHT }}
        >
          {loading ? (
            <Skeleton className="absolute inset-0 rounded-none" />
          ) : thumbnailUrl ? (
            <img 
              src={thumbnailUrl} 
              alt={project.name}
              className="absolute top-0 left-0 w-full object-cover origin-top"
              style={{ minHeight: '100%' }}
            />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground/60">
              {initials}
            </span>
          )}
        </div>

        {/* Project info + action dropdown */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{project.name}</p>
            <p className="text-xs text-muted-foreground">
              {getRelativeTime(project.updatedAt)}
            </p>
          </div>

          {/* Dropdown menu — stops click propagation to prevent navigation */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="opacity-0 group-hover:opacity-100"
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onClick={() => onRename(project.id)}>
                <Pencil className="mr-2 size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDelete(project.id)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>
    </div>
  );
}