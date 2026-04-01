/**
 * Cloudflare KV REST API wrapper.
 * Provides the same get/put/delete interface as KVNamespace bindings
 * but uses the Cloudflare API v4 over HTTPS.
 */

export class CloudflareKV {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(accountId: string, namespaceId: string, apiToken: string) {
    this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}`;
    this.headers = {
      Authorization: `Bearer ${apiToken}`,
    };
  }

  async get<T = string>(key: string, type?: "json" | "text"): Promise<T | null> {
    const res = await fetch(`${this.baseUrl}/values/${encodeURIComponent(key)}`, {
      headers: this.headers,
    });

    if (res.status === 404 || res.status === 410) return null;
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`KV GET failed (${res.status}): ${errText}`);
    }

    const text = await res.text();
    if (!text) return null;

    if (type === "json") {
      return JSON.parse(text) as T;
    }
    return text as unknown as T;
  }

  async put(key: string, value: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/values/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: {
        ...this.headers,
        "Content-Type": "text/plain",
      },
      body: value,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`KV PUT failed (${res.status}): ${errText}`);
    }
  }

  async delete(key: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/values/${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: this.headers,
    });

    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      throw new Error(`KV DELETE failed (${res.status}): ${errText}`);
    }
  }

  async list(prefix?: string, limit = 1000): Promise<{ name: string }[]> {
    const params = new URLSearchParams();
    if (prefix) params.set("prefix", prefix);
    params.set("limit", String(limit));

    const res = await fetch(`${this.baseUrl}/keys?${params}`, {
      headers: this.headers,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`KV LIST failed (${res.status}): ${errText}`);
    }

    const data = await res.json() as { result: { name: string }[] };
    return data.result || [];
  }
}
