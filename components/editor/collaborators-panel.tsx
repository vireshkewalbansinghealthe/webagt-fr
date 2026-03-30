"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Loader2,
  Trash2,
  Crown,
  Mail,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createApiClient } from "@/lib/api-client";

interface Collaborator {
  userId: string;
  email: string;
  role: "editor" | "viewer";
  joinedAt: string;
}

interface CollaboratorsPanelProps {
  projectId: string;
  /** Close the containing dialog/panel when user navigates away */
  onClose?: () => void;
}

/**
 * CollaboratorsPanel — shown inside the project menu.
 * Lets the owner invite collaborators by email and remove them.
 * Collaborators can also leave (remove themselves).
 */
export function CollaboratorsPanel({ projectId, onClose: _onClose }: CollaboratorsPanelProps) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const userId = user?.id;

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isOwner = userId === ownerId;

  const loadCollaborators = useCallback(async () => {
    try {
      const client = createApiClient(getToken);
      const data = await client.collaborators.list(projectId);
      setCollaborators(data.collaborators);
      setOwnerId(data.ownerId);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [projectId, getToken]);

  useEffect(() => {
    loadCollaborators();
  }, [loadCollaborators]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;

    setInviting(true);
    try {
      const client = createApiClient(getToken);
      const result = await client.collaborators.invite(projectId, email, inviteRole);
      toast.success(result.message);
      setInviteEmail("");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove(collabUserId: string, isSelf: boolean) {
    setRemovingId(collabUserId);
    try {
      const client = createApiClient(getToken);
      await client.collaborators.remove(projectId, collabUserId);
      setCollaborators((prev) => prev.filter((c) => c.userId !== collabUserId));
      if (isSelf) {
        toast.success("You left the project");
      } else {
        toast.success("Collaborator removed");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to remove collaborator");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-border">
        <Users className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Collaborators</span>
      </div>

      {/* Current collaborators list */}
      <div className="space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : collaborators.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">
            No collaborators yet. Invite someone below.
          </p>
        ) : (
          collaborators.map((collab) => {
            const isSelf = collab.userId === userId;
            const isRemoving = removingId === collab.userId;
            return (
              <div
                key={collab.userId}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 group"
              >
                {/* Avatar placeholder */}
                <div className="size-6 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">
                    {collab.email[0]}
                  </span>
                </div>

                {/* Email + role */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">
                    {collab.email}
                    {isSelf && (
                      <span className="ml-1 text-[10px] text-muted-foreground">(you)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">{collab.role}</p>
                </div>

                {/* Remove button — owner can remove anyone, collabs can leave */}
                {(isOwner || isSelf) && (
                  <button
                    onClick={() => handleRemove(collab.userId, isSelf)}
                    disabled={isRemoving}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50"
                    title={isSelf ? "Leave project" : "Remove collaborator"}
                  >
                    {isRemoving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
            );
          })
        )}

        {/* Owner row — always shown */}
        {ownerId && !loading && (
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 bg-accent/20 border border-border/50 mt-1">
            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Crown className="size-3 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground">
                {ownerId === userId ? "You" : "Project owner"}
              </p>
              <p className="text-[10px] text-muted-foreground">Owner</p>
            </div>
          </div>
        )}
      </div>

      {/* Invite form — owner only */}
      {isOwner && (
        <form onSubmit={handleInvite} className="space-y-2 pt-1 border-t border-border">
          <p className="text-xs text-muted-foreground pt-1">Invite by email</p>
          <div className="flex gap-1.5">
            <Input
              type="email"
              placeholder="colleague@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="h-8 text-xs flex-1"
              disabled={inviting}
            />
            {/* Role picker */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs gap-1 shrink-0">
                  {inviteRole === "editor" ? "Editor" : "Viewer"}
                  <ChevronDown className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-32">
                <DropdownMenuItem onClick={() => setInviteRole("editor")}>
                  Editor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setInviteRole("viewer")}>
                  Viewer
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Button
            type="submit"
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            disabled={!inviteEmail.trim() || inviting}
          >
            {inviting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="size-3.5" />
                Send Invite
              </>
            )}
          </Button>
        </form>
      )}

      {/* Non-owner info */}
      {!isOwner && !loading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border">
          <UserPlus className="size-3.5 shrink-0" />
          <span>Only the project owner can invite others.</span>
        </div>
      )}
    </div>
  );
}
