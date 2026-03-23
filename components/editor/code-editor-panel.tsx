/**
 * components/editor/code-editor-panel.tsx
 *
 * Code editor panel using Monaco (VS Code's editor engine).
 * Shows a file explorer on the left and the Monaco editor on the right.
 *
 * Features:
 * - Syntax highlighting for TypeScript, TSX, CSS, JSON
 * - Dark theme matching the app design
 * - File tabs at the top showing the active file name
 * - Line numbers, minimap, auto-indent
 * - onChange handler updates the files state (debounced)
 *
 * This component is lazy-loaded with next/dynamic({ ssr: false })
 * because Monaco requires window and document browser APIs.
 *
 * Used by: app/(app)/project/[projectId]/page.tsx (via dynamic import)
 */

"use client";

import { useCallback, useRef } from "react";
import Editor, { type OnMount, type BeforeMount } from "@monaco-editor/react";
import { FileExplorer } from "./file-explorer";
import { FileText } from "lucide-react";

/**
 * Props for the CodeEditorPanel component.
 *
 * @property files - Record of file paths to content strings
 * @property activeFile - Currently selected file path
 * @property onActiveFileChange - Callback when user selects a different file
 * @property onFileContentChange - Callback when user edits code in Monaco
 */
export interface CodeEditorPanelProps {
  files: Record<string, string>;
  activeFile: string;
  onActiveFileChange: (filePath: string) => void;
  onFileContentChange: (filePath: string, content: string) => void;
}

/**
 * Determines the Monaco language identifier from a file path extension.
 * Used to set proper syntax highlighting for each file type.
 *
 * @param filePath - The file path to detect language for
 * @returns Monaco language identifier string
 */
function getLanguageFromPath(filePath: string): string {
  const extension = filePath.split(".").pop()?.toLowerCase();

  switch (extension) {
    case "tsx":
      return "typescript";
    case "ts":
      return "typescript";
    case "jsx":
      return "javascript";
    case "js":
      return "javascript";
    case "css":
      return "css";
    case "json":
      return "json";
    case "html":
      return "html";
    case "md":
      return "markdown";
    default:
      return "plaintext";
  }
}

/**
 * Extracts just the file name from a full path.
 * E.g., "src/components/Button.tsx" → "Button.tsx"
 *
 * @param filePath - Full file path
 * @returns Just the file name portion
 */
function getFileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

/**
 * CodeEditorPanel renders the file explorer + Monaco editor side by side.
 * The file explorer allows selecting files, and Monaco displays/edits them.
 * Changes in Monaco propagate back up to the parent state.
 *
 * @param files - All project files
 * @param activeFile - Currently selected file
 * @param onActiveFileChange - Called when user selects a file in explorer
 * @param onFileContentChange - Called when user edits code (path + new content)
 */
export function CodeEditorPanel({
  files,
  activeFile,
  onActiveFileChange,
  onFileContentChange,
}: CodeEditorPanelProps) {
  /**
   * Ref to the Monaco editor instance.
   * Used to programmatically access editor APIs if needed.
   */
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  /**
   * Called before Monaco mounts — configures TypeScript compiler options.
   * Enables JSX support and relaxes diagnostics since generated code
   * won't have full type definitions available in the browser.
   */
  const handleEditorWillMount: BeforeMount = useCallback((monaco) => {
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.Latest,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      jsx: monaco.languages.typescript.JsxEmit.ReactJSX,
      allowJs: true,
      allowNonTsExtensions: true,
      esModuleInterop: true,
      moduleResolution:
        monaco.languages.typescript.ModuleResolutionKind.NodeJs,
    });

    // Disable semantic and syntax validation to avoid red squiggly lines
    // on generated code that lacks full type definitions
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
    });
  }, []);

  /**
   * Called when Monaco editor is mounted.
   * Stores the editor instance ref for later use.
   */
  const handleEditorDidMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
  }, []);

  /**
   * Called when the user edits code in Monaco.
   * Propagates the change to the parent component's state.
   */
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        onFileContentChange(activeFile, value);
      }
    },
    [activeFile, onFileContentChange]
  );

  const activeContent = files[activeFile] ?? "";
  const language = getLanguageFromPath(activeFile);

  return (
    <div className="flex h-full">
      {/* File explorer — left sidebar within code tab (hidden on mobile) */}
      <div className="hidden w-52 shrink-0 md:block">
        <FileExplorer
          files={files}
          activeFile={activeFile}
          onFileSelect={onActiveFileChange}
        />
      </div>

      {/* Monaco editor — takes remaining space */}
      <div className="flex flex-1 flex-col">
        {/* File tab showing active file name */}
        <div className="flex h-10 items-center gap-2 border-b border-border px-3">
          <div className="flex items-center gap-1.5 rounded-md bg-accent/50 px-2.5 py-1">
            <FileText className="size-3 text-muted-foreground" />
            <span className="text-xs font-medium">
              {getFileName(activeFile)}
            </span>
          </div>
        </div>

        {/* Monaco editor instance */}
        <div className="flex-1">
          <Editor
            height="100%"
            language={language}
            value={activeContent}
            theme="vs-dark"
            onChange={handleEditorChange}
            beforeMount={handleEditorWillMount}
            onMount={handleEditorDidMount}
            options={{
              minimap: { enabled: true },
              wordWrap: "on",
              formatOnPaste: true,
              tabSize: 2,
              fontSize: 13,
              lineHeight: 20,
              padding: { top: 12 },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              scrollbar: {
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
