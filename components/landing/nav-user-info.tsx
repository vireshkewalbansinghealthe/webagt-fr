"use client";

import { useUser } from "@clerk/nextjs";
import { UserAvatarButton } from "@/components/shared/user-avatar-button";

/**
 * Renders the signed-in user's avatar + name/email in the landing navbar.
 * Isolated as a client component so the parent Navbar stays a Server Component.
 */
export function NavUserInfo() {
  const { user } = useUser();

  const displayName =
    user?.fullName || user?.firstName || user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] || "Account";
  const email = user?.emailAddresses?.[0]?.emailAddress ?? "";

  return (
    <div className="flex items-center gap-2.5">
      <UserAvatarButton
        className="size-8"
        ringClassName="ring-2 ring-white/20 hover:ring-white/40 transition-all"
      />
      <div className="hidden md:flex flex-col leading-none">
        <span className="text-sm font-medium text-white truncate max-w-[140px]">
          {displayName}
        </span>
        {email && (
          <span className="text-[11px] text-white/50 truncate max-w-[140px]">
            {email}
          </span>
        )}
      </div>
    </div>
  );
}
