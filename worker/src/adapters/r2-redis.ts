/**
 * worker/src/adapters/r2-redis.ts
 *
 * Upstash Redis implementation of the IR2Bucket interface.
 * Stores file contents in Redis under a "r2:" key prefix.
 *
 * Cloudflare R2 semantics are preserved:
 * - get() returns an object with .text(), .json(), .arrayBuffer() methods
 * - put() stores the raw string/buffer content
 * - delete() accepts a single key or array of keys
 * - list() returns all keys matching a prefix
 *
 * Storage format: r2:{path} → raw string content (e.g. JSON files)
 *
 * Used by: app/api/[[...route]]/route.ts (Vercel entry point)
 */

import type { Redis } from "@upstash/redis";
import type { IR2Bucket, IR2ObjectBody } from "../types";

const R2_PREFIX = "r2:";

class R2ObjectBodyAdapter implements IR2ObjectBody {
  key: string;
  size: number;
  body: ReadableStream | null;

  constructor(
    key: string,
    private data: string
  ) {
    this.key = key;
    this.size = data.length;
    // Provide a ReadableStream over the string data
    const encoded = Buffer.from(data, "utf-8");
    this.body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });
  }

  async text(): Promise<string> {
    return this.data;
  }

  async json<T = unknown>(): Promise<T> {
    return JSON.parse(this.data) as T;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    return Buffer.from(this.data, "utf-8").buffer;
  }
}

export class RedisR2Adapter implements IR2Bucket {
  constructor(private redis: Redis) {}

  private r2Key(key: string): string {
    return `${R2_PREFIX}${key}`;
  }

  async get(key: string): Promise<IR2ObjectBody | null> {
    const value = await this.redis.get<string>(this.r2Key(key));
    if (value === null || value === undefined) return null;

    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
    return new R2ObjectBodyAdapter(key, stringValue);
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ReadableStream | Blob | null
  ): Promise<IR2ObjectBody> {
    let stringValue: string;

    if (value === null) {
      stringValue = "";
    } else if (typeof value === "string") {
      stringValue = value;
    } else if (value instanceof ArrayBuffer) {
      stringValue = Buffer.from(value).toString("utf-8");
    } else if (value instanceof Blob) {
      stringValue = await value.text();
    } else {
      // ReadableStream
      const reader = (value as ReadableStream).getReader();
      const chunks: Uint8Array[] = [];
      let result = await reader.read();
      while (!result.done) {
        chunks.push(result.value);
        result = await reader.read();
      }
      stringValue = Buffer.concat(chunks).toString("utf-8");
    }

    await this.redis.set(this.r2Key(key), stringValue);
    return new R2ObjectBodyAdapter(key, stringValue);
  }

  async delete(keys: string | string[]): Promise<void> {
    const keysArray = Array.isArray(keys) ? keys : [keys];
    if (keysArray.length === 0) return;
    await this.redis.del(...keysArray.map((k) => this.r2Key(k)));
  }

  async list(options?: {
    prefix?: string;
    limit?: number;
  }): Promise<{ objects: { key: string }[]; truncated: boolean }> {
    const pattern = options?.prefix
      ? `${R2_PREFIX}${options.prefix}*`
      : `${R2_PREFIX}*`;

    const keys = await this.redis.keys(pattern);

    const sliced = options?.limit ? keys.slice(0, options.limit) : keys;

    return {
      objects: sliced.map((k) => ({ key: k.replace(R2_PREFIX, "") })),
      truncated: false,
    };
  }
}
