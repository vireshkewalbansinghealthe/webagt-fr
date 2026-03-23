"use client";

import { memo, useEffect } from "react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackLayout,
  useSandpack,
} from "@codesandbox/sandpack-react";

/**
 * SandpackListener waits for the bundler to finish compiling and rendering,
 * then fires the onLoad callback so we can hide the loading skeleton.
 */
function SandpackListener({ onLoad }: { onLoad: () => void }) {
  const { listen } = useSandpack();
  
  useEffect(() => {
    const unsubscribe = listen((msg) => {
      // 'done' means the bundler has finished and the iframe is ready
      if (msg.type === "done") {
        onLoad();
      }
    });
    return unsubscribe;
  }, [listen, onLoad]);

  return null;
}

/**
 * Props for the ProjectPreview component.
 *
 * @property files - Project files to render in Sandpack
 * @property onLoad - Callback fired when the iframe finishes loading
 */
export interface ProjectPreviewProps {
  files: Record<string, string>;
  onLoad?: () => void;
}

/**
 * ProjectPreview renders a non-interactive, scaled-down Sandpack preview.
 * It is memoized so it doesn't re-render unless the files object reference changes.
 */
export const ProjectPreview = memo(function ProjectPreview({
  files,
  onLoad,
}: ProjectPreviewProps) {
  const baseDeps: Record<string, string> = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.344.0",
    "date-fns": "^3.3.1",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "framer-motion": "^11.0.8",
  };

  const packageJsonContent = files["package.json"];
  let dependencies = baseDeps;
  if (packageJsonContent) {
    try {
      const parsed = JSON.parse(packageJsonContent);
      dependencies = { ...baseDeps, ...(parsed.dependencies || {}) };
    } catch {
      // Ignore
    }
  }

  // Convert standard files Record to Sandpack format
  const sandpackFiles = Object.entries(files).reduce((acc, [path, content]) => {
    // Strip the "src/" prefix for Sandpack, as it uses /App.tsx, /index.tsx etc.
    // Keep other paths (like package.json) as-is but with leading /
    const sandpackPath = path.startsWith("src/")
      ? `/${path.slice(4)}`
      : path.startsWith("/") 
        ? path 
        : `/${path}`;
    
    acc[sandpackPath] = content;
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="h-[800px] w-[1200px] pointer-events-none">
      <SandpackProvider
        template="react-ts"
        theme="dark"
        files={sandpackFiles}
        customSetup={{ dependencies }}
        options={{
          externalResources: [
            "https://cdn.tailwindcss.com",
            "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
          ],
        }}
      >
        {onLoad && <SandpackListener onLoad={onLoad} />}
        <SandpackLayout style={{ height: "100%", border: "none", borderRadius: 0 }}>
          <SandpackPreview
            showNavigator={false}
            showOpenInCodeSandbox={false}
            showRefreshButton={false}
            showRestartButton={false}
            className="h-full w-full border-none pointer-events-none [&>iframe]:pointer-events-none"
            style={{ height: "100%" }}
          />
        </SandpackLayout>
      </SandpackProvider>
    </div>
  );
});