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

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  SandpackProvider,
  SandpackPreview,
  SandpackLayout,
  useSandpack,
} from "@codesandbox/sandpack-react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  streamingContent?: string;
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
/**
 * Rewrites @/ alias imports to relative paths so Sandpack can resolve them.
 * e.g. `import X from "@/components/Y"` in src/App.tsx → `import X from "./components/Y"`
 * This is a client-side safety net — the worker should have already rewritten them,
 * but we do it here too to handle any edge cases (cached files, old versions, etc.)
 */
function rewriteAtAliasForSandpack(
  filePath: string,
  content: string
): string {
  if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) return content;

  // Determine directory of this file (relative to src/ root, since Sandpack strips src/)
  const fromDir = filePath.startsWith("src/")
    ? filePath.slice(4, filePath.lastIndexOf("/") + 1) // e.g. "components/"
    : filePath.slice(0, filePath.lastIndexOf("/") + 1);

  const resolveAlias = (target: string) => {
    // target is e.g. "components/Button" → file is at /components/Button.tsx in Sandpack
    // fromDir is e.g. "components/" (where the importing file lives)
    const fromParts = fromDir.split("/").filter(Boolean);
    const toParts = target.split("/").filter(Boolean);

    let commonLen = 0;
    while (
      commonLen < fromParts.length &&
      commonLen < toParts.length &&
      fromParts[commonLen] === toParts[commonLen]
    ) {
      commonLen++;
    }

    const ups = fromParts.length - commonLen;
    const rel = [
      ...Array(ups).fill(".."),
      ...toParts.slice(commonLen),
    ].join("/");

    return rel ? (rel.startsWith("..") ? rel : `./${rel}`) : ".";
  };

  return content
    .replace(/from\s+(['"])@\/([^'"]+)\1/g, (_m, q, target) => {
      return `from ${q}${resolveAlias(target)}${q}`;
    })
    .replace(/import\(\s*(['"])@\/([^'"]+)\1\s*\)/g, (_m, q, target) => {
      return `import(${q}${resolveAlias(target)}${q})`;
    });
}

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

    // Rewrite @/ aliases as safety net (worker should have already done this)
    const safeContent = rewriteAtAliasForSandpack(path, content);

    sandpackFiles[sandpackPath] = { code: safeContent };
  }

  return sandpackFiles;
}

/**
 * Listens for the 'webagt:shop-changed' window event (dispatched by ShopManagerPanel
 * after any product / inventory / shipping save) and refreshes the Sandpack preview
 * so the storefront re-fetches its data from Turso without a full page reload.
 *
 * Uses a ref for `dispatch` so the event handler never captures a stale closure,
 * even if Sandpack initializes clients asynchronously after the effect runs.
 */
