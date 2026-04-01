export interface ImageAttachment {
  base64: string;
  mediaType: string;
  name?: string;
  url?: string;
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
}

export interface ChatSession {
  projectId: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
