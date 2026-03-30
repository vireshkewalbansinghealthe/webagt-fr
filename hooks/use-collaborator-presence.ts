"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface PresenceUser {
  userId: string;
  name: string;
  avatarUrl?: string;
  color: string;
  joinedAt: string;
}

/** Stable array of avatar colors for presence indicators */
const PRESENCE_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#f97316",
];

function colorForUser(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PRESENCE_COLORS[Math.abs(hash) % PRESENCE_COLORS.length];
}

/** Module-level singleton so only one GoTrueClient is ever created */
let _supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (_supabaseClient) return _supabaseClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  _supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return _supabaseClient;
}

interface UseCollaboratorPresenceOptions {
  projectId: string;
  currentUser: {
    userId: string;
    name: string;
    avatarUrl?: string;
  } | null;
  enabled?: boolean;
}

/**
 * useCollaboratorPresence — tracks who is currently viewing a project.
 * Uses Supabase Realtime presence channels (ephemeral, no DB tables needed).
 */
export function useCollaboratorPresence({
  projectId,
  currentUser,
  enabled = true,
}: UseCollaboratorPresenceOptions): PresenceUser[] {
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<ReturnType<SupabaseClient["channel"]> | null>(null);

  useEffect(() => {
    if (!enabled || !currentUser) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channelName = `presence:project:${projectId}`;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: currentUser.userId } },
    });

    const myPresence: PresenceUser = {
      userId: currentUser.userId,
      name: currentUser.name,
      avatarUrl: currentUser.avatarUrl,
      color: colorForUser(currentUser.userId),
      joinedAt: new Date().toISOString(),
    };

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceUser>();
        const users: PresenceUser[] = Object.values(state)
          .flat()
          .map((p) => ({
            ...(p as unknown as PresenceUser),
            color: colorForUser((p as unknown as PresenceUser).userId),
          }));
        setPresentUsers(users);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        setPresentUsers((prev) => {
          const existingIds = new Set(prev.map((u) => u.userId));
          const incoming = newPresences
            .map((p) => ({ ...(p as unknown as PresenceUser), color: colorForUser((p as unknown as PresenceUser).userId) }))
            .filter((p) => !existingIds.has(p.userId));
          return [...prev, ...incoming];
        });
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        const leftIds = new Set(leftPresences.map((p) => (p as unknown as PresenceUser).userId));
        setPresentUsers((prev) => prev.filter((u) => !leftIds.has(u.userId)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track(myPresence);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [projectId, currentUser?.userId, enabled]);

  return presentUsers;
}
