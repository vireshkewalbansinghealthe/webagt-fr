/**
 * components/editor/file-explorer.tsx
 *
 * Tree view showing all project files in a collapsible directory structure.
 * Converts flat file paths (e.g., "src/components/Button.tsx") into
 * a nested tree and renders it recursively.
 *
 * Algorithm:
 * 1. Take flat file paths: ["src/App.tsx", "src/components/Header.tsx", ...]
 * 2. Split each path by "/"
 * 3. Build a nested tree: { name: "src", children: [{ name: "App.tsx" }, ...] }
 * 4. Sort: folders first, then files alphabetically
 * 5. Render recursively with collapsible folders
 *
 * Used by: components/editor/code-editor-panel.tsx
 */

"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, FileText, Folder } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A node in the file tree — either a file or a folder.
 *
 * @property name - The name of the file or folder (e.g., "App.tsx", "components")
 * @property path - The full path for files (e.g., "src/App.tsx"), undefined for folders
 * @property children - Child nodes (only present for folders)
 */
interface TreeNode {
  name: string;
  path?: string;
  children?: TreeNode[];
}

/**
 * Props for the FileExplorer component.
 *
 * @property files - Record of file paths (keys only are used to build the tree)
 * @property activeFile - Currently selected file path (highlighted in the tree)
 * @property onFileSelect - Callback when a file is clicked
 */
export interface FileExplorerProps {
  files: Record<string, string>;
  activeFile: string;
  onFileSelect: (filePath: string) => void;
}

/**
 * Builds a tree structure from flat file paths.
 * Splits each path by "/" and inserts nodes into a nested object.
 * Folders are created implicitly from path segments.
 *
 * @param filePaths - Array of flat file paths
 * @returns Array of root-level TreeNode objects
 */
function buildFileTree(filePaths: string[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const filePath of filePaths) {
    const parts = filePath.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      // Check if this node already exists at the current level
      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        // Create new node — file or folder
        existingNode = isFile
          ? { name: part, path: filePath }
          : { name: part, children: [] };
        currentLevel.push(existingNode);
      }

      // Move deeper into the tree for folders
      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  // Sort the tree: folders first, then files, alphabetically within each group
  function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
      const aIsFolder = !!a.children;
      const bIsFolder = !!b.children;

      if (aIsFolder && !bIsFolder) return -1;
      if (!aIsFolder && bIsFolder) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  function sortRecursively(nodes: TreeNode[]): TreeNode[] {
    const sorted = sortTree(nodes);
    for (const node of sorted) {
      if (node.children) {
        node.children = sortRecursively(node.children);
      }
    }
    return sorted;
  }

  return sortRecursively(root);
}

/**
 * Props for the TreeNodeItem component.
 *
 * @property node - The tree node to render
 * @property depth - Current nesting depth (for indentation)
 * @property activeFile - Currently selected file path
 * @property onFileSelect - Callback when a file is clicked
 */
interface TreeNodeItemProps {
  node: TreeNode;
  depth: number;
  activeFile: string;
  onFileSelect: (filePath: string) => void;
}

/**
 * TreeNodeItem renders a single node in the file tree.
 * Folders are collapsible, files are clickable to select them.
 */
function TreeNodeItem({
  node,
  depth,
  activeFile,
  onFileSelect,
}: TreeNodeItemProps) {
  const [isOpen, setIsOpen] = useState(true);
  const isFolder = !!node.children;
  const isActive = node.path === activeFile;

  if (isFolder) {
    return (
      <div>
        {/* Folder row */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-sm text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors duration-150"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          {isOpen ? (
            <ChevronDown className="size-3.5 shrink-0" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0" />
          )}
          <Folder className="size-3.5 shrink-0 text-blue-400" />
          <span className="truncate">{node.name}</span>
        </button>

        {/* Folder children (collapsible) */}
        {isOpen &&
          node.children?.map((child) => (
            <TreeNodeItem
              key={child.path ?? child.name}
              node={child}
              depth={depth + 1}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
            />
          ))}
      </div>
    );
  }

  // File row
  return (
    <button
      onClick={() => node.path && onFileSelect(node.path)}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-sm transition-colors duration-150",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
      style={{ paddingLeft: `${depth * 12 + 6}px` }}
    >
      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{node.name}</span>
    </button>
  );
}

/**
 * FileExplorer renders a file tree built from flat file paths.
 * Shows folders and files with proper indentation, collapsible
 * folders, and highlights the currently active file.
 *
 * @param files - Project files (paths used to build tree)
 * @param activeFile - Currently selected file path
 * @param onFileSelect - Called when user clicks a file
 */
export function FileExplorer({
  files,
  activeFile,
  onFileSelect,
}: FileExplorerProps) {
  const filePaths = Object.keys(files);
  const tree = buildFileTree(filePaths);

  return (
    <div className="flex h-full flex-col border-r border-border bg-background">
      {/* Header */}
      <div className="flex h-10 items-center px-3 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Files
        </span>
      </div>

      {/* Tree view */}
      <div className="flex-1 overflow-y-auto p-2">
        {tree.map((node) => (
          <TreeNodeItem
            key={node.path ?? node.name}
            node={node}
            depth={0}
            activeFile={activeFile}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
}
