/**
 * components/editor/preview-panel.tsx
 *
 * Live preview panel using Sandpack (CodeSandbox's browser-based bundler).
 * Renders the project files as a running React application inside an iframe.
 *
 * Configuration:
 * - Template: react-ts (React + TypeScript)
 * - Theme: dark (matching the app's dark-first design)
 * - External resources: Tailwind CDN for utility-class styling
 * - Shows navigator (URL bar) for SPA routing
 *
 * File Format:
 * Sandpack expects files in the format: { "/App.tsx": { code: "..." } }
 * Our state uses: { "src/App.tsx": "..." }
 * This component transforms between these formats.
 *
 * This component is lazy-loaded with next/dynamic({ ssr: false })
 * because Sandpack requires browser APIs (iframes, web workers).
 *
 * Used by: app/(app)/project/[projectId]/page.tsx (via dynamic import)
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackLayout,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Props for the PreviewPanel component.
 *
 * @property files - Record of file paths to content strings (e.g., "src/App.tsx": "...")
 */
export interface PreviewPanelProps {
  files: Record<string, string>;
  onError?: (error: { message: string }) => void;
  isStreaming?: boolean;
  onFilesChange?: (files: Record<string, string>) => void;
}

/**
 * Extracts dependencies from the project's package.json file.
 * When the AI adds packages like lucide-react or recharts to package.json,
 * Sandpack needs those in its customSetup.dependencies to install them.
 *
 * Falls back to base React dependencies if package.json is missing or invalid.
 *
 * @param files - Our file record with paths as keys and content as values
 * @returns Dependency record mapping package names to version strings
 */
function extractDependencies(
  files: Record<string, string>
): Record<string, string> {
  const baseDeps: Record<string, string> = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
  };

  const packageJsonContent = files["package.json"];
  if (!packageJsonContent) return baseDeps;

  try {
    const parsed = JSON.parse(packageJsonContent);
    return { ...baseDeps, ...(parsed.dependencies || {}) };
  } catch {
    return baseDeps;
  }
}

/**
 * Transforms our file format into Sandpack's expected format.
 * Our state uses paths like "src/App.tsx" but Sandpack expects "/App.tsx".
 *
 * For React-ts template, Sandpack expects:
 * - /App.tsx as the main component
 * - /index.tsx as the entry point (or uses its own)
 *
 * @param files - Our file record with "src/" prefixed paths
 * @returns Sandpack-compatible file record with "/" prefixed paths
 */
function toSandpackFiles(
  files: Record<string, string>
): Record<string, { code: string }> {
  const sandpackFiles: Record<string, { code: string }> = {};

  for (const [path, content] of Object.entries(files)) {
    // Strip the "src/" prefix for Sandpack, as it uses /App.tsx, /index.tsx etc.
    // Keep other paths (like package.json) as-is but with leading /
    const sandpackPath = path.startsWith("src/")
      ? `/${path.slice(4)}`
      : `/${path}`;

    sandpackFiles[sandpackPath] = { code: content };
  }

  return sandpackFiles;
}

/**
 * Listens for Sandpack build/runtime errors via the message bus.
 * Must be rendered inside SandpackProvider to access the useSandpack hook.
 * Uses a 1.5s debounce to let Sandpack settle (avoids transient bundling errors)
 * and deduplicates consecutive identical error messages.
 *
 * @param onError - Callback fired with the error message after debounce
 */
function ErrorListener({ onError }: { onError: (error: { message: string }) => void }) {
  const { sandpack, listen } = useSandpack();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastErrorRef = useRef<string>("");

  const handleError = useCallback(
    (message: string) => {
      // Dedup: skip if same error message as last reported
      if (message === lastErrorRef.current) return;

      // Clear existing debounce timer
      if (debounceRef.current) clearTimeout(debounceRef.current);

      // Wait 1.5s for Sandpack to settle before reporting
      debounceRef.current = setTimeout(() => {
        lastErrorRef.current = message;
        onError({ message });
      }, 1500);
    },
    [onError]
  );

  /**
   * Watch the sandpack.error state for bundler/compile errors.
   * These include dependency resolution failures ("Could not find dependency")
   * and syntax errors that Sandpack surfaces via its error overlay.
   * The message listener below does NOT catch these — they only appear in state.
   */
  useEffect(() => {
    if (sandpack.error?.message) {
      handleError(sandpack.error.message);
    }
  }, [sandpack.error, handleError]);

  /**
   * Listen to the message bus for runtime errors (console.error)
   * and action-based errors that some Sandpack versions emit.
   */
  useEffect(() => {
    const unsubscribe = listen((msg) => {
      // Cast to unknown first to safely access additional properties
      const raw = msg as unknown as Record<string, unknown>;

      // Detect "show-error" action messages (build errors)
      if (msg.type === "action" && raw.action === "show-error") {
        const errorMessage =
          (raw.message as string) ||
          (raw.title as string) ||
          "Build error";
        handleError(errorMessage);
      }

      // Detect console.error messages (runtime errors)
      if (msg.type === "console" && raw.log) {
        const logs = raw.log as Array<{ method?: string; data?: string[] }>;
        for (const log of Array.isArray(logs) ? logs : [logs]) {
          if (log.method === "error" && log.data && log.data.length > 0) {
            handleError(log.data.join(" "));
            break;
          }
        }
      }
    });

    return () => {
      unsubscribe();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [listen, handleError]);

  return null;
}

/**
 * "Built with Lovable" badge shown in the Sandpack preview actions bar.
 * Uses inline styles instead of Tailwind because Sandpack's CSS-in-JS
 * (stitches) applies scoped styles with high specificity that override
 * Tailwind utility classes. React state drives the hover effect.
 */
function LovableBadge() {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href="/"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        borderRadius: 6,
        padding: "4px 8px",
        fontSize: 12,
        cursor: "pointer",
        textDecoration: "none",
        transition: "all 150ms ease",
        color: hovered ? "#ffffff" : "#808080",
        backgroundColor: hovered ? "rgba(255,255,255,0.08)" : "transparent",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.15)" : "transparent"}`,
      }}
    >
      <img src="/logo.svg" alt="" style={{ width: 14, height: 14 }} />
      Built with Lovable
    </a>
  );
}

