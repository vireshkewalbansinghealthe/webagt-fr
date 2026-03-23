/**
 * app/(auth)/layout.tsx
 *
 * Layout for the authentication route group (/sign-in, /sign-up).
 * Centers Clerk's auth components in the middle of the screen
 * with a dark background — gives the auth pages a clean, focused feel.
 *
 * The (auth) route group doesn't add a URL segment — /sign-in maps
 * directly to app/(auth)/sign-in/page.tsx.
 *
 * Used by: app/(auth)/sign-in, app/(auth)/sign-up
 */

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      {children}
    </div>
  );
}
