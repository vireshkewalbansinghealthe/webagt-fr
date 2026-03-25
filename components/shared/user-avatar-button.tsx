"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { cn } from "@/lib/utils";

interface UserAvatarButtonProps {
  /** Extra classes applied to the outer wrapper (controls size via Tailwind) */
  className?: string;
  /** Ring style applied to the visible avatar image */
  ringClassName?: string;
}

/**
 * Shows a custom branded avatar (public/image.png) when the user has not
 * uploaded their own profile photo, while keeping Clerk's UserButton
 * dropdown fully functional via an invisible click-through overlay.
 *
 * Uses user.hasImage — Clerk sets this to true only when the user has
 * explicitly uploaded a photo, false for auto-generated initials avatars.
 */
export function UserAvatarButton({ className, ringClassName }: UserAvatarButtonProps) {
  const { user } = useUser();

  const avatarSrc = user?.hasImage ? (user.imageUrl ?? "/image.png") : "/image.png";

  return (
    <div className={cn("relative shrink-0", className)}>
      {/* Visible avatar — our branded default or user's real photo */}
      <img
        src={avatarSrc}
        alt={user?.fullName ?? "Profile"}
        className={cn(
          "size-full rounded-full object-cover pointer-events-none select-none",
          ringClassName
        )}
      />

      {/* Invisible Clerk UserButton overlay — keeps dropdown accessible */}
      <div
        className="absolute inset-0 opacity-0 [&_button]:size-full [&_button]:rounded-full"
        aria-hidden="false"
      >
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-full",
              userButtonTrigger: "size-full",
            },
          }}
        />
      </div>
    </div>
  );
}