function ShopRefreshListener() {
  const { dispatch, sandpack } = useSandpack();
  const dispatchRef = useRef(dispatch);

  // Keep the ref current without re-registering the event listener
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  useEffect(() => {
    const handler = () => {
      // Primary: use the stable dispatch ref (sends to all active Sandpack clients)
      try {
        dispatchRef.current({ type: "refresh" });
      } catch {
        // ignore if not ready
      }

      // Fallback: directly find the preview iframe and reload it
      try {
        const iframe = document.querySelector(".sp-preview-iframe") as HTMLIFrameElement | null;
        if (iframe?.contentWindow) {
          iframe.contentWindow.location.reload();
        }
      } catch {
        // cross-origin guard
      }
    };

    window.addEventListener("webagt:shop-changed", handler);
    return () => window.removeEventListener("webagt:shop-changed", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — handler uses ref, not sandpack directly

  return null;
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
 * "Built with WebAGT" badge shown in the Sandpack preview actions bar.
 * Uses inline styles instead of Tailwind because Sandpack's CSS-in-JS
 * (stitches) applies scoped styles with high specificity that override
 * Tailwind utility classes. React state drives the hover effect.
 */
function LovableBadge() {
  const [hovered, setHovered] = useState(false);

  return (
    <a
      href="https://webagt.ai"
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
      Built with WebAGT
    </a>
  );
}

/** Script injected into Sandpack to handle visual editing */
const INSPECTOR_SCRIPT = `
(function() {

  // ── Unsplash / broken image fallback ─────────────────────────────────────
  // Intercept ALL image load errors in the preview. If an image from Unsplash
  // (or any source) fails to load, replace it with a reliable Picsum photo
  // that matches the same dimensions, so the layout never breaks.
  function attachImageFallback(img) {
    if (img.dataset.fallbackAttached) return;
    img.dataset.fallbackAttached = '1';
    img.addEventListener('error', function() {
      if (img.dataset.fallbackApplied) return;
      img.dataset.fallbackApplied = '1';
      const w = img.naturalWidth || img.width || img.offsetWidth || 800;
      const h = img.naturalHeight || img.height || img.offsetHeight || 600;
      // Use a deterministic seed from the original src so rerenders stay stable
      const seed = encodeURIComponent((img.src || '').slice(-20).replace(/[^a-z0-9]/gi, '') || 'fallback');
      img.src = 'https://picsum.photos/seed/' + seed + '/' + Math.max(w, 100) + '/' + Math.max(h, 100);
    }, { once: true });
  }

  // Attach to all current images and watch for new ones added dynamically
  function scanImages() {
    document.querySelectorAll('img').forEach(attachImageFallback);
  }
  scanImages();
  const _imgObserver = new MutationObserver(scanImages);
  _imgObserver.observe(document.body, { childList: true, subtree: true });
  // ─────────────────────────────────────────────────────────────────────────

  let enabled = false;

  // Highlight overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;pointer-events:none;z-index:9999999;border:2px solid #8b5cf6;background:rgba(139,92,246,0.12);border-radius:3px;box-sizing:border-box;display:none;';
  document.body.appendChild(overlay);

  // Label shown inside overlay
  const overlayLabel = document.createElement('div');
  overlayLabel.style.cssText = 'position:absolute;top:-20px;left:0;background:#8b5cf6;color:#fff;font-size:10px;font-family:monospace;padding:1px 5px;border-radius:3px 3px 0 0;white-space:nowrap;pointer-events:none;';
  overlay.appendChild(overlayLabel);

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'SET_VISUAL_EDIT_MODE') {
      enabled = e.data.enabled;
      if (!enabled) overlay.style.display = 'none';
    }
  });

  /**
   * Use caretRangeFromPoint / caretPositionFromPoint to get the EXACT
   * text node the user's cursor is over. This text node's content is the
   * same literal string that lives in the JSX source, so matching is
   * always reliable.
   */
  function getTextNodeAt(x, y) {
    if (document.caretRangeFromPoint) {
      var r = document.caretRangeFromPoint(x, y);
      if (r && r.startContainer && r.startContainer.nodeType === 3) return r.startContainer;
    }
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      if (p && p.offsetNode && p.offsetNode.nodeType === 3) return p.offsetNode;
    }
    return null;
  }

  /**
   * Walk UP from el to the nearest element that owns at least one
   * non-empty direct text node. Falls back to el itself.
   */
  function nearestWithText(el) {
    var cur = el;
    while (cur && cur !== document.body) {
      for (var i = 0; i < cur.childNodes.length; i++) {
        if (cur.childNodes[i].nodeType === 3 && cur.childNodes[i].textContent.trim()) return cur;
      }
      cur = cur.parentElement;
    }
    return el;
  }

  /** Concatenate ONLY direct text nodes of el (no child-element text). */
  function directText(el) {
    var t = '';
    for (var i = 0; i < el.childNodes.length; i++) {
      if (el.childNodes[i].nodeType === 3) t += el.childNodes[i].textContent;
    }
    return t.trim();
  }

  document.addEventListener('mouseover', function(e) {
    if (!enabled) return;
    var t = e.target;
    if (t === document.body || t === document.documentElement || t === overlay) return;
    var rect = t.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.top = rect.top + 'px';
    overlay.style.left = rect.left + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    var tag = t.tagName ? t.tagName.toLowerCase() : '';
    var cls = t.className && typeof t.className === 'string' ? t.className.trim().split(' ')[0] : '';
    overlayLabel.textContent = tag + (cls ? '.' + cls : '');
  });

  document.addEventListener('mouseout', function(e) {
    if (!enabled) return;
    overlay.style.display = 'none';
  });

  document.addEventListener('click', function(e) {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    overlay.style.display = 'none';
    enabled = false;
    window.parent.postMessage({ type: 'VISUAL_EDIT_ENDED' }, '*');

    var target = e.target;

    // ── IMAGE ──────────────────────────────────────────────────────────────
    if (target.tagName === 'IMG') {
      var srcAttr = target.getAttribute('src') || '';
      var newSrc = prompt('Enter new image URL:', srcAttr);
      if (newSrc !== null && newSrc.trim() && newSrc.trim() !== srcAttr) {
        window.parent.postMessage({ type: 'DIRECT_SAVE_IMAGE', oldSrc: srcAttr, oldSrcResolved: target.src, newSrc: newSrc.trim() }, '*');
      }
      return;
    }

    // ── TEXT — Strategy 1: use caret API to get exact text node ────────────
    var textNode = getTextNodeAt(e.clientX, e.clientY);

    if (textNode && textNode.textContent.trim()) {
      var originalNodeText = textNode.textContent;
      var originalTrimmed = originalNodeText.trim();

      // Wrap just this text node in a temporary editable span so only it is
      // editable — no sibling or child element text bleeds in.
      var tempSpan = document.createElement('span');
      tempSpan.contentEditable = 'true';
      tempSpan.style.cssText = 'outline:2px dashed #8b5cf6;outline-offset:2px;border-radius:2px;min-width:2px;display:inline;';
      tempSpan.textContent = originalNodeText;
      textNode.parentNode.replaceChild(tempSpan, textNode);
      tempSpan.focus();

      try {
        var r = document.createRange();
        r.selectNodeContents(tempSpan);
        var s = window.getSelection();
        s.removeAllRanges();
        s.addRange(r);
      } catch(_) {}

      var done = false;
      var finish = function(save) {
        if (done) return;
        done = true;
        var newContent = tempSpan.textContent || '';
        var newNode = document.createTextNode(save ? newContent : originalNodeText);
        if (tempSpan.parentNode) tempSpan.parentNode.replaceChild(newNode, tempSpan);
        if (save && newContent.trim() !== originalTrimmed) {
          window.parent.postMessage({ type: 'DIRECT_SAVE_TEXT', oldText: originalTrimmed, newText: newContent.trim() }, '*');
        }
      };

      tempSpan.addEventListener('blur', function() { finish(true); }, { once: true });
      tempSpan.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); finish(true); }
        if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
      });
      return;
    }

    // ── TEXT — Strategy 2: direct text nodes of nearest text element ───────
    var textEl = nearestWithText(target);
    var origDirect = directText(textEl);
    if (!origDirect) return; // nothing editable

    textEl.contentEditable = 'true';
    textEl.style.outline = '2px dashed #8b5cf6';
    textEl.style.outlineOffset = '2px';
    textEl.style.borderRadius = '2px';
    textEl.focus();

    try {
      var r2 = document.createRange();
      r2.selectNodeContents(textEl);
      var s2 = window.getSelection();
      s2.removeAllRanges();
      s2.addRange(r2);
    } catch(_) {}

    textEl.addEventListener('blur', function() {
      var newDirect = directText(textEl);
      textEl.contentEditable = 'false';
      textEl.style.outline = '';
      textEl.style.outlineOffset = '';
      textEl.style.borderRadius = '';
      if (newDirect !== origDirect) {
        window.parent.postMessage({ type: 'DIRECT_SAVE_TEXT', oldText: origDirect, newText: newDirect }, '*');
      }
    }, { once: true });

    textEl.addEventListener('keydown', function(ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); textEl.blur(); }
      if (ev.key === 'Escape') {
        ev.preventDefault();
        textEl.contentEditable = 'false';
        textEl.style.outline = '';
        textEl.style.outlineOffset = '';
        textEl.style.borderRadius = '';
      }
    });

  }, true);

  // html2canvas for project thumbnails
  var scr = document.createElement('script');
  scr.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  scr.onload = function() {
    setTimeout(function() {
      if (window.html2canvas && document.body) {
        window.html2canvas(document.body, { scale: 0.5, useCORS: true, logging: false })
          .then(function(canvas) { window.parent.postMessage({ type: 'SAVE_THUMBNAIL', dataUrl: canvas.toDataURL('image/jpeg', 0.6) }, '*'); })
          .catch(function() {});
      }
    }, 4000);
  };
  document.head.appendChild(scr);
})();
`;
const inspectorUrl = "data:application/javascript;charset=utf-8," + encodeURIComponent(INSPECTOR_SCRIPT);


/**
 * PreviewPanel renders the project as a live React app using Sandpack.
 * The preview updates automatically when the files prop changes.
 *
 * @param files - Current project files to render in the preview
 */
// ─────────────────────────────────────────────────────────────────────────────
// Generation Overlay — shown while AI is streaming code
// ─────────────────────────────────────────────────────────────────────────────

const FILE_OPEN_RE = /<file\s+path="([^"]+)">/g;
const FILE_DONE_RE = /<file\s+path="([^"]+)">[\s\S]*?<\/file>/g;

