/**
 * components/editor/chat-input.tsx
 *
 * Message input for the editor's chat panel.
 * Provides a textarea where users type their prompts for AI generation.
 *
 * Behaviors:
 * - Enter sends the message
 * - Shift+Enter adds a newline
 * - Disabled while AI is streaming
 * - Auto-focuses on mount
 * - Shows the send button which is only active when there's content
 *
 * Used by: components/editor/chat-panel.tsx
 */

"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SendHorizontal, Clock, Paperclip, X, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRateLimit } from "@/components/rate-limit-provider";
import { toast } from "sonner";
import type { ImageAttachment } from "@/types/chat";

/**
 * Props for the ChatInput component.
 *
 * @property onSend - Callback when the user submits a message
 * @property isStreaming - Whether AI is currently generating (disables input)
 * @property creditsRemaining - Number of credits remaining (-1 = unlimited, undefined = loading)
 * @property isCreditsExhausted - Whether the user has 0 credits left
 */
/** Maximum number of images per message */
const MAX_IMAGES = 5;
/** Maximum image file size in bytes (4MB) */
const MAX_IMAGE_SIZE = 4 * 1024 * 1024;
/** Accepted image MIME types */
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export interface ChatInputProps {
  onSend: (message: string, images?: ImageAttachment[]) => void;
  isStreaming: boolean;
  creditsRemaining?: number;
  isCreditsExhausted?: boolean;
  supportsVision?: boolean;
  draftMessage?: { id: number; text: string } | null;
}

/**
 * ChatInput renders a textarea with a send button for submitting
 * prompts to the AI. Handles keyboard shortcuts and auto-resize.
 *
 * @param onSend - Called with the message text when user submits
 * @param isStreaming - Disables input when true
 */
