/**
 * Project logger adapted for Fly.io — uses CloudflareKV REST API
 * and Turso via @libsql/client.
 */

import type { CloudflareKV } from "./cloudflare-kv.js";

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
    private kv: CloudflareKV,
    private projectId: string,
    private dbUrl?: string,
    private dbToken?: string,
  ) {}

  private async getDb() {
    if (this.dbClient) return this.dbClient;
    if (this.dbChecked) return null;
    this.dbChecked = true;

    if (!this.dbUrl || !this.dbToken) return null;

    try {
      const { createClient } = await import("@libsql/client");
      this.dbClient = createClient({
        url: this.dbUrl,
        authToken: this.dbToken,
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
    this.queue.push({
      level,
      source,
      message,
      detail: detail?.slice(0, 4000),
      createdAt: new Date().toISOString(),
    });
    console.log(`[${this.projectId}] [${level}] [${source}] ${message}`);
  }

  info(source: string, message: string, detail?: string) { this.log("info", source, message, detail); }
  warn(source: string, message: string, detail?: string) { this.log("warn", source, message, detail); }
  error(source: string, message: string, detail?: string) { this.log("error", source, message, detail); }
  debug(source: string, message: string, detail?: string) { this.log("debug", source, message, detail); }

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
          console.error(`[project-logger] Turso write failed:`, e);
        }
      }
    } else {
      try {
        const kvKey = `logs:${this.projectId}`;
        const existing = await this.kv.get<ProjectLogEntry[]>(kvKey, "json") || [];
        const merged = [...existing, ...entries].slice(-200);
        await this.kv.put(kvKey, JSON.stringify(merged));
      } catch (e) {
        console.error(`[project-logger] KV fallback failed:`, e);
      }
    }
    this.flushing = false;
  }
}
