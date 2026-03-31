/**
 * worker/src/services/project-logger.ts
 *
 * Writes structured logs to a project's Turso `_AppLog` table.
 * Falls back to Cloudflare KV when no Turso DB is available.
 * Used by the chat pipeline, stripe webhooks, and other project-scoped operations
 * so every step is traceable from the admin logs UI.
 */

import type { Env } from "../types";

interface ProjectLogEntry {
  level: "info" | "warn" | "error" | "debug";
  source: string;
  message: string;
  detail?: string;
  createdAt: string;
}

export class ProjectLogger {
  private queue: ProjectLogEntry[] = [];
  private dbClient: any = null;
  private dbChecked = false;
  private flushing = false;

  constructor(
    private env: Env,
    private projectId: string,
  ) {}

  private async getDb() {
    if (this.dbClient) return this.dbClient;
    if (this.dbChecked) return null;
    this.dbChecked = true;

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
    this.queue.push({ level, source, message, detail: detail?.slice(0, 4000), createdAt: new Date().toISOString() });
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
   * Falls back to KV storage if no Turso DB is available.
   */
  async flush() {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;

    const entries = [...this.queue];
    this.queue = [];

    const db = await this.getDb();

    if (db) {
      for (const entry of entries) {
        try {
          await db.execute({
            sql: "INSERT INTO [_AppLog] (level, source, message, detail, createdAt) VALUES (?, ?, ?, ?, ?)",
            args: [entry.level, entry.source, entry.message, entry.detail ?? null, entry.createdAt],
          });
        } catch (e) {
          console.error(`[project-logger] Failed to write log to Turso:`, e);
        }
      }
    } else {
      // Fallback: write to KV so logs are never lost
      try {
        const kvKey = `logs:${this.projectId}`;
        const existing = await this.env.METADATA.get<ProjectLogEntry[]>(kvKey, "json") || [];
        const merged = [...existing, ...entries].slice(-200); // keep last 200 entries
        await this.env.METADATA.put(kvKey, JSON.stringify(merged));
        console.log(`[project-logger] Wrote ${entries.length} logs to KV fallback for ${this.projectId} (no Turso DB)`);
      } catch (e) {
        console.error(`[project-logger] KV fallback also failed for ${this.projectId}:`, e);
      }
    }
    this.flushing = false;
  }
}
