const MAX_CHAT_MESSAGE_LENGTH = 10000;

export function sanitizeChatMessage(message: string): string {
  return message
    .trim()
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "")
    .slice(0, MAX_CHAT_MESSAGE_LENGTH);
}
