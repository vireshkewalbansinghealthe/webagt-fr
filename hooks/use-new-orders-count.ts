"use client";

/**
 * hooks/use-new-orders-count.ts
 *
 * Polls the project's Turso database for orders created since the last time
 * the user opened the Shop Manager panel. The result is shown as a red badge
 * on the "Shop" tab button in the editor header.
 *
 * State is persisted in localStorage under `shopLastSeen:{projectId}` so the
 * badge survives page refreshes but resets when the user opens the shop.
 *
 * Usage:
 *   const { newOrdersCount, markAsSeen } = useNewOrdersCount({ projectId, databaseUrl, databaseToken });
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@libsql/client/web";

interface UseNewOrdersCountOptions {
  projectId: string;
  databaseUrl: string | undefined;
  databaseToken: string | undefined;
  /** How often to re-poll in ms. Defaults to 60 000 (1 min). */
  pollIntervalMs?: number;
}

interface UseNewOrdersCountResult {
  /** Number of orders created since the user last opened the Shop tab */
  newOrdersCount: number;
  /** Call this when the user opens the Shop tab to reset the badge */
  markAsSeen: () => void;
}

function storageKey(projectId: string) {
  return `shopLastSeen:${projectId}`;
}

function getLastSeen(projectId: string): string {
  try {
    return localStorage.getItem(storageKey(projectId)) ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

function setLastSeen(projectId: string, iso: string) {
  try {
    localStorage.setItem(storageKey(projectId), iso);
  } catch {
    // ignore (private browsing, storage full, etc.)
  }
}

export function useNewOrdersCount({
  projectId,
  databaseUrl,
  databaseToken,
  pollIntervalMs = 10_000,
}: UseNewOrdersCountOptions): UseNewOrdersCountResult {
  const [newOrdersCount, setNewOrdersCount] = useState(0);
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);

  // Create or recreate the Turso client when connection details change
  useEffect(() => {
    if (!databaseUrl || !databaseToken) {
      clientRef.current = null;
      return;
    }
    clientRef.current = createClient({ url: databaseUrl, authToken: databaseToken });
  }, [databaseUrl, databaseToken]);

  const poll = useCallback(async () => {
    const turso = clientRef.current;
    if (!turso) return;

    const lastSeen = getLastSeen(projectId);
    try {
      const res = await turso.execute({
        sql: "SELECT COUNT(*) as c FROM [Order] WHERE createdAt > ?",
        args: [lastSeen],
      });
      const count = Number(res.rows[0]?.c ?? 0);
      setNewOrdersCount(count);
    } catch {
      // DB might not have the Order table yet (new project) — silently ignore
    }
  }, [projectId]);

  // Poll on mount + interval
  useEffect(() => {
    if (!databaseUrl || !databaseToken) return;
    poll();
    const timer = setInterval(poll, pollIntervalMs);
    return () => clearInterval(timer);
  }, [poll, databaseUrl, databaseToken, pollIntervalMs]);

  const markAsSeen = useCallback(() => {
    setLastSeen(projectId, new Date().toISOString());
    setNewOrdersCount(0);
  }, [projectId]);

  return { newOrdersCount, markAsSeen };
}