export function ChatInput({
  onSend,
  isStreaming,
  creditsRemaining,
  isCreditsExhausted = false,
  supportsVision = false,
  draftMessage = null,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [isVisualEditMode, setIsVisualEditMode] = useState(false);

  /** Global rate limit state from context (shared across all routes) */
  const { isRateLimited, rateLimitSeconds } = useRateLimit();

  /** Listen for visual edit mode toggle events */
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

  /** Auto-focus the textarea when the component mounts */
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!draftMessage) return;
    setValue(draftMessage.text);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = draftMessage.text.length;
      textarea.setSelectionRange(end, end);
    });
  }, [draftMessage]);

  /**
   * Auto-resize the textarea height based on content.
   * Resets to auto first to shrink if content was deleted,
   * then sets to scrollHeight (capped at max via CSS).
   */
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  /**
   * Reads a File as base64 and validates type/size.
   * Returns an ImageAttachment or null on error.
   */
  const processFile = useCallback(
    async (file: File): Promise<ImageAttachment | null> => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error("Only PNG, JPEG, GIF, and WebP images are supported.");
        return null;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error("Image must be under 4MB.");
        return null;
      }

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          // Strip the "data:image/...;base64," prefix
          const base64 = dataUrl.split(",")[1];
          resolve({
            base64,
            mediaType: file.type,
            name: file.name,
          });
        };
        reader.onerror = () => {
          toast.error("Failed to read image file.");
          resolve(null);
        };
        reader.readAsDataURL(file);
      });
    },
    []
  );

  /** Handles files from the file picker or drop */
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const remaining = MAX_IMAGES - attachedImages.length;
      const filesToProcess = Array.from(files).slice(0, remaining);

      if (Array.from(files).length > remaining) {
        toast.error(`Maximum ${MAX_IMAGES} images per message.`);
      }

      const results = await Promise.all(filesToProcess.map(processFile));
      const valid = results.filter(Boolean) as ImageAttachment[];
      if (valid.length > 0) {
        setAttachedImages((prev) => [...prev, ...valid]);
      }
    },
    [attachedImages.length, processFile]
  );

  /** File picker change handler */
  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        handleFiles(event.target.files);
        // Reset the input so the same file can be selected again
        event.target.value = "";
      }
    },
    [handleFiles]
  );

  /** Clipboard paste handler — intercepts image pastes */
  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      if (!supportsVision) return;
      const items = event.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        event.preventDefault();
        handleFiles(imageFiles);
      }
    },
    [supportsVision, handleFiles]
  );

  /** Drag-and-drop handlers */
  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!supportsVision) return;

      const imageFiles: File[] = [];
      for (const file of Array.from(event.dataTransfer.files)) {
        if (file.type.startsWith("image/")) {
          imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        handleFiles(imageFiles);
      }
    },
    [supportsVision, handleFiles]
  );

  /** Remove an attached image by index */
  const removeImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Handles sending the message.
   * Trims whitespace, sends if non-empty, then clears the input and images.
   */
  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && attachedImages.length === 0) || isStreaming || isCreditsExhausted || isRateLimited) return;
    onSend(trimmed || "Describe this image", attachedImages.length > 0 ? attachedImages : undefined);
    setValue("");
    setAttachedImages([]);
  }, [value, attachedImages, isStreaming, isCreditsExhausted, isRateLimited, onSend]);

  /**
   * Keyboard handler: Enter sends, Shift+Enter adds newline.
   * Prevents default Enter behavior (which would add a newline).
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const hasContent = value.trim().length > 0 || attachedImages.length > 0;
  const isDisabled = isStreaming || isCreditsExhausted || isRateLimited;

  /** Format the credits label for the bottom-right of the input */
  const creditsLabel =
    creditsRemaining === undefined
      ? null
      : creditsRemaining === -1
        ? null
        : `${creditsRemaining} credits`;

  return (
    <div
      className="px-3 pb-3 pt-1.5"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div
        className={cn(
          "flex flex-col rounded-xl border border-border/50 bg-background transition-colors focus-within:border-primary/30 focus-within:ring-1 focus-within:ring-primary/10",
          isCreditsExhausted && "border-destructive/30 focus-within:border-destructive/30 focus-within:ring-destructive/10",
          isRateLimited && "border-amber-500/30 focus-within:border-amber-500/30 focus-within:ring-amber-500/10"
        )}
      >
        {/* Image thumbnail strip — shown when images are attached */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-3 pt-2">
            {attachedImages.map((img, index) => (
              <div
                key={index}
                className="group/thumb relative size-14 shrink-0 overflow-hidden rounded-lg border border-border/50"
              >
                <img
                  src={`data:${img.mediaType};base64,${img.base64}`}
                  alt={img.name || "Attached image"}
                  className="size-full object-cover"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity group-hover/thumb:opacity-100"
                >
                  <X className="size-2.5" />
                </button>
              </div>
            ))}

            {/* Image count indicator */}
            <span className={cn(
              "text-[11px] font-medium",
              attachedImages.length >= MAX_IMAGES
                ? "text-amber-500"
                : "text-muted-foreground/60"
            )}>
              {attachedImages.length}/{MAX_IMAGES}
            </span>
          </div>
        )}

        <div className="flex items-end gap-2 px-3 py-2">
          {/* Paperclip button — only shown when model supports vision */}
          {supportsVision && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled || attachedImages.length >= MAX_IMAGES}
              className="shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
              title="Attach image"
            >
              <Paperclip className="size-3.5" />
            </Button>
          )}

          {/* Visual Editor button */}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-visual-edit"))}
            disabled={isDisabled}
            className={cn(
              "shrink-0 rounded-lg transition-colors",
              isVisualEditMode
                ? "bg-primary/20 text-primary hover:bg-primary/30 hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Visual Editor"
          >
            <Wand2 className="size-3.5" />
          </Button>

          {/* Hidden file input for image selection */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Textarea for prompt input */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              isCreditsExhausted
                ? "You've run out of credits"
                : isRateLimited
                  ? "Rate limited — please wait..."
                  : isStreaming
                    ? "AI is generating..."
                    : "Describe what you want to build..."
            }
            disabled={isDisabled}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none",
              "min-h-[24px] max-h-[200px]",
              isDisabled && "opacity-50 cursor-not-allowed"
            )}
          />

          {/* Send button — only clickable when there's content and credits */}
          <Button
            size="icon-xs"
            onClick={handleSend}
            disabled={!hasContent || isDisabled}
            className={cn(
              "shrink-0 rounded-lg transition-all duration-150",
              hasContent && !isDisabled
                ? "opacity-100 scale-100"
                : "opacity-30 scale-95"
            )}
          >
            <SendHorizontal className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Rate limit banner — shown when the user hit a 429 */}
      {isRateLimited && (
        <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-500">
          <Clock className="size-3.5 shrink-0" />
          <span>Rate limited — try again in {rateLimitSeconds}s</span>
        </div>
      )}

      {/* Hint text with optional credit counter */}
      {!isRateLimited && (
        <div className="mt-1.5 flex items-center justify-between px-0.5 text-[10px] text-muted-foreground/50">
          <span>
            {isCreditsExhausted
              ? "Upgrade to Pro for unlimited messages"
              : "Enter to send \u00B7 Shift+Enter for new line"}
          </span>
          {creditsLabel && <span>{creditsLabel}</span>}
        </div>
      )}
    </div>
  );
}