/** Script injected into Sandpack to handle visual editing */
const INSPECTOR_SCRIPT = `
(function() {
  let enabled = false;
  let originalText = '';
  
  let overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '9999999';
  overlay.style.border = '2px solid #8b5cf6';
  overlay.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
  overlay.style.transition = 'all 0.1s ease';
  overlay.style.display = 'none';
  document.body.appendChild(overlay);

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SET_VISUAL_EDIT_MODE') {
      enabled = e.data.enabled;
      if (!enabled) {
        overlay.style.display = 'none';
      }
    }
  });

  document.addEventListener('mouseover', (e) => {
    if (!enabled) return;
    const target = e.target;
    if (target === document.body || target === document.documentElement) return;
    const rect = target.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
  });

  document.addEventListener('mouseout', (e) => {
    if (!enabled) return;
    overlay.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target;
    overlay.style.display = 'none';
    enabled = false;
    window.parent.postMessage({ type: 'VISUAL_EDIT_ENDED' }, '*');
    
    if (target.tagName === 'IMG' || target.tagName === 'SVG') {
       const newSrc = prompt('Enter new image URL:', target.src || '');
       if (newSrc && newSrc !== target.src) {
           const oldSrc = target.src;
           target.src = newSrc;
           window.parent.postMessage({ type: 'DIRECT_SAVE_IMAGE', oldSrc: oldSrc, newSrc: newSrc }, '*');
       }
    } else {
       originalText = target.innerText || target.textContent;
       target.contentEditable = 'true';
       target.style.outline = '2px dashed #8b5cf6';
       target.style.outlineOffset = '2px';
       target.style.borderRadius = '2px';
       target.focus();
       
       const onBlur = () => {
           target.contentEditable = 'false';
           target.style.outline = '';
           target.style.outlineOffset = '';
           target.style.borderRadius = '';
           target.removeEventListener('blur', onBlur);
           
           const newText = target.innerText || target.textContent;
           if (newText !== originalText) {
               window.parent.postMessage({ type: 'DIRECT_SAVE_TEXT', oldText: originalText, newText: newText }, '*');
           }
       };
       target.addEventListener('blur', onBlur);
       
       const onKeyDown = (event) => {
           if (event.key === 'Enter' && !event.shiftKey) {
               event.preventDefault();
               target.blur();
               target.removeEventListener('keydown', onKeyDown);
           }
       };
       target.addEventListener('keydown', onKeyDown);
    }
  }, true);

  // Add html2canvas dynamically for taking thumbnail screenshots
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  script.onload = () => {
    // Only capture once per page load, after 4 seconds to let images/fonts load
    setTimeout(() => {
      if (window.html2canvas && document.body) {
        window.html2canvas(document.body, { 
          scale: 0.5,
          useCORS: true,
          logging: false
        }).then(canvas => {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          window.parent.postMessage({ type: 'SAVE_THUMBNAIL', dataUrl }, '*');
        }).catch(e => console.error('html2canvas error', e));
      }
    }, 4000);
  };
  document.head.appendChild(script);

})();
`;
const inspectorUrl = "data:application/javascript;charset=utf-8," + encodeURIComponent(INSPECTOR_SCRIPT);


/**
 * PreviewPanel renders the project as a live React app using Sandpack.
 * The preview updates automatically when the files prop changes.
 *
 * @param files - Current project files to render in the preview
 */
