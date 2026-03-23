/**
 * components/editor/chat-panel.tsx
 *
 * The left panel of the editor view — shows the chat conversation
 * between the user and AI. Contains:
 * 1. A scrollable message list (MessageBubble components)
 * 2. A chat input at the bottom (ChatInput component)
 *
 * The panel auto-scrolls to the bottom when new messages arrive
 * or when streaming content updates. The project header has been
 * moved to the EditorHeader component.
 *
 * Used by: components/editor/editor-layout.tsx
 */

"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage, ImageAttachment } from "@/types/chat";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { ModelSelector } from "./model-selector";
import { UpgradeCTA } from "./upgrade-cta";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Code, MessageSquare } from "lucide-react";
import { getModelById } from "@/lib/models";

/**
 * Props for the ChatPanel component.
 *
 * @property messages - Array of chat messages to display
 * @property isStreaming - Whether AI is currently generating a response
 * @property onSendMessage - Callback when user submits a new message
 * @property creditsRemaining - Credits left (-1 = unlimited, undefined = loading)
 * @property isCreditsExhausted - Whether the user has 0 credits left
 * @property selectedModelId - Currently selected AI model ID
 * @property onModelChange - Callback when user switches model
 * @property userPlan - User's plan for model gating ("free" or "pro")
 */
export interface ChatPanelProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSendMessage: (message: string, images?: ImageAttachment[]) => void;
  creditsRemaining?: number;
  isCreditsExhausted?: boolean;
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
  userPlan: "free" | "pro";
}

/**
 * ChatPanel renders the chat interface: message list and input.
 * Messages auto-scroll to the bottom as new content arrives.
 * The project name header has moved to EditorHeader.
 *
 * @param messages - The chat history to render
 * @param isStreaming - Disables input and shows cursor on last AI message
 * @param onSendMessage - Called when user submits a prompt
 */
export function ChatPanel({
  messages,
  isStreaming,
  onSendMessage,
  creditsRemaining,
  isCreditsExhausted,
  selectedModelId,
  onModelChange,
  userPlan,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /** Check if the currently selected model supports vision (image input) */
  const selectedModel = getModelById(selectedModelId);
  const supportsVision = selectedModel?.supportsVision ?? false;

  /**
   * Auto-scroll to the bottom of the message list
   * whenever messages change or streaming content updates.
   */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Message list — scrollable area */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="flex flex-col gap-5 p-4">
          {/* Empty state when no messages */}
          {messages.length === 0 && (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
              {/* Glowing icon */}
              <div className="relative mb-5">
                <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
                <div className="relative flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <Sparkles className="size-7 text-primary" />
                </div>
              </div>

              <h3 className="text-base font-semibold text-foreground">
                What do you want to build?
              </h3>
              <p className="mt-2 max-w-[260px] text-sm leading-relaxed text-muted-foreground">
                Describe your app and the AI will generate working code with a live preview.
              </p>

              {/* Suggestion chips */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {[
                  { icon: Code, label: "A landing page" },
                  { icon: MessageSquare, label: "A chat app" },
                ].map((suggestion) => (
                  <button
                    key={suggestion.label}
                    onClick={() => onSendMessage(suggestion.label)}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                  >
                    <suggestion.icon className="size-3" />
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Render each message */}
          {messages.map((message, index) => (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={
                isStreaming &&
                message.role === "assistant" &&
                index === messages.length - 1
              }
              isAutoHealInProgress={
                isStreaming &&
                message.role === "user" &&
                index === messages.length - 2
              }
            />
          ))}

          {/* Invisible anchor for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Upgrade CTA — shown when credits exhausted */}
      {isCreditsExhausted && (
        <div className="border-t border-border p-3">
          <UpgradeCTA reason="You've used all 50 free messages this month." />
        </div>
      )}

      {/* Model selector + Chat input — at the bottom */}
      {!isCreditsExhausted && (
        <div className="border-t border-border/50 bg-card/50 backdrop-blur-sm">
          {/* Model selector — sits above the input */}
          <div className="px-3 pt-2">
            <ModelSelector
              selectedModelId={selectedModelId}
              onModelChange={onModelChange}
              userPlan={userPlan}
              disabled={isStreaming}
            />
          </div>

          <ChatInput
            onSend={onSendMessage}
            isStreaming={isStreaming}
            creditsRemaining={creditsRemaining}
            isCreditsExhausted={isCreditsExhausted}
            supportsVision={supportsVision}
          />
        </div>
      )}
    </div>
  );
}
