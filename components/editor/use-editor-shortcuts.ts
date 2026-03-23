/**
 * components/editor/use-editor-shortcuts.ts
 *
 * Custom hook that registers global keyboard shortcuts for the editor view.
 * Listens for key combinations and triggers the corresponding actions.
 *
 * Shortcuts:
 * - Cmd/Ctrl + P — Toggle between Preview and Code tabs
 * - Cmd/Ctrl + B — Toggle History tab
 *
 * Shortcuts are disabled when the user is typing in an input, textarea,
 * or contenteditable element to avoid conflicting with text editing.
 *
 * Used by: components/editor/editor-layout.tsx
 */

import { useEffect, useCallback } from "react";
import type { EditorTabValue } from "./editor-tabs";

/**
 * Options for the useEditorShortcuts hook.
 *
 * @property activeTab - Currently selected tab
 * @property onTabChange - Callback to switch tabs
 */
interface UseEditorShortcutsOptions {
  activeTab: EditorTabValue;
  onTabChange: (tab: EditorTabValue) => void;
}

/**
 * Checks whether the active element is a text input area.
 * If so, keyboard shortcuts should be suppressed to avoid
 * interfering with typing.
 *
 * @returns true if the user is typing in an input/textarea
 */
function isTypingInInput(): boolean {
  const element = document.activeElement;
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea") return true;
  if ((element as HTMLElement).contentEditable === "true") return true;

  return false;
}

/**
 * useEditorShortcuts registers keyboard shortcuts for the editor view.
 * Cleans up the event listener on unmount.
 *
 * @param options - Active tab state and tab change callback
 */
export function useEditorShortcuts({
  activeTab,
  onTabChange,
}: UseEditorShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isModifier = event.metaKey || event.ctrlKey;
      if (!isModifier) return;

      // Skip if user is typing in an input field
      if (isTypingInInput()) return;

      switch (event.key.toLowerCase()) {
        case "p": {
          // Cmd/Ctrl + P — Toggle between Preview and Code
          event.preventDefault();
          onTabChange(activeTab === "preview" ? "code" : "preview");
          break;
        }
        case "b": {
          // Cmd/Ctrl + B — Toggle History panel
          event.preventDefault();
          onTabChange(activeTab === "history" ? "preview" : "history");
          break;
        }
      }
    },
    [activeTab, onTabChange]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