export function PreviewPanel({ files, onError, isStreaming, onFilesChange }: PreviewPanelProps) {
  const sandpackFiles = toSandpackFiles(files);
  const dependencies = extractDependencies(files);

  const [isVisualEditMode, setIsVisualEditMode] = useState(false);

  useEffect(() => {
    const handleToggle = () => setIsVisualEditMode((prev) => !prev);
    const handleDisable = () => setIsVisualEditMode(false);
    
    window.addEventListener("toggle-visual-edit", handleToggle);
    window.addEventListener("visual-edit-ended", handleDisable);
    
    return () => {
      window.removeEventListener("toggle-visual-edit", handleToggle);
      window.removeEventListener("visual-edit-ended", handleDisable);
    };
  }, []);

  useEffect(() => {
    const iframe = document.querySelector('.sp-preview-iframe') as HTMLIFrameElement;
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'SET_VISUAL_EDIT_MODE', enabled: isVisualEditMode }, '*');
    }
  }, [isVisualEditMode, sandpackFiles]); // re-run if sandpack reloads files

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === 'VISUAL_EDIT_ENDED') {
        setIsVisualEditMode(false);
        window.dispatchEvent(new CustomEvent('visual-edit-ended'));
      }

      if (e.data && e.data.type === 'STRIPE_REDIRECT') {
        toast.loading("Redirecting to secure checkout...");
        window.location.href = e.data.url;
      }
      
      if (e.data && (e.data.type === 'DIRECT_SAVE_TEXT' || e.data.type === 'DIRECT_SAVE_IMAGE')) {
        if (!onFilesChange) return;
        
        const newFiles = { ...files };
        let found = false;
        
        if (e.data.type === 'DIRECT_SAVE_TEXT') {
          const oldTextRaw = e.data.oldText || '';
          const newText = e.data.newText || '';
          const oldTextTrimmed = oldTextRaw.trim();
          
          if (!oldTextTrimmed) return;

          for (const [path, content] of Object.entries(newFiles)) {
            // 1. Try exact raw match
            if (content.includes(oldTextRaw)) {
              newFiles[path] = content.replace(oldTextRaw, newText);
              found = true;
              break;
            }
            
            // 2. Try exact trimmed match
            if (content.includes(oldTextTrimmed)) {
              newFiles[path] = content.replace(oldTextTrimmed, newText);
              found = true;
              break;
            }
            
            // 3. Try regex match ignoring whitespace/newlines differences
            // Escape regex specials
            const escaped = oldTextTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Replace any whitespace in the escaped string with \s+
            const regexStr = escaped.replace(/\s+/g, '\\s+');
            const regex = new RegExp(regexStr);
            
            if (regex.test(content)) {
              newFiles[path] = content.replace(regex, newText);
              found = true;
              break;
            }
          }
        } else if (e.data.type === 'DIRECT_SAVE_IMAGE') {
          const oldSrc = e.data.oldSrc;
          const newSrc = e.data.newSrc;
          
          if (!oldSrc || !newSrc) return;

          for (const [path, content] of Object.entries(newFiles)) {
            // 1. Try exact match
            if (content.includes(oldSrc)) {
              newFiles[path] = content.replace(oldSrc, newSrc);
              found = true;
              break;
            }
            
            // 2. Try matching just the path (in case it's relative in code but absolute in DOM)
            try {
              const url = new URL(oldSrc);
              const pathname = url.pathname + url.search;
              if (pathname.length > 1 && content.includes(pathname)) {
                newFiles[path] = content.replace(pathname, newSrc);
                found = true;
                break;
              }
            } catch(e) {
              // Ignore invalid URLs
            }
          }
        }

        if (found) {
          onFilesChange(newFiles);
          toast.success("Saved instantly!");
        } else {
          toast.error("Could not find the exact original text/image in code. Use the chat to ask AI to update it instead.");
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files, onFilesChange]);

  return (
    <div className="sandpack-stretch h-full w-full relative">
      {/* Overlay when generating/auto-fixing to prevent flickering */}
      {isStreaming && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-6 shadow-lg">
            <div className="relative">
              <div className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse" />
              <Loader2 className="relative h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="text-sm font-medium">Generating changes...</p>
              <p className="text-xs text-muted-foreground">Fixing problems or updating code</p>
            </div>
          </div>
        </div>
      )}

      {/* Visual Edit Mode Overlay Indicator */}
      {isVisualEditMode && !isStreaming && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
          </span>
          Click an element to edit instantly
        </div>
      )}

      <SandpackProvider
        template="react-ts"
        theme="dark"
        files={sandpackFiles}
        options={{
          externalResources: ["https://cdn.tailwindcss.com", inspectorUrl],
          autoReload: true,
        }}
        customSetup={{
          dependencies,
        }}
      >
        {/* Listen for build/runtime errors when an onError handler is provided */}
        {onError && <ErrorListener onError={onError} />}

        <SandpackLayout
          style={{
            height: "100%",
            border: "none",
            borderRadius: 0,
          }}
        >
          <SandpackPreview
            showNavigator
            showRefreshButton
            showOpenInCodeSandbox={false}
            actionsChildren={<LovableBadge />}
            style={{ height: "100%" }}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
}