/** Soft cap for progress bar — files beyond this still advance but more slowly */
const PROGRESS_SOFT_CAP = 20;

const FACTS_AND_QUOTES = [
  "The first website ever built was by Tim Berners-Lee in 1991 — it was just text.",
  "React was created by Jordan Walke at Facebook and open-sourced in 2013.",
  "Tailwind CSS processes millions of utility classes, but ships only the ones you actually use.",
  "The word 'bug' in software comes from an actual moth found in a relay of Harvard's Mark II computer in 1947.",
  "TypeScript has over 50 million weekly npm downloads — making it one of the most adopted languages.",
  "Turso (LibSQL) can serve database reads in under 1ms from edge locations worldwide.",
  "Stripe processed over $1 trillion in payments in 2023.",
  "A well-structured checkout flow can increase conversion rates by up to 35%.",
  "Mobile commerce accounts for more than 60% of global e-commerce traffic.",
  "The average page load time for top e-commerce sites is under 2 seconds.",
  "WebAssembly lets browsers run code at near-native speed — opening the door to full apps in the browser.",
  "Sandpack (powering this preview) runs a full Node.js-compatible bundler entirely inside your browser.",
  "Cloudflare Workers execute at over 200 edge locations around the world, usually under 10ms cold start.",
  "The first online purchase was a Pepperoni pizza ordered via Pizza Hut's website in 1994.",
  "Product images with white backgrounds have a 20% higher conversion rate than lifestyle shots.",
  "Great copy on a CTA button can increase clicks by up to 90% versus generic 'Click here'.",
  "Free shipping is the #1 reason shoppers complete a purchase online.",
  "The WCAG guidelines ensure websites are accessible to the 1.3 billion people with disabilities worldwide.",
  "Dark mode reduces eye strain and can lower battery usage on OLED screens by up to 63%.",
  "localStorage can hold up to 5–10 MB of data per origin — great for offline-first features.",
  "CSS Grid was designed to solve the problem that float-based layouts were never meant to solve.",
  "'use client' in Next.js opts a component into the React tree running in the browser.",
  "Next.js App Router uses React Server Components by default — JS that never reaches the browser.",
  "Lighthouse scores above 90 in all categories correlate with 25% better e-commerce conversion.",
  "The average cart abandonment rate is 70% — mostly due to unexpected shipping costs.",
  "Personalized product recommendations can increase average order value by 10–30%.",
  "Resend delivers transactional emails using the same infrastructure that powers Vercel.",
  "An SEO-optimized product title can make you 4× more discoverable on Google Shopping.",
  "Edge functions execute geographically close to the user — slashing latency globally.",
  "Open Graph meta tags are what make your links look rich when shared on WhatsApp or Slack.",
  "\"Any application that can be written in JavaScript, will eventually be written in JavaScript.\" — Jeff Atwood",
  "\"The best interface is no interface.\" — Golden Krishna",
  "\"Make it work, make it right, make it fast.\" — Kent Beck",
  "\"Simplicity is the ultimate sophistication.\" — Leonardo da Vinci",
  "\"Programs must be written for people to read, and only incidentally for machines to execute.\" — Harold Abelson",
  "\"First, solve the problem. Then, write the code.\" — John Johnson",
  "\"The most disruptive thing you can do is ship something.\" — unknown",
  "\"Design is not just what it looks like. Design is how it works.\" — Steve Jobs",
  "\"There are only two hard things in computer science: cache invalidation and naming things.\" — Phil Karlton",
  "\"Move fast and fix things.\" — the modern engineering philosophy",
  "\"Code is like humor. When you have to explain it, it's bad.\" — Cory House",
  "\"The best error message is the one that never shows up.\" — Thomas Fuchs",
  "\"Talk is cheap. Show me the code.\" — Linus Torvalds",
  "\"Every great design begins with an even better story.\" — Lorinda Mamo",
  "\"The details are not the details. They make the design.\" — Charles Eames",
  "\"Speed is a feature.\" — Fred Wilson",
  "\"You can't use up creativity. The more you use the more you have.\" — Maya Angelou",
  "\"Strive not to be a success, but rather to be of value.\" — Albert Einstein",
  "\"Done is better than perfect.\" — Sheryl Sandberg",
  "\"Accessibility is not a feature — it's a baseline.\" — unknown",
];

