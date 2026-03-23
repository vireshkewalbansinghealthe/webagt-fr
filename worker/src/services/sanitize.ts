/**
 * worker/src/services/sanitize.ts
 *
 * Input sanitization utilities for user-provided data.
 * Prevents XSS, injection, and abuse by cleaning and validating
 * all external input before processing or storage.
 *
 * Used by: worker/src/routes/projects.ts, worker/src/routes/chat.ts
 */

/** Maximum allowed length for project names */
const MAX_PROJECT_NAME_LENGTH = 100;

/** Maximum allowed length for chat messages */
const MAX_CHAT_MESSAGE_LENGTH = 10000;

/**
 * Sanitizes a project name by:
 * - Trimming whitespace
 * - Stripping HTML tags
 * - Removing control characters
 * - Truncating to max length
 *
 * @param name - Raw project name input
 * @returns Sanitized project name
 */
export function sanitizeProjectName(name: string): string {
  return name
    .trim()
    .replace(/<[^>]*>/g, "") // Strip HTML tags
    .replace(/[\x00-\x1f\x7f]/g, "") // Remove control characters
    .slice(0, MAX_PROJECT_NAME_LENGTH);
}

/**
 * Sanitizes a chat message by:
 * - Trimming whitespace
 * - Removing control characters (except newlines and tabs)
 * - Truncating to max length
 *
 * @param message - Raw chat message input
 * @returns Sanitized chat message
 */
export function sanitizeChatMessage(message: string): string {
  return message
    .trim()
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "") // Remove control chars (keep \n, \r, \t)
    .slice(0, MAX_CHAT_MESSAGE_LENGTH);
}

/**
 * Validates that a model ID exists in a set of known model IDs.
 * Prevents arbitrary model injection.
 *
 * @param modelId - The model ID to validate
 * @param validModels - Set of valid model IDs
 * @returns true if the model ID is valid
 */
export function isValidModelId(
  modelId: string,
  validModels: Set<string>
): boolean {
  return validModels.has(modelId);
}
