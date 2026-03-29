/**
 * worker/src/routes/chat.ts
 *
 * SSE streaming endpoint for AI code generation.
 * This is the core endpoint that powers the editor's chat experience.
 *
 * Flow:
 * 1. Authenticate — verify JWT, extract userId
 * 2. Validate — check project exists and belongs to user
 * 3. Check credits — ensure user has enough credits for the selected model
 * 4. Load context — get current project files from R2, chat history from KV
 * 5. Build prompt — system prompt + existing files + trimmed chat history
 * 6. Stream — call AI API, forward chunks as SSE events
 * 7. Parse & store — extract <file> tags, merge files, save new version
 * 8. Finalize — deduct credits, send files + done events, save chat history
 *
 * SSE Event Types:
 * - chunk: { text: string } — streaming text from the AI
 * - files: { files: ProjectFile[] } — parsed files after generation
 * - done: { versionId: string, model: string, creditsRemaining: number } — complete
 * - error: { message: string, code: string } — error occurred
 *
 * Used by: worker/src/index.ts (mounted at /api/chat)
 *
 * --- COPILOT GENERATION PROMPT ---
 *
 * Create a file `worker/src/routes/chat.ts` that implements an SSE streaming
 * chat endpoint for AI code generation using Hono, AI SDK (`streamText`),
 * Cloudflare KV (metadata/chat history), and Cloudflare R2 (file storage).
 *
 * PREREQUISITES (these already exist — import from them):
 * - `hono` and `hono/streaming` for router + SSE support
 * - `../types` exports `Env` (KV: METADATA, R2: FILES, API keys) and `AppVariables` ({ userId: string })
 * - `../types/project` exports `Project` ({ id, userId, name, model, currentVersion, createdAt, updatedAt }),
 *   `ProjectFile` ({ path, content }), `Version` ({ versionNumber, prompt, model, files, changedFiles, type, createdAt, fileCount })
 * - `../types/chat` exports `ChatMessage` ({ id, role, content, timestamp, versionNumber?, model?, changedFiles?, images? }),
 *   `ChatSession` ({ projectId, messages, createdAt, updatedAt }), `ImageAttachment` ({ base64, mediaType, name? })
 * - `../ai/system-prompt` exports `buildSystemPrompt(existingFiles)` and `prepareChatHistory(rawMessages)`
 * - `../ai/file-parser` exports `parseFilesFromResponse(text)`, `mergeFiles(existing, parsed)`, `extractExplanation(text)`
 * - `../ai/providers` exports `getModel(modelId, env)`, `MODEL_REGISTRY` (map of modelId to config with
 *   creditCost, tier, supportsVision, maxOutputTokens), `DEFAULT_MODEL`
 * - `ai` package exports `streamText` and `ModelMessage` type
 * - `../services/credits` exports `checkCredits(userId, cost, env)` and `deductCredits(userId, cost, env)`
 * - `../services/sanitize` exports `sanitizeChatMessage(text)` — returns sanitized string or empty string
 *
 * STEP 1: Create the Hono router
 * - Create `const chatRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>()`
 * - Auth middleware is applied by the parent app (userId is on `c.var.userId`)
 *
 * STEP 2: POST `/:projectId` route — the main streaming chat endpoint
 * - Extract `userId` from `c.var.userId` and `projectId` from route param
 *
 * STEP 3: Parse and validate the request body
 * - Parse JSON body: `{ message: string; model?: string; images?: ImageAttachment[] }`
 * - Sanitize message with `sanitizeChatMessage()`. Return 400 `VALIDATION_ERROR` if empty.
 * - Default model to `DEFAULT_MODEL` if not provided
 * - Validate images: max 5 images, max 4MB each (approximate base64 size: `base64.length * 3 / 4`)
 *   Return 400 `VALIDATION_ERROR` if exceeded.
 * - Look up `modelId` in `MODEL_REGISTRY`. Return 400 `INVALID_MODEL` if not found.
 *
 * STEP 4: Verify project ownership
 * - Fetch `project` from KV key `project:${projectId}` as JSON (typed as `Project`)
 * - Return 404 `NOT_FOUND` if project is null
 * - Return 403 `FORBIDDEN` if `project.userId !== userId`
 *
 * STEP 5: Check credits and plan-based model gating
 * - Call `checkCredits(userId, modelConfig.creditCost, c.env)`
 * - If `modelConfig.tier === "premium"` AND `creditCheck.credits.plan === "free"`,
 *   return 403 with code `PREMIUM_MODEL_LOCKED`
 * - If `!creditCheck.allowed`, return 402 with code `CREDITS_EXHAUSTED`
 *   (include `remaining` and `required` in response)
 *
 * STEP 6: Load existing project files from R2
 * - Build key: `${projectId}/v${project.currentVersion}/files.json`
 * - GET from `c.env.FILES` (R2). If exists, parse as `Version` and extract `.files`.
 *   Otherwise default to empty array `ProjectFile[]`.
 *
 * STEP 7: Load chat history from KV
 * - Fetch `chat:${projectId}` from KV as JSON (`ChatSession`)
 * - Extract `chatSession?.messages || []`
 *
 * STEP 8: Build AI prompt messages
 * - Call `buildSystemPrompt(existingFiles)` for the system prompt
 * - Build `rawMessages` from chat history: iterate messages, skip `role === "system"`,
 *   push `{ role, content }` for user/assistant messages only
 * - Call `prepareChatHistory(rawMessages)` for sliding window + summary trimming
 * - Map trimmed history to `ModelMessage[]` (AI SDK format):
 *   `{ role: "user", content }` or `{ role: "assistant", content }`
 * - Append current user message:
 *   - If `images.length > 0` AND `modelConfig.supportsVision`:
 *     push multimodal message: `{ role: "user", content: [{ type: "text", text }, ...images.map(img => ({ type: "image", image: img.base64, mimeType: img.mediaType }))] }`
 *   - Otherwise: push `{ role: "user", content: userMessage }`
 *
 * STEP 9: Stream the AI response via SSE
 * - Return `streamSSE(c, async (stream) => { ... })`
 * - Initialize `fullResponse = ""` and `eventId = 0`
 * - Inside a try block:
 *   a. Get model instance: `getModel(modelId, c.env)`
 *   b. Call `streamText({ model, system: systemPrompt, messages: sdkMessages, maxOutputTokens: modelConfig.maxOutputTokens })`
 *   c. Iterate `result.textStream` with `for await`:
 *      - Accumulate each chunk into `fullResponse`
 *      - Write SSE: `{ event: "chunk", data: JSON.stringify({ text: chunk }), id: String(eventId++) }`
 *
 * STEP 10: Parse files from complete response
 * - Call `parseFilesFromResponse(fullResponse)` to extract `<file>` tags
 * - Get `changedFilePaths = parsedFiles.map(f => f.path)`
 * - If parsedFiles.length > 0, merge with `mergeFiles(existingFiles, parsedFiles)`.
 *   Otherwise keep `existingFiles` unchanged.
 *
 * STEP 11: Store new version in R2 (only if files changed)
 * - Start with `newVersionNumber = project.currentVersion`
 * - If `parsedFiles.length > 0`:
 *   a. Increment: `newVersionNumber = project.currentVersion + 1`
 *   b. Build `Version` object: `{ versionNumber, prompt: userMessage, model: modelId, files: mergedFiles, changedFiles: changedFilePaths, type: "ai", createdAt: new Date().toISOString(), fileCount: mergedFiles.length }`
 *   c. PUT to R2: key `${projectId}/v${newVersionNumber}/files.json`, value `JSON.stringify(newVersion)`
 *   d. Update project metadata: set `project.currentVersion` and `project.updatedAt`
 *   e. PUT to KV: key `project:${projectId}`, value `JSON.stringify(project)`
 *   f. Wrap both R2 and KV puts in try/catch, log success/failure, rethrow on error
 *
 * STEP 12: Deduct credits
 * - Call `deductCredits(userId, modelConfig.creditCost, c.env)`
 * - Log remaining credits
 *
 * STEP 13: Save chat messages to KV
 * - Call `extractExplanation(fullResponse)` for the assistant's display text
 * - Create `newUserMessage: ChatMessage` with `id: "msg-${Date.now()}-user"`, role "user",
 *   content, timestamp, and images (if any)
 * - Create `newAssistantMessage: ChatMessage` with `id: "msg-${Date.now()}-assistant"`,
 *   role "assistant", content: explanationText, timestamp, versionNumber (if files changed),
 *   model: modelId, changedFiles (if files changed)
 * - Build `updatedChatSession: ChatSession` with projectId, spread existing messages + new ones,
 *   createdAt (preserve existing or new), updatedAt
 * - PUT to KV: key `chat:${projectId}`, value `JSON.stringify(updatedChatSession)`
 *
 * STEP 14: Send final SSE events
 * - If `parsedFiles.length > 0`: write SSE event "files" with `{ files: mergedFiles }`
 * - Write SSE event "done" with `{ versionId: "v${newVersionNumber}", model: modelId, changedFiles: changedFilePaths, creditsRemaining: updatedCredits.remaining }`
 *
 * STEP 15: Error handling (catch block)
 * - Extract error message from Error instance or default to "Unknown error occurred"
 * - Categorize by string matching:
 *   - "429" or "rate limit" → RATE_LIMITED
 *   - "401" or "api key" → AUTH_FAILED
 *   - "500" or "503" or "unavailable" → SERVICE_UNAVAILABLE
 *   - "timeout" or "TIMEOUT" → TIMEOUT
 *   - else → GENERATION_FAILED
 * - Write SSE event "error" with `{ message: userFriendlyMessage, code: errorCode }`
 *
 * STEP 16: GET `/:projectId` route — fetch chat history
 * - Extract userId and projectId
 * - Verify project ownership (same pattern: fetch from KV, check null, check userId match)
 * - Fetch chat session from KV key `chat:${projectId}`
 * - Return JSON: `{ messages: chatSession?.messages || [] }`
 *
 * STEP 17: Export `{ chatRoutes }`
 *
 * All error responses use shape: `{ error: string, code: string }` with appropriate HTTP status codes.
 * All KV keys: `project:${id}` for projects, `chat:${id}` for chat sessions.
 * All R2 keys: `${projectId}/v${versionNumber}/files.json` for version snapshots.
 *
 * --- END COPILOT GENERATION PROMPT ---
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Env, AppVariables } from "../types";
import type { Project, ProjectFile, Version } from "../types/project";
import type { ChatMessage, ChatSession } from "../types/chat";
import { buildSystemPrompt, prepareChatHistory } from "../ai/system-prompt";
import {
  parseFilesFromResponse,
  filterUnsafeGeneratedFiles,
  mergeFiles,
  extractExplanation,
  extractSuggestions,
} from "../ai/file-parser";

import { getModel, MODEL_REGISTRY, DEFAULT_MODEL } from "../ai/providers";
import { streamText } from "ai";
import type { ModelMessage } from "ai";
import type { ImageAttachment } from "../types/chat";
import { checkCredits, deductCredits } from "../services/credits";
import { sanitizeChatMessage } from "../services/sanitize";

/**
 * Create a Hono router for chat endpoints.
 * Auth middleware is applied by the parent app in index.ts.
 */
