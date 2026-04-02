/**
 * SSE streaming chat endpoint adapted for Fly.io.
 * Key differences from worker version:
 * - Uses CloudflareKV/R2 REST wrappers instead of bindings
 * - Resilient to client disconnects (generation continues server-side)
 * - Generation state tracked in KV for reconnection
 * - Image uploads go to R2 instead of Supabase
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppVariables } from "../types.js";
import type { Project, ProjectFile, Version } from "../types/project.js";
import type { ChatMessage, ChatSession, ImageAttachment } from "../types/chat.js";
import { buildSystemPrompt, prepareChatHistory } from "../ai/system-prompt";
import { rewriteAtAliasImportsForSandbox } from "../ai/default-project";
import {
  parseFilesFromResponse,
  filterUnsafeGeneratedFiles,
  mergeFiles,
  extractExplanation,
  extractSuggestions,
} from "../ai/file-parser";
import { getModel, MODEL_REGISTRY, DEFAULT_MODEL } from "../ai/providers/index";
import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { checkCredits, deductCredits } from "../services/credits.js";
import { sanitizeChatMessage } from "../services/sanitize.js";
import { ProjectLogger } from "../services/project-logger.js";
import { createTursoDatabase, createWebshopSchema } from "../services/turso.js";
import type { CloudflareKV } from "../services/cloudflare-kv.js";
import type { CloudflareR2 } from "../services/cloudflare-r2.js";
import type { Env } from "../types.js";

interface ChatContext {
  Variables: AppVariables;
}

interface GenerationState {
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  versionId?: string;
  error?: string;
}

const chatRoutes = new Hono<ChatContext>();

// GET /status/:projectId — check if a generation is running/completed
chatRoutes.get("/status/:projectId", async (c) => {
  const kv = c.get("kv" as any) as CloudflareKV;
  const projectId = c.req.param("projectId");

  const state = await kv.get<GenerationState>(`generation:${projectId}`, "json");
  if (!state) {
    return c.json({ status: "idle" });
  }
  return c.json(state);
});

// POST /stop/:projectId — stop a running generation
chatRoutes.post("/stop/:projectId", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("projectId");
  const kv = c.get("kv" as any) as CloudflareKV;

  // Verify project ownership
  const project = await kv.get<Project>(`project:${projectId}`, "json");
  if (!project || project.userId !== userId) {
    return c.json({ error: "Access denied" }, 403);
  }

  // Set a stop flag in KV that the running generation will check
  await kv.put(`stop-signal:${projectId}`, "true", { expirationTtl: 300 }); // expires in 5 mins

  return c.json({ success: true });
});

// POST /:projectId — Stream AI code generation (resilient to disconnects)
chatRoutes.post("/:projectId", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("projectId");
  const env = c.get("env" as any) as Env;
  const kv = c.get("kv" as any) as CloudflareKV;
  const r2 = c.get("r2" as any) as CloudflareR2;

  // --- 1. Parse and validate request body ---
  const body = await c.req.json<{
    message: string;
    model?: string;
    images?: ImageAttachment[];
  }>();

  const userMessage = sanitizeChatMessage(body.message || "");
  if (!userMessage) {
    return c.json({ error: "Message is required", code: "VALIDATION_ERROR" }, 400);
  }
  const modelId = body.model || DEFAULT_MODEL;

  const images = body.images || [];
  if (images.length > 5) {
    return c.json({ error: "Maximum 5 images per message", code: "VALIDATION_ERROR" }, 400);
  }
  for (const img of images) {
    const sizeBytes = (img.base64.length * 3) / 4;
    if (sizeBytes > 4 * 1024 * 1024) {
      return c.json({ error: "Each image must be under 4MB", code: "VALIDATION_ERROR" }, 400);
    }
  }

  const modelConfig = MODEL_REGISTRY[modelId];
  if (!modelConfig) {
    return c.json({ error: `Unknown model: ${modelId}`, code: "INVALID_MODEL" }, 400);
  }

  const mem = () => {
    const m = process.memoryUsage();
    return `RSS=${(m.rss / 1024 / 1024).toFixed(0)}MB heap=${(m.heapUsed / 1024 / 1024).toFixed(0)}MB`;
  };

  console.log(`[${projectId}] [auth] User ${userId} — POST /api/chat/${projectId} — ${mem()}`);
  console.log(`[${projectId}] [request] model=${modelId}, prompt=${userMessage.length} chars, images=${images.length}`);

  // --- 2. Verify project exists and belongs to user ---
  const t0 = Date.now();
  const project = await kv.get<Project>(`project:${projectId}`, "json");
  console.log(`[${projectId}] [kv] project:${projectId} fetched in ${Date.now() - t0}ms — type=${project?.type}, v=${project?.currentVersion}`);

  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  const isOwner = project.userId === userId;
  const isCollaborator = project.collaborators?.some((col) => col.userId === userId);
  if (!isOwner && !isCollaborator) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  // Auto-provision Turso DB for webshop projects without one
  if (project.type === "webshop" && (!project.databaseUrl || !project.databaseToken)) {
    console.log(`[chat] Project ${projectId} is a webshop without a DB — auto-provisioning...`);
    try {
      const dbName = `shop-${projectId.substring(0, 8).toLowerCase().replace(/[^a-z0-9-]/g, "")}`;
      const tursoDb = await createTursoDatabase(env, dbName);
      const databaseUrl = tursoDb.url || undefined;
      const databaseToken = tursoDb.token || undefined;

      if (databaseUrl && databaseToken) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await createWebshopSchema(databaseUrl, databaseToken);
        project.databaseUrl = databaseUrl;
        project.databaseToken = databaseToken;
        await kv.put(`project:${projectId}`, JSON.stringify(project));
        console.log(`[chat] Auto-provisioned Turso DB for ${projectId}: ${databaseUrl}`);
      }
    } catch (e: any) {
      console.error(`[chat] Auto-provision failed for ${projectId}:`, e.message);
    }
  }

  const plog = new ProjectLogger(kv, projectId, project.databaseUrl, project.databaseToken);
  plog.info("chat", `Generation started — model=${modelId}, prompt=${userMessage.slice(0, 120)}…`);

  // --- 3. Check credits (pre-check with minimum 1, real deduction after generation) ---
  const t1 = Date.now();
  const creditCheck = await checkCredits(userId, 1, kv);
  console.log(`[${projectId}] [credits] plan=${creditCheck.credits.plan}, remaining=${creditCheck.credits.remaining}, allowed=${creditCheck.allowed} — ${Date.now() - t1}ms`);

  if (!creditCheck.allowed) {
    return c.json({
      error: "Je credits zijn op. Upgrade naar Pro voor meer credits per dag.",
      code: "CREDITS_EXHAUSTED",
      remaining: creditCheck.credits.remaining,
      required: 1,
    }, 402);
  }

  // --- 4. Load existing project files from R2 ---
  const versionKey = `${projectId}/v${project.currentVersion}/files.json`;
  const versionObject = await r2.get(versionKey);

  let existingFiles: ProjectFile[] = [];
  if (versionObject) {
    const versionData = (await versionObject.json()) as Version;
    existingFiles = versionData.files || [];
    plog.debug("chat", `Loaded v${project.currentVersion} from R2 — ${existingFiles.length} existing files`);
  }

  // --- 5. Load chat history from KV ---
  const chatSession = await kv.get<ChatSession>(`chat:${projectId}`, "json");
  const chatHistory = chatSession?.messages || [];

  // --- 6. Build AI prompt ---
  const backendUrl = env.PUBLIC_WORKER_URL?.replace(/\/+$/, "") || "https://webagt-worker-v2.webagt.workers.dev";

  const systemPrompt = buildSystemPrompt(project, existingFiles, backendUrl);
  plog.debug("chat", `System prompt built — ${systemPrompt.length} chars`);

  // --- 6a. Upload images to R2 ---
  const enrichedImages: ImageAttachment[] = [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    let url: string | undefined;
    try {
      const ext = img.mediaType.split("/")[1]?.replace("jpeg", "jpg") || "png";
      const filename = `${crypto.randomUUID()}.${ext}`;
      const storagePath = `assets/${projectId}/${filename}`;

      const binaryStr = atob(img.base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let j = 0; j < binaryStr.length; j++) {
        bytes[j] = binaryStr.charCodeAt(j);
      }

      await r2.put(storagePath, Buffer.from(bytes));
      url = `${backendUrl}/api/assets/${projectId}/${filename}`;
      console.log(`[chat] Uploaded image to R2 ${i + 1}/${images.length}: ${storagePath}`);
    } catch (uploadError) {
      console.error(`[chat] Failed to upload image ${i}:`, uploadError);
    }
    enrichedImages.push({ ...img, url });
  }

  // Build SDK messages from history
  const rawMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const msg of chatHistory) {
    if (msg.role === "system") continue;
    rawMessages.push({ role: msg.role, content: msg.content });
  }

  const trimmedHistory = prepareChatHistory(rawMessages);
  const sdkMessages: ModelMessage[] = [];

  for (const msg of trimmedHistory) {
    if (typeof msg.content !== "string" || msg.content.trim().length === 0) continue;
    const lastEntry = sdkMessages[sdkMessages.length - 1];
    if (lastEntry && lastEntry.role === msg.role) {
      if (typeof lastEntry.content === "string") {
        lastEntry.content += "\n\n" + msg.content;
      }
    } else {
      sdkMessages.push({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      });
    }
  }

  // Capture the last message after history is built
  const lastMsg = sdkMessages[sdkMessages.length - 1];

  // Append current user message
  const imageUrlLines = enrichedImages
    .map((img, i) => (img.url ? `- Image ${i + 1}: ${img.url}` : null))
    .filter(Boolean)
    .join("\n");

  const finalUserMessage = imageUrlLines
    ? `${userMessage}\n\nUploaded image asset URL${enrichedImages.length > 1 ? "s" : ""} — use these directly as src attributes in <img> tags in your generated code:\n${imageUrlLines}`
    : userMessage;

  if (enrichedImages.length > 0 && modelConfig.supportsVision) {
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
    if (lastMsg && lastMsg.role === "user" && typeof lastMsg.content === "string") {
      lastMsg.content += "\n\n" + finalUserMessage;
    } else {
      sdkMessages.push({ role: "user" as const, content: finalUserMessage });
    }
  }

  // --- 7. Persist user message immediately so it survives a page refresh ---
  const nowIso = new Date().toISOString();
  const pendingUserMsg = {
    id: `msg-${Date.now()}-user`,
    role: "user" as const,
    content: userMessage,
    timestamp: nowIso,
    images: enrichedImages.length > 0 ? enrichedImages.map(({ base64: _b, ...rest }) => rest) : undefined,
  };
  const pendingChatSession = {
    projectId,
    messages: [...chatHistory, pendingUserMsg],
    createdAt: chatSession?.createdAt || nowIso,
    updatedAt: nowIso,
  };
  await kv.put(`chat:${projectId}`, JSON.stringify(pendingChatSession));

  // --- 8. Set generation state and stream ---
  await kv.put(`generation:${projectId}`, JSON.stringify({
    status: "running",
    startedAt: nowIso,
  } satisfies GenerationState));

  let clientConnected = true;

  return streamSSE(c, async (stream) => {
    let fullResponse = "";
    let eventId = 0;
    const streamStart = Date.now();

    // Clear any existing stop signal at start
    await kv.delete(`stop-signal:${projectId}`).catch(() => {});

    // Detect client disconnect — but continue generation
    c.req.raw.signal.addEventListener("abort", () => {
      console.log(`[chat] Client disconnected for ${projectId} — continuing generation server-side`);
      clientConnected = false;
    });

    try {
      const model = getModel(modelId, env);
      plog.info("chat", `Calling ${modelConfig.displayName} API — maxOutputTokens=${modelConfig.maxOutputTokens}`);

      const result = streamText({
        model,
        system: systemPrompt,
        messages: sdkMessages,
        maxOutputTokens: modelConfig.maxOutputTokens,
        abortSignal: undefined, // never abort — we want generation to complete even if client disconnects
      });

      let chunkCount = 0;
      let lastStopCheck = 0;
      let stopped = false;
      let inputTokens = 0;
      let outputTokens = 0;

      // Use textStream for reliable chunk delivery.
      // Token usage is captured via onFinish callback on the streamText call above.
      for await (const chunk of result.textStream) {
        fullResponse += chunk;
        chunkCount++;

        // Check for stop signal every 5 chunks
        if (chunkCount - lastStopCheck > 5) {
          lastStopCheck = chunkCount;
          const stopSignal = await kv.get(`stop-signal:${projectId}`);
          if (stopSignal === "true") {
            console.log(`[chat] Stop signal detected for ${projectId}. Aborting stream.`);
            stopped = true;
            break;
          }
        }

        if (clientConnected) {
          try {
            await stream.writeSSE({
              event: "chunk",
              data: JSON.stringify({ text: chunk }),
              id: String(eventId++),
            });
          } catch {
            clientConnected = false;
          }
        }
      }

      if (stopped) {
        plog.info("chat", `Generation stopped by user after ${chunkCount} chunks.`);
        await kv.delete(`stop-signal:${projectId}`).catch(() => {});
        await kv.put(`generation:${projectId}`, JSON.stringify({
          status: "failed",
          startedAt: new Date(streamStart).toISOString(),
          completedAt: new Date().toISOString(),
          error: "Generation stopped by user",
        } satisfies GenerationState)).catch(() => {});
        if (clientConnected) {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ message: "Generation stopped by user", code: "STOPPED" }),
            id: String(eventId++),
          });
        }
        return;
      }

      // Get real token usage — try result.usage (resolves after textStream is drained)
      // AI SDK v6 may use promptTokens or inputTokens depending on version
      try {
        const usage = await result.usage;
        inputTokens = (usage as any).inputTokens ?? (usage as any).promptTokens ?? 0;
        outputTokens = (usage as any).outputTokens ?? (usage as any).completionTokens ?? 0;
      } catch {
        // fallback below
      }

      // Fallback: estimate from character count when API doesn't return usage
      if (outputTokens === 0 && fullResponse.length > 0) {
        outputTokens = Math.round(fullResponse.length / 4);
        inputTokens = outputTokens * 4;
        console.log(`[${projectId}] [tokens] estimating from chars: ${inputTokens} in / ${outputTokens} out`);
      }

      const streamDuration = Date.now() - streamStart;
      plog.info("chat", `AI stream completed — ${chunkCount} chunks, ${inputTokens} in / ${outputTokens} out tokens, ${(streamDuration / 1000).toFixed(1)}s`);
      console.log(`[${projectId}] [memory] After AI stream: ${mem()}`);

      // --- 8. Parse files ---
      const parsedFiles = parseFilesFromResponse(fullResponse);
      const { acceptedFiles, rejectedFiles } = filterUnsafeGeneratedFiles(parsedFiles);
      const changedFilePaths = acceptedFiles.map((f) => f.path);

      plog.info("chat", `Parsed ${parsedFiles.length} files (${acceptedFiles.length} accepted, ${rejectedFiles.length} rejected)`);

      if (parsedFiles.length === 0) {
        plog.error("chat", "ZERO FILES PARSED — user will see default template");
      }

      const rawMergedFiles = acceptedFiles.length > 0
        ? mergeFiles(existingFiles, acceptedFiles)
        : existingFiles;

      const mergedFiles = rewriteAtAliasImportsForSandbox(rawMergedFiles);

      // --- 9. Store new version in R2 (always, even if client disconnected) ---
      let newVersionNumber = project.currentVersion;

      if (acceptedFiles.length > 0) {
        newVersionNumber = project.currentVersion + 1;

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

        const r2Key = `${projectId}/v${newVersionNumber}/files.json`;
        await r2.put(r2Key, JSON.stringify(newVersion));
        plog.info("chat", `R2 put SUCCESS: ${r2Key}`);

        project.currentVersion = newVersionNumber;
        project.updatedAt = new Date().toISOString();
        await kv.put(`project:${projectId}`, JSON.stringify(project));
        plog.info("chat", `KV put SUCCESS: project:${projectId} (v${newVersionNumber})`);
      }

      // --- 10. Deduct credits based on real token usage ---
      const BILLING_CONFIG_KEY = "billing_config";
      const billingCfg = await kv.get<{ pricingFormula?: { inputPricePerMillion: number; outputPricePerMillion: number; creditUnitCostUsd: number } }>(BILLING_CONFIG_KEY, "json");
      const inputPrice = (billingCfg?.pricingFormula?.inputPricePerMillion ?? 3) / 1_000_000;
      const outputPrice = (billingCfg?.pricingFormula?.outputPricePerMillion ?? 15) / 1_000_000;
      const creditUnit = billingCfg?.pricingFormula?.creditUnitCostUsd ?? 0.08;
      const apiCostUsd = (inputTokens * inputPrice) + (outputTokens * outputPrice);
      const creditsToDeduct = Math.max(1, Math.ceil(apiCostUsd / creditUnit));

      const updatedCredits = await deductCredits(userId, creditsToDeduct, kv);
      console.log(`[${projectId}] [credits] ${inputTokens} in / ${outputTokens} out — $${apiCostUsd.toFixed(4)} — deducted ${creditsToDeduct} credits, remaining: ${updatedCredits.remaining}`);

      // --- 11. Save chat messages to KV ---
      const blockedChangeNote = rejectedFiles.length > 0
        ? `\n\nBlocked unsafe AI file changes: ${rejectedFiles.map((f) => `\`${f.path}\` (${f.reason})`).join(", ")}.`
        : "";
      const explanationText = extractExplanation(fullResponse) + blockedChangeNote;
      const suggestions = extractSuggestions(fullResponse);

      const newUserMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
        images: enrichedImages.length > 0
          ? enrichedImages.map((img) => ({
              base64: img.url ? "" : img.base64,
              mediaType: img.mediaType,
              name: img.name,
              url: img.url,
            }))
          : undefined,
      };

      const newAssistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: explanationText,
        timestamp: new Date().toISOString(),
        versionNumber: acceptedFiles.length > 0 ? newVersionNumber : undefined,
        model: modelId,
        changedFiles: acceptedFiles.length > 0 ? changedFilePaths : undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        tokenUsage: { inputTokens, outputTokens, costUsd: apiCostUsd, creditsUsed: creditsToDeduct },
      };

      const updatedChatSession: ChatSession = {
        projectId,
        messages: [...chatHistory, newUserMsg, newAssistantMsg],
        createdAt: chatSession?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.put(`chat:${projectId}`, JSON.stringify(updatedChatSession));

      // --- 12. Send final events (if client still connected) ---
      if (clientConnected) {
        try {
          if (acceptedFiles.length > 0) {
            await stream.writeSSE({
              event: "files",
              data: JSON.stringify({ files: mergedFiles }),
              id: String(eventId++),
            });
          }

          await stream.writeSSE({
            event: "done",
            data: JSON.stringify({
              versionId: `v${newVersionNumber}`,
              model: modelId,
              changedFiles: changedFilePaths,
              creditsRemaining: updatedCredits.remaining,
              tokenUsage: { inputTokens, outputTokens, costUsd: apiCostUsd, creditsUsed: creditsToDeduct },
            }),
            id: String(eventId++),
          });
        } catch {
          // Client disconnected during final events — result is already saved
        }
      }

      // Update generation state to completed
      await kv.put(`generation:${projectId}`, JSON.stringify({
        status: "completed",
        startedAt: new Date(streamStart).toISOString(),
        completedAt: new Date().toISOString(),
        versionId: `v${newVersionNumber}`,
      } satisfies GenerationState));

      const totalDuration = Date.now() - streamStart;
      plog.info("chat", `Generation complete — v${newVersionNumber}, ${changedFilePaths.length} files, ${(totalDuration / 1000).toFixed(1)}s, client=${clientConnected ? "connected" : "disconnected"}`);
      console.log(`[${projectId}] [done] v${newVersionNumber}, ${changedFilePaths.length} files, ${(totalDuration / 1000).toFixed(1)}s — ${mem()}`);
      await plog.flush();

    } catch (error) {
      const rawError = error instanceof Error ? error.message : "Unknown error occurred";

      plog.error("chat", `GENERATION FAILED: ${rawError}`);
      await plog.flush();

      // Update generation state to failed
      await kv.put(`generation:${projectId}`, JSON.stringify({
        status: "failed",
        startedAt: new Date(streamStart).toISOString(),
        completedAt: new Date().toISOString(),
        error: rawError,
      } satisfies GenerationState)).catch(() => {});

      let userFriendlyMessage: string;
      let errorCode: string;

      if (rawError.includes("429") || rawError.includes("rate limit")) {
        userFriendlyMessage = "Too many requests. Please wait a moment and try again.";
        errorCode = "RATE_LIMITED";
      } else if (rawError.includes("401") || rawError.includes("api key")) {
        userFriendlyMessage = "AI service configuration error. Please contact support.";
        errorCode = "AUTH_FAILED";
      } else if (rawError.includes("500") || rawError.includes("503") || rawError.includes("unavailable")) {
        userFriendlyMessage = "The AI service is temporarily unavailable. Please try again.";
        errorCode = "SERVICE_UNAVAILABLE";
      } else if (rawError.includes("timeout") || rawError.includes("TIMEOUT") || rawError.includes("network")) {
        userFriendlyMessage = "Generation timed out. Please try a simpler request.";
        errorCode = "TIMEOUT";
      } else {
        userFriendlyMessage = "Failed to generate code. Please try again.";
        errorCode = "GENERATION_FAILED";
      }

      if (clientConnected) {
        try {
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ message: userFriendlyMessage, code: errorCode }),
            id: String(eventId++),
          });
        } catch { /* client gone */ }
      }
    }
  });
});

// GET /:projectId — Get chat history
chatRoutes.get("/:projectId", async (c) => {
  const userId = c.var.userId;
  const projectId = c.req.param("projectId");
  const kv = c.get("kv" as any) as CloudflareKV;

  const project = await kv.get<Project>(`project:${projectId}`, "json");
  if (!project) {
    return c.json({ error: "Project not found", code: "NOT_FOUND" }, 404);
  }

  const isOwnerOrCollab = project.userId === userId || project.collaborators?.some((col) => col.userId === userId);
  if (!isOwnerOrCollab) {
    return c.json({ error: "Access denied", code: "FORBIDDEN" }, 403);
  }

  const chatSession = await kv.get<ChatSession>(`chat:${projectId}`, "json");
  return c.json({ messages: chatSession?.messages || [] });
});

export { chatRoutes };