function GenerationOverlay({ streamingContent }: { streamingContent: string }) {
  const [factIndex, setFactIndex] = useState(() => Math.floor(Math.random() * FACTS_AND_QUOTES.length));
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate facts every 4 seconds with a fade transition
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setFactIndex((i) => (i + 1) % FACTS_AND_QUOTES.length);
        setVisible(true);
      }, 400);
    }, 4000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  // Parse file progress from streaming content
  const { doneCount, totalCount, phase } = useMemo(() => {
    const opened: string[] = [];
    FILE_OPEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FILE_OPEN_RE.exec(streamingContent)) !== null) opened.push(m[1]);

    const done = new Set<string>();
    FILE_DONE_RE.lastIndex = 0;
    while ((m = FILE_DONE_RE.exec(streamingContent)) !== null) done.add(m[1]);

    const unique = [...new Set(opened)];
    const doneCount = unique.filter(p => done.has(p)).length;
    const totalCount = unique.length;
    const phase = totalCount === 0 ? "thinking" : "writing";
    return { doneCount, totalCount, phase };
  }, [streamingContent]);

  // Smooth progress: thinking=8%, each file done advances the bar
  // Uses a soft cap so it never claims to be "done" before streaming ends
  const progressPct = useMemo(() => {
    if (phase === "thinking") return 8;
    // Each completed file moves the bar, but it asymptotically approaches ~90%
    const fraction = doneCount / (doneCount + PROGRESS_SOFT_CAP);
    return 15 + fraction * 75;
  }, [phase, doneCount]);

  const fact = FACTS_AND_QUOTES[factIndex];
  const isQuote = fact.startsWith('"');

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-md px-8 flex flex-col items-center gap-8">
        {/* Icon */}
        <div className="relative">
          <div className="absolute -inset-3 rounded-full bg-primary/10 animate-pulse" />
          <div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Sparkles className="size-7 text-primary animate-pulse" />
          </div>
        </div>

        {/* Status */}
        <div className="text-center space-y-1.5">
          {phase === "thinking" ? (
            <>
              <h3 className="text-base font-semibold tracking-tight">
                Thinking
                <span className="inline-flex w-6 ml-0.5">
                  <span className="animate-[dotPulse_1.4s_infinite]">.</span>
                  <span className="animate-[dotPulse_1.4s_0.2s_infinite]">.</span>
                  <span className="animate-[dotPulse_1.4s_0.4s_infinite]">.</span>
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">Planning your project structure</p>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold tracking-tight">
                Building your project
                <span className="inline-flex w-6 ml-0.5">
                  <span className="animate-[dotPulse_1.4s_infinite]">.</span>
                  <span className="animate-[dotPulse_1.4s_0.2s_infinite]">.</span>
                  <span className="animate-[dotPulse_1.4s_0.4s_infinite]">.</span>
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">Writing files, just a moment</p>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-full space-y-2">
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            {/* Shimmer on the unfilled portion */}
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{phase === "thinking" ? "Analyzing your request" : "Generating"}</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
        </div>

        {/* File pills — show up to 5 recent files */}
        {totalCount > 0 && (
          <div className="flex flex-wrap justify-center gap-1.5 max-w-sm">
            {[...new Set(
              [...streamingContent.matchAll(/<file\s+path="([^"]+)">/g)].map(m => m[1])
            )].slice(-6).map(path => {
              const name = path.split("/").pop() || path;
              const done = FILE_DONE_RE.test(streamingContent.slice(streamingContent.lastIndexOf(`path="${path}">`)));
              FILE_DONE_RE.lastIndex = 0;
              return (
                <span
                  key={path}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono transition-colors",
                    "border-border bg-muted/40 text-muted-foreground"
                  )}
                >
                  {name}
                </span>
              );
            })}
          </div>
        )}

        {/* Did you know / quote */}
        <div
          className={cn(
            "w-full rounded-xl border border-border/50 bg-card/60 p-4 transition-opacity duration-400",
            visible ? "opacity-100" : "opacity-0",
          )}
        >
          {isQuote ? (
            <div className="space-y-1.5">
              <p className="text-xs leading-relaxed text-foreground/80 italic">{fact}</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/70">Did you know?</p>
              <p className="text-xs leading-relaxed text-foreground/80">{fact}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Forces staggered Sandpack refreshes when streaming transitions from true→false,
 * then signals PreviewPanel to dismiss the overlay once the preview is ready.
 *
 * Multiple refresh waves handle:
 * 1. Sandpack needing time to process the new files prop
 * 2. The generated app's seed() function needing time to insert DB data
 * 3. Edge cases where the first refresh fires before Sandpack is ready
 */
function StreamEndRefresher({
  isStreaming,
  onReady,
}: {
  isStreaming: boolean;
  onReady: () => void;
}) {
  const { dispatch, listen } = useSandpack();
  const wasStreamingRef = useRef(false);

  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
      return;
    }

    if (!wasStreamingRef.current) return;
    wasStreamingRef.current = false;

    const timers: ReturnType<typeof setTimeout>[] = [];

    const doRefresh = () => {
      try { dispatch({ type: "refresh" }); } catch {}
      try {
        const iframe = document.querySelector(".sp-preview-iframe") as HTMLIFrameElement | null;
        if (iframe?.contentWindow) iframe.contentWindow.location.reload();
      } catch {}
    };

    // Wave 1: immediate Sandpack dispatch (files are already set via props)
    try { dispatch({ type: "refresh" }); } catch {}

    // Wave 2: after 800ms — Sandpack has had time to process the new file props
    timers.push(setTimeout(doRefresh, 800));

    // Wave 3: after 2.5s — seed() has likely finished inserting products
    timers.push(setTimeout(doRefresh, 2500));

    // Listen for Sandpack "done" event after wave 3
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      onReady();
    };

    const unsub = listen((msg) => {
      const type = (msg as any).type;
      if (type === "done" || type === "success") {
        // Only settle after wave 3 has fired to ensure seed() completed
        timers.push(setTimeout(settle, 500));
      }
    });

    // Safety net: dismiss overlay after 5 seconds no matter what
    timers.push(setTimeout(settle, 5000));

    return () => {
      unsub();
      timers.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStreaming]);

  return null;
}