const chatRoutes = new Hono<{ Bindings: Env; Variables: AppVariables }>();

// ---------------------------------------------------------------------------
// POST /api/chat/:projectId — Stream AI code generation
// ---------------------------------------------------------------------------

/**
 * Main chat endpoint. Accepts a user prompt, streams the AI response
 * as SSE events, and stores the generated files as a new version.
 *
 * Request body: { message: string; model?: string }
 * Response: text/event-stream (SSE)
 */
chatRoutes.post("/:projectId", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("projectId");

  // --- 1. Parse and validate request body ---
  const body = await c.req.json<{
    message: string;
    model?: string;
    images?: ImageAttachment[];
  }>();

  const userMessage = sanitizeChatMessage(body.message || "");
  if (!userMessage) {
    return c.json(
      { error: "Message is required", code: "VALIDATION_ERROR" },
      400,
    );
  }
  const modelId = body.model || DEFAULT_MODEL;

  // Validate images — max 5 images, max 4MB each
  const images = body.images || [];
  if (images.length > 5) {
    return c.json(
      { error: "Maximum 5 images per message", code: "VALIDATION_ERROR" },
      400,
    );
  }
  for (const img of images) {
    const sizeBytes = (img.base64.length * 3) / 4; // approximate base64 decoded size
    if (sizeBytes > 4 * 1024 * 1024) {
      return c.json(
        { error: "Each image must be under 4MB", code: "VALIDATION_ERROR" },
        400,
      );
    }
  }

  // Validate model exists in registry
  const modelConfig = MODEL_REGISTRY[modelId];
  if (!modelConfig) {
    return c.json(
      { error: `Unknown model: ${modelId}`, code: "INVALID_MODEL" },
      400,
    );
  }

  // --- 2. Verify project exists and belongs to user ---
  const project = await c.env.METADATA.get<Project>(
    `project:${projectId}`,
    "json",
  );

  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  if (project.userId !== userId) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  // --- 3. Check credits and plan-based model gating ---
  const creditCheck = await checkCredits(userId, modelConfig.creditCost, c.env);

  // Block free users from premium-tier models
  if (modelConfig.tier === "premium" && creditCheck.credits.plan === "free") {
    return c.json(
      {
        error:
          "Premium models require a Pro plan. Upgrade to access Claude Sonnet, GPT-4o, and more.",
        code: "PREMIUM_MODEL_LOCKED",
        plan: creditCheck.credits.plan,
      },
      403,
    );
  }

  if (!creditCheck.allowed) {
    return c.json(
      {
        error: "You've used all your credits. Upgrade to Pro for unlimited.",
        code: "CREDITS_EXHAUSTED",
        remaining: creditCheck.credits.remaining,
        required: modelConfig.creditCost,
      },
      402,
    );
  }

  // --- 4. Load existing project files from R2 ---
  const versionKey = `${projectId}/v${project.currentVersion}/files.json`;
  const versionObject = await c.env.FILES.get(versionKey);

  let existingFiles: ProjectFile[] = [];
  if (versionObject) {
    const versionData = (await versionObject.json()) as Version;
    existingFiles = versionData.files || [];
  }

  // --- 5. Load chat history from KV ---
  const chatSession = await c.env.METADATA.get<ChatSession>(
    `chat:${projectId}`,
    "json",
  );
  const chatHistory = chatSession?.messages || [];

  // --- 6. Build the AI prompt with context management ---
  const configuredBackendUrl = c.env.PUBLIC_WORKER_URL?.trim();
  const requestOrigin = new URL(c.req.url).origin;

  // backendUrl: used for system prompt context — always a publicly reachable URL
  // so the AI's generated code references real endpoints, not localhost.
  let backendUrl = configuredBackendUrl
    ? configuredBackendUrl.replace(/\/+$/, "")
    : requestOrigin;
  if (!configuredBackendUrl && (backendUrl.includes("localhost") || backendUrl.includes("127.0.0.1"))) {
    backendUrl = "https://api-webagt.dock.4esh.nl";
  }

  // assetBaseUrl: used for constructing uploaded-image URLs that browsers must load.
  // In local dev (no PUBLIC_WORKER_URL): use the actual request origin (localhost:8787)
  //   → file is in local R2 state, served by local worker ✓
  // In production (PUBLIC_WORKER_URL set): use that public URL
  //   → file is in production R2 state, served by production worker ✓
  const assetBaseUrl = configuredBackendUrl
    ? configuredBackendUrl.replace(/\/+$/, "")
    : requestOrigin;

  const systemPrompt = buildSystemPrompt(project, existingFiles, backendUrl);

  // --- 6a. Upload attached images to R2 and get persistent public URLs ---
  // This lets the AI reference the images in generated code via <img src="...">
  const enrichedImages: ImageAttachment[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let url: string | undefined;
    try {
      const ext = img.mediaType.split("/")[1]?.replace("jpeg", "jpg") || "png";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const key = `assets/${projectId}/${filename}`;

      // Decode base64 → raw bytes for R2 storage
      const binaryStr = atob(img.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let j = 0; j < binaryStr.length; j++) {
        bytes[j] = binaryStr.charCodeAt(j);
      }

      await c.env.FILES.put(key, bytes.buffer, {
        httpMetadata: { contentType: img.mediaType },
      });

      url = `${assetBaseUrl}/api/assets/${projectId}/${filename}`;
      console.log(`[chat] Uploaded image asset ${i + 1}/${images.length}: ${key}`);
    } catch (uploadError) {
      console.error(`[chat] Failed to upload image ${i}:`, uploadError);
    }
    enrichedImages.push({ ...img, url });
  }

  // Build message history for the AI using sliding window + summaries
  const rawMessages: Array<{ role: "user" | "assistant"; content: string }> =
    [];

  for (const msg of chatHistory) {
    // Skip system messages (e.g. "Restored to version X") — they're UI-only
    if (msg.role === "system") continue;
    rawMessages.push({ role: msg.role, content: msg.content });
  }

  // Apply context window management — trim old messages, summarize long ones
  const trimmedHistory = prepareChatHistory(rawMessages);

  // Build messages in AI SDK format using ModelMessage type
  // Filter out any accidentally empty messages and merge consecutive messages of the same role
  // to prevent Anthropic's "roles must alternate" and "empty text blocks" errors.
  const sdkMessages: ModelMessage[] = [];
  
  for (const msg of trimmedHistory) {
    if (typeof msg.content !== "string" || msg.content.trim().length === 0) {
      continue; // Skip empty messages
    }
    
    const lastMsg = sdkMessages[sdkMessages.length - 1];
    
    // If same role as last message, merge them
    if (lastMsg && lastMsg.role === msg.role) {
      if (typeof lastMsg.content === "string") {
        lastMsg.content += "\n\n" + msg.content;
      }
    } else {
      sdkMessages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content
      });
    }
  }

  // Append current user message — multimodal if images + vision model
  const lastMsg = sdkMessages[sdkMessages.length - 1];

  // Build the final user message text, appending public asset URLs so the AI
  // can reference them directly in generated <img src="..."> tags
  const imageUrlLines = enrichedImages
    .map((img, i) => (img.url ? `- Image ${i + 1}: ${img.url}` : null))
    .filter(Boolean)
    .join("\n");

  const finalUserMessage = imageUrlLines
    ? `${userMessage}\n\nUploaded image asset URL${enrichedImages.length > 1 ? "s" : ""} — use these directly as src attributes in <img> tags in your generated code:\n${imageUrlLines}`
    : userMessage;

  if (enrichedImages.length > 0 && modelConfig.supportsVision) {
    // If the last message was a user message, we must inject a dummy assistant message to alternate
    if (lastMsg && lastMsg.role === "user") {
      sdkMessages.push({ role: "assistant", content: "Understood. Please provide the images." });
    }
    
    sdkMessages.push({
      role: "user" as const,
      content: [
        { type: "text" as const, text: finalUserMessage },
        ...enrichedImages.map((img) => ({
          type: "image" as const,
          image: img.base64,
          mimeType: img.mediaType,
        })),
      ],
    });
  } else {
    // No images (or vision not supported) — merge or append as plain text
    if (lastMsg && lastMsg.role === "user" && typeof lastMsg.content === "string") {
      lastMsg.content += "\n\n" + finalUserMessage;
    } else {
      sdkMessages.push({ role: "user" as const, content: finalUserMessage });
    }
  }

  // --- 7. Stream the AI response ---
  return streamSSE(c, async (stream) => {
    let fullResponse = "";
    let eventId = 0;

    try {
      // Get the AI SDK model instance for the selected model
      const model = getModel(modelId, c.env);

      // streamText returns immediately — streaming happens when we iterate textStream
      const result = streamText({
        model,
        system: systemPrompt,
        messages: sdkMessages,
        maxOutputTokens: modelConfig.maxOutputTokens,
      });

      // Iterate the text stream — each chunk is forwarded as our custom SSE event
      // This replaces the onChunk callback pattern from our custom providers
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        await stream.writeSSE({
          event: "chunk",
          data: JSON.stringify({ text: chunk }),
          id: String(eventId++),
        });
      }

      // --- 8. Parse files from the complete response ---
      const parsedFiles = parseFilesFromResponse(fullResponse);
      const { acceptedFiles, rejectedFiles } =
        filterUnsafeGeneratedFiles(parsedFiles);
      const changedFilePaths = acceptedFiles.map((f) => f.path);
      console.log(
        `[chat] Parsed ${parsedFiles.length} files from AI response (${acceptedFiles.length} accepted, ${rejectedFiles.length} rejected)`,
      );
      if (rejectedFiles.length > 0) {
        console.warn(
          `[chat] Rejected unsafe generated files: ${rejectedFiles
            .map((file) => `${file.path} (${file.reason})`)
            .join(", ")}`,
        );
      }

      // If the AI returned no files, just send the text as explanation
      // This handles cases where the AI only provides advice without code
      const mergedFiles =
        acceptedFiles.length > 0
          ? mergeFiles(existingFiles, acceptedFiles)
          : existingFiles;

      // --- 9. Store new version in R2 (only if files changed) ---
      let newVersionNumber = project.currentVersion;

      if (acceptedFiles.length > 0) {
        newVersionNumber = project.currentVersion + 1;
        console.log(
          `[chat] Creating version v${newVersionNumber} with ${mergedFiles.length} files`,
        );

        const newVersion: Version = {
          versionNumber: newVersionNumber,
          prompt: userMessage,
          model: modelId,
          files: mergedFiles,
          changedFiles: changedFilePaths,
          type: "ai",
          createdAt: new Date().toISOString(),
          fileCount: mergedFiles.length,
        };

        try {
          await c.env.FILES.put(
            `${projectId}/v${newVersionNumber}/files.json`,
            JSON.stringify(newVersion),
          );
          console.log(
            `[chat] R2 put SUCCESS: ${projectId}/v${newVersionNumber}/files.json`,
          );
        } catch (r2Error) {
          console.error(`[chat] R2 put FAILED:`, r2Error);
          throw r2Error;
        }

        // Update project metadata
        project.currentVersion = newVersionNumber;
        project.updatedAt = new Date().toISOString();

        try {
          await c.env.METADATA.put(
            `project:${projectId}`,
            JSON.stringify(project),
          );
          console.log(
            `[chat] KV put SUCCESS: project:${projectId} (v${newVersionNumber})`,
          );
        } catch (kvError) {
          console.error(`[chat] KV put FAILED (project metadata):`, kvError);
          throw kvError;
        }
      }

      // --- 10. Deduct credits after successful generation ---
      const updatedCredits = await deductCredits(
        userId,
        modelConfig.creditCost,
        c.env,
      );
      console.log(
        `[chat] Credits deducted. Remaining: ${updatedCredits.remaining}`,
      );

      // --- 11. Save chat messages to KV ---
      const blockedChangeNote =
        rejectedFiles.length > 0
          ? `\n\nBlocked unsafe AI file changes: ${rejectedFiles
              .map((file) => `\`${file.path}\` (${file.reason})`)
              .join(", ")}.`
          : "";
      const explanationText =
        extractExplanation(fullResponse) + blockedChangeNote;

      const newUserMessage: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
        // Strip base64 when a persistent URL exists — saves KV space, URL is enough for display
        images: enrichedImages.length > 0
          ? enrichedImages.map((img) => ({
              base64: img.url ? "" : img.base64,
              mediaType: img.mediaType,
              name: img.name,
              url: img.url,
            }))
          : undefined,
      };

      const suggestions = extractSuggestions(fullResponse);

      const newAssistantMessage: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: explanationText,
        timestamp: new Date().toISOString(),
        versionNumber: acceptedFiles.length > 0 ? newVersionNumber : undefined,
        model: modelId,
        changedFiles: acceptedFiles.length > 0 ? changedFilePaths : undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
      };

      const updatedChatSession: ChatSession = {
        projectId,
        messages: [...chatHistory, newUserMessage, newAssistantMessage],
        createdAt: chatSession?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      try {
        await c.env.METADATA.put(
          `chat:${projectId}`,
          JSON.stringify(updatedChatSession),
        );
        console.log(
          `[chat] KV put SUCCESS: chat:${projectId} (${updatedChatSession.messages.length} messages)`,
        );
      } catch (kvError) {
        console.error(`[chat] KV put FAILED (chat history):`, kvError);
        throw kvError;
      }

      // --- 12. Send final events ---
      // Send parsed files so the client can update Sandpack + Monaco
      if (acceptedFiles.length > 0) {
        await stream.writeSSE({
          event: "files",
          data: JSON.stringify({ files: mergedFiles }),
          id: String(eventId++),
        });
      }

      // Send done event with metadata
      await stream.writeSSE({
        event: "done",
        data: JSON.stringify({
          versionId: `v${newVersionNumber}`,
          model: modelId,
          changedFiles: changedFilePaths,
          creditsRemaining: updatedCredits.remaining,
        }),
        id: String(eventId++),
      });
    } catch (error) {
      // --- Error handling with categorized messages ---
      const rawError =
        error instanceof Error ? error.message : "Unknown error occurred";

      console.error("Chat generation error:", rawError);

      // Categorize the error for a user-friendly message
      let userMessage: string;
      let errorCode: string;

      if (rawError.includes("429") || rawError.includes("rate limit")) {
        userMessage = "Too many requests. Please wait a moment and try again.";
        errorCode = "RATE_LIMITED";
      } else if (rawError.includes("401") || rawError.includes("api key")) {
        userMessage = "AI service configuration error. Please contact support.";
        errorCode = "AUTH_FAILED";
      } else if (
        rawError.includes("500") ||
        rawError.includes("503") ||
        rawError.includes("unavailable")
      ) {
        userMessage =
          "The AI service is temporarily unavailable. Please try again.";
        errorCode = "SERVICE_UNAVAILABLE";
      } else if (rawError.includes("timeout") || rawError.includes("TIMEOUT")) {
        userMessage = "Generation timed out. Please try a simpler request.";
        errorCode = "TIMEOUT";
      } else {
        userMessage = "Failed to generate code. Please try again.";
        errorCode = "GENERATION_FAILED";
      }

      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          message: userMessage,
          code: errorCode,
        }),
        id: String(eventId++),
      });
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/chat/:projectId — Get chat history
// ---------------------------------------------------------------------------

/**
 * Returns the chat history for a project.
 * Used by the editor page to restore chat messages on mount.
 */
chatRoutes.get("/:projectId", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("projectId");

  // Verify project ownership
  const project = await c.env.METADATA.get<Project>(
    `project:${projectId}`,
    "json",
  );

  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  if (project.userId !== userId) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  // Fetch chat history from KV
  const chatSession = await c.env.METADATA.get<ChatSession>(
    `chat:${projectId}`,
    "json",
  );

  return c.json({
    messages: chatSession?.messages || [],
  });
});

export { chatRoutes };
