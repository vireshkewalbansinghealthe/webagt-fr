export interface ImageAttachment {
  base64: string;
  mediaType: string;
  name?: string;
  url?: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  creditsUsed: number;
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
  suggestions?: string[];
  tokenUsage?: TokenUsage;
}

export interface ChatSession {
  projectId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
