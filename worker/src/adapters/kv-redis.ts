/**
 * worker/src/adapters/kv-redis.ts
 *
 * Upstash Redis implementation of the IKVNamespace interface.
 * Used when the worker runs on Vercel instead of Cloudflare Workers.
 *
 * Cloudflare KV semantics are preserved:
 * - get() with type "json" returns a parsed object
 * - put() with expirationTtl sets a Redis TTL (in seconds)
 * - list() scans all keys matching a prefix pattern
 *
 * Used by: app/api/[[...route]]/route.ts (Vercel entry point)
 */

import type { Redis } from "@upstash/redis";
import type { IKVNamespace } from "../types";

export class RedisKVAdapter implements IKVNamespace {
  constructor(private redis: Redis) {}

  async get<T = unknown>(key: string, type?: "json"): Promise<T | null> {
    const value = await this.redis.get<T>(key);
    if (value === null || value === undefined) return null;

    if (type === "json" && typeof value === "string") {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    }

    // No type specified — return as-is (Upstash auto-parses JSON responses)
    return value as T;
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    const stringValue =
      typeof value === "string"
        ? value
        : value instanceof ArrayBuffer
          ? Buffer.from(value).toString("utf-8")
          : await streamToString(value as ReadableStream);

    if (options?.expirationTtl) {
      await this.redis.set(key, stringValue, { ex: options.expirationTtl });
    } else {
      await this.redis.set(key, stringValue);
    }
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async list(options?: {
    prefix?: string;
    limit?: number;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean; cursor?: string }> {
    const pattern = options?.prefix ? `${options.prefix}*` : "*";
    const keys = await this.redis.keys(pattern);

    const sliced = options?.limit ? keys.slice(0, options.limit) : keys;

    return {
      keys: sliced.map((name) => ({ name })),
      list_complete: true,
    };
  }
}

async function streamToString(stream: ReadableStream): Promise<string> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let result = await reader.read();
  while (!result.done) {
    chunks.push(result.value);
    result = await reader.read();
  }
  return Buffer.concat(chunks).toString("utf-8");
}
