/**
 * types/chat.ts
 *
 * TypeScript interfaces for chat messages and sessions.
 * Chat messages represent the conversation between the user and AI
 * in the editor view. Each message can be linked to a project version.
 *
 * Used by: editor chat panel, chat API routes, worker chat endpoint
 */

/**
 * A single message in the chat conversation.
 * User messages contain the prompt, assistant messages contain
 * the AI's response (which may include generated code).
 *
 * @property id - Unique identifier for the message
 * @property role - Who sent the message: the user or the AI assistant
 * @property content - The text content of the message
 * @property timestamp - ISO 8601 timestamp of when the message was sent
 * @property versionNumber - The project version this message created (assistant messages only)
 * @property model - The AI model that generated this response (assistant messages only)
 * @property changedFiles - File paths that were created/modified in this generation (assistant messages only)
 */
/**
 * An image attached to a chat message for vision-capable AI models.
 * Images are stored as base64-encoded strings alongside their MIME type.
 *
 * @property base64 - Base64-encoded image data (no data URI prefix)
 * @property mediaType - MIME type (e.g., "image/png", "image/jpeg")
 * @property name - Optional original filename for display
 */
export interface ImageAttachment {
  base64: string;
  mediaType: string;
  name?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  versionNumber?: number;
  model?: string;
  changedFiles?: string[];
  images?: ImageAttachment[];
}

/**
 * A complete chat session for a project.
 * Stores all messages exchanged in a project's editor view.
 * Persisted in KV as `chat:{projectId}`.
 *
 * @property projectId - The project this chat belongs to
 * @property messages - Ordered list of all chat messages
 * @property createdAt - ISO 8601 timestamp of session creation
 * @property updatedAt - ISO 8601 timestamp of last message
 */
export interface ChatSession {
  projectId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