export function PreviewPanel({ files, onError, isStreaming, onFilesChange, streamingContent = "" }: PreviewPanelProps) {
  const sandpackFiles = toSandpackFiles(files);
  const dependencies = extractDependencies(files);

  // Keep the overlay visible until Sandpack has rebuilt after streaming ends
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayFading, setOverlayFading] = useState(false);

  useEffect(() => {
    if (isStreaming) {
      setShowOverlay(true);
      setOverlayFading(false);
    }
  }, [isStreaming]);

  const handlePreviewReady = useCallback(() => {
    setOverlayFading(true);
    const t = setTimeout(() => { setShowOverlay(false); setOverlayFading(false); }, 500);
    return () => clearTimeout(t);
  }, []);

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
        toast.info("Payments are not available in the live preview. Publish your shop to test checkout.");
      }
      
      if (e.data && (e.data.type === 'DIRECT_SAVE_TEXT' || e.data.type === 'DIRECT_SAVE_IMAGE')) {
        if (!onFilesChange) return;
        
        const newFiles = { ...files };
        let found = false;

        /**
         * Sort file entries so component files (.tsx/.jsx) are checked first,
         * then .ts/.js, then .html, and configuration files like package.json last.
         * This prevents short strings matching in the wrong file.
         */
        function filePriority(path: string): number {
          if (/\.(tsx|jsx)$/i.test(path)) return 0;
          if (/\.(ts|js)$/i.test(path)) return 1;
          if (/\.html?$/i.test(path)) return 2;
          if (/package\.json$/i.test(path)) return 99;
          return 3;
        }

        const sortedPaths = Object.keys(newFiles)
          .filter(p => !/package\.json$/i.test(p))
          .sort((a, b) => filePriority(a) - filePriority(b));
        
        if (e.data.type === 'DIRECT_SAVE_TEXT') {
          const oldTextRaw = (e.data.oldText || '') as string;
          const newText = (e.data.newText || '') as string;
          const oldTextTrimmed = oldTextRaw.trim();
          
          if (!oldTextTrimmed) return;

          function scoreMatch(content: string, index: number, length: number): number {
            let score = 0;
            const before = content.slice(Math.max(0, index - 15), index);
            const after = content.slice(index + length, index + length + 15);
            
            // 1. Inside JSX tags: > text <
            if (/>\s*$/.test(before)) score += 10;
            if (/^\s*</.test(after)) score += 10;
            
            // 2. Inside quotes: ="text" or "text" or `text`
            if (/=\s*["'\`]$/.test(before)) score += 8;
            else if (/["'\`]$/.test(before)) score += 5;
            if (/^["'\`]/.test(after)) score += 5;
            
            // 3. Inside curly braces: {"text"}
            if (/\{\s*["'\`]$/.test(before)) score += 8;
            if (/^["'\`]\s*\}/.test(after)) score += 8;
            
            // 4. PENALTY: Part of a word/variable name
            if (/[a-zA-Z0-9_]$/.test(before)) score -= 20;
            if (/^[a-zA-Z0-9_]/.test(after)) score -= 20;
            
            // 5. PENALTY: Inside an import statement
            const lineStart = content.lastIndexOf('\n', index - 1);
            const line = content.slice(lineStart === -1 ? 0 : lineStart, index);
            if (/^\s*import\s+/.test(line)) score -= 50;
            
            return score;
          }

          function findAllMatches(content: string, oldRaw: string, oldTrimmed: string) {
            const matches: { index: number, length: number, score: number }[] = [];
            const seen = new Set<number>();
            
            const addMatch = (idx: number, len: number) => {
              if (seen.has(idx)) return;
              seen.add(idx);
              matches.push({ index: idx, length: len, score: scoreMatch(content, idx, len) });
            };
            
            // 1. Raw exact match
            if (oldRaw) {
              let i = -1;
              while ((i = content.indexOf(oldRaw, i + 1)) !== -1) addMatch(i, oldRaw.length);
            }
            
            // 2. Trimmed exact match
            if (oldTrimmed && oldTrimmed !== oldRaw) {
              let i = -1;
              while ((i = content.indexOf(oldTrimmed, i + 1)) !== -1) addMatch(i, oldTrimmed.length);
            }
            
            // 3. Regex match (handles entities and JSX whitespace)
            if (oldTrimmed.length >= 2) {
              try {
                let pattern = oldTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                pattern = pattern.replace(/\s+/g, '\\s+');
                pattern = pattern.replace(/'/g, `(?:'|&apos;|&#39;|&rsquo;|&lsquo;|\\{['"]'['"]\\})`);
                pattern = pattern.replace(/"/g, `(?:"|&quot;|&#34;|&rdquo;|&ldquo;|\\{['"]"['"]\\})`);
                pattern = pattern.replace(/&/g, `(?:&|&amp;|&#38;)`);
                pattern = pattern.replace(/</g, `(?:<|&lt;|&#60;)`);
                pattern = pattern.replace(/>/g, `(?:>|&gt;|&#62;)`);
                
                const rx = new RegExp(pattern, 'gi');
                let m;
                while ((m = rx.exec(content)) !== null) {
                  addMatch(m.index, m[0].length);
                }
              } catch {}
            }
            return matches;
          }

          let bestMatch: { path: string; index: number; length: number; score: number } | null = null;

          for (const path of sortedPaths) {
            const content = newFiles[path];
            const matches = findAllMatches(content, oldTextRaw, oldTextTrimmed);
            
            for (const m of matches) {
              if (!bestMatch || m.score > bestMatch.score) {
                bestMatch = { path, index: m.index, length: m.length, score: m.score };
              }
            }
          }

          // Apply replacement if we found a reasonable match
          // Allow negative scores if it's the ONLY match we found and it's exact
          if (bestMatch && (bestMatch.score > -20 || bestMatch.length === oldTextRaw.length)) {
            const content = newFiles[bestMatch.path];
            newFiles[bestMatch.path] = 
              content.slice(0, bestMatch.index) + 
              newText + 
              content.slice(bestMatch.index + bestMatch.length);
            found = true;
          }
        } else if (e.data.type === 'DIRECT_SAVE_IMAGE') {
          const oldSrc = (e.data.oldSrc || '') as string;          // raw attribute value
          const oldSrcResolved = (e.data.oldSrcResolved || '') as string; // resolved URL
          const newSrc = (e.data.newSrc || '') as string;
          
          if (!newSrc) return;

          for (const path of sortedPaths) {
            const content = newFiles[path];

            // 1. Match the raw attribute src value
            if (oldSrc && content.includes(oldSrc)) {
              newFiles[path] = content.split(oldSrc).join(newSrc);
              found = true;
              break;
            }

            // 2. Match just the pathname of the resolved URL
            if (oldSrcResolved) {
              try {
                const url = new URL(oldSrcResolved);
                const pathname = url.pathname + url.search;
                if (pathname.length > 1 && content.includes(pathname)) {
                  newFiles[path] = content.split(pathname).join(newSrc);
                  found = true;
                  break;
                }
              } catch {
                // Not a valid URL — skip
              }
            }
          }
        }

        if (found) {
          onFilesChange(newFiles);
          toast.success("Saved instantly!");
        } else {
          toast.error("Text not found in source — this usually means it comes from a variable or prop. Use the AI chat to update it instead.");
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [files, onFilesChange]);

  return (
    <div className="sandpack-stretch h-full w-full relative">
      {/* Rich generation overlay — stays visible until Sandpack finishes rebuilding */}
      {showOverlay && (
        <div className={cn("transition-opacity duration-500", overlayFading ? "opacity-0" : "opacity-100")}>
          <GenerationOverlay streamingContent={streamingContent} />
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

        {/* Refresh the preview when Shop Manager data changes (new product, stock update, etc.) */}
        <ShopRefreshListener />

        {/* Force refresh when streaming ends, then signal overlay dismissal */}
        <StreamEndRefresher isStreaming={!!isStreaming} onReady={handlePreviewReady} />

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
