"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PresenceUser } from "@/hooks/use-collaborator-presence";

interface PresenceAvatarsProps {
  /** The list of currently present users */
  users: PresenceUser[];
  /** Current signed-in user ID — shown last (or omitted) */
  currentUserId?: string;
  /** Maximum avatars to show before collapsing to a +N badge */
  maxVisible?: number;
}

/**
 * PresenceAvatars — row of overlapping user avatars showing who is online.
 * Each avatar has a colored border unique to the user, with a tooltip showing their name.
 */
export function PresenceAvatars({
  users,
  currentUserId,
  maxVisible = 4,
}: PresenceAvatarsProps) {
  if (users.length === 0) return null;

  // Deduplicate by userId (same user can have multiple presence connections)
  const unique = Array.from(
    new Map(users.map((u) => [u.userId, u])).values()
  );

  // Put the current user last so others are more prominent
  const sorted = [
    ...unique.filter((u) => u.userId !== currentUserId),
    ...unique.filter((u) => u.userId === currentUserId),
  ];

  const visible = sorted.slice(0, maxVisible);
  const overflow = sorted.length - maxVisible;

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex items-center -space-x-1.5">
        {visible.map((user) => {
          const initials = user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const isSelf = user.userId === currentUserId;

          return (
            <Tooltip key={user.userId}>
              <TooltipTrigger asChild>
                <div
                  className="relative size-7 rounded-full overflow-hidden border-2 bg-secondary cursor-default transition-transform hover:z-10 hover:scale-110"
                  style={{ borderColor: user.color }}
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div
                      className="size-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: user.color }}
                    >
                      {initials}
                    </div>
                  )}
                  {/* Green "online" dot */}
                  <span
                    className="absolute bottom-0 right-0 size-2 rounded-full border border-background"
                    style={{ background: "#22c55e" }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isSelf ? `${user.name} (you)` : user.name}
              </TooltipContent>
            </Tooltip>
          );
        })}

        {overflow > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="size-7 rounded-full bg-secondary border-2 border-border flex items-center justify-center cursor-default">
                <span className="text-[10px] font-medium text-muted-foreground">
                  +{overflow}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {overflow} more online
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
