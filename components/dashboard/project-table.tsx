"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, Globe, ShoppingBag } from "lucide-react";
import type { Project } from "@/types/project";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ProjectTableProps {
  projects: Project[];
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ProjectTable({ projects, onRename, onDelete }: ProjectTableProps) {
  const router = useRouter();

  if (projects.length === 0) {
    return (
      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Last updated</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                No projects found.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Last updated</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const initials = getInitials(project.name);
            const isWebshop = project.type === "webshop";

            return (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => router.push(`/project/${project.id}`)}
              >
                {/* Name + avatar */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-muted-foreground/70",
                        isWebshop
                          ? "bg-gradient-to-br from-violet-500/20 via-purple-500/20 to-pink-500/20"
                          : "bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-teal-500/20"
                      )}
                    >
                      {initials}
                    </div>
                    <span className="truncate font-medium text-sm">{project.name}</span>
                  </div>
                </TableCell>

                {/* Type badge */}
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "gap-1.5 text-xs font-medium",
                      isWebshop
                        ? "bg-violet-500/10 text-violet-400 hover:bg-violet-500/20"
                        : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                    )}
                  >
                    {isWebshop ? (
                      <ShoppingBag className="size-3" />
                    ) : (
                      <Globe className="size-3" />
                    )}
                    {isWebshop ? "Webshop" : "Website"}
                  </Badge>
                </TableCell>

                {/* Last updated */}
                <TableCell className="text-sm text-muted-foreground">
                  {getRelativeTime(project.updatedAt)}
                </TableCell>

                {/* Created */}
                <TableCell className="text-sm text-muted-foreground">
                  {formatDate(project.createdAt)}
                </TableCell>

                {/* Actions */}
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
