/**
 * worker/src/services/project-logger.ts
 *
 * Writes structured logs to a project's Turso `_AppLog` table.
 * Used by the chat pipeline, stripe webhooks, and other project-scoped operations
 * so every step is traceable from the admin logs UI.
 */

import type { Env } from "../types";

interface ProjectLogEntry {
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
  detail?: string;
}

export class ProjectLogger {
  private queue: ProjectLogEntry[] = [];
  private dbClient: any = null;
  private flushing = false;

  constructor(
    private env: Env,
    private projectId: string,
  ) {}

  private async getDb() {
    if (this.dbClient) return this.dbClient;
    try {
      const project = await this.env.METADATA.get<{
        databaseUrl?: string;
        databaseToken?: string;
      }>(`project:${this.projectId}`, "json");

      if (!project?.databaseUrl || !project?.databaseToken) return null;

      const { createClient } = await import("@libsql/client/web");
      this.dbClient = createClient({
        url: project.databaseUrl,
        authToken: project.databaseToken,
      });

      await this.dbClient.execute(
        `CREATE TABLE IF NOT EXISTS [_AppLog] (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          level TEXT NOT NULL DEFAULT 'info',
          source TEXT,
          message TEXT NOT NULL,
          detail TEXT,
          createdAt TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
      );
      return this.dbClient;
    } catch {
      return null;
    }
  }

  log(level: ProjectLogEntry["level"], source: string, message: string, detail?: string) {
    this.queue.push({ level, source, message, detail: detail?.slice(0, 4000) });
    console.log(`[${this.projectId}] [${level}] [${source}] ${message}`);
  }

  info(source: string, message: string, detail?: string) {
    this.log("info", source, message, detail);
  }
  warn(source: string, message: string, detail?: string) {
    this.log("warn", source, message, detail);
  }
  error(source: string, message: string, detail?: string) {
    this.log("error", source, message, detail);
  }
  debug(source: string, message: string, detail?: string) {
    this.log("debug", source, message, detail);
  }

  /**
   * Flush all queued log entries to the project's Turso database.
   * Safe to call multiple times — idempotent after first flush completes.
   */
  async flush() {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    const db = await this.getDb();
    if (!db) {
      console.warn(`[project-logger] No DB for project ${this.projectId} — ${this.queue.length} logs dropped`);
      this.queue = [];
      this.flushing = false;
      return;
    }

    const entries = [...this.queue];
    this.queue = [];

    for (const entry of entries) {
      try {
        await db.execute({
          sql: "INSERT INTO [_AppLog] (level, source, message, detail, createdAt) VALUES (?, ?, ?, ?, ?)",
          args: [entry.level, entry.source, entry.message, entry.detail ?? null, new Date().toISOString()],
        });
      } catch (e) {
        console.error(`[project-logger] Failed to write log:`, e);
      }
    }
    this.flushing = false;
  }
}
