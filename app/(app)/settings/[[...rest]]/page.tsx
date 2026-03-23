/**
 * app/(app)/settings/[[...rest]]/page.tsx
 *
 * Settings page with sections for:
 * - Appearance: Theme toggle (Dark / Light / System)
 * - Account: Clerk's `<UserProfile />` which auto-includes a Billing tab
 *   when Clerk Billing is enabled. Shows subscription info, invoices,
 *   payment methods, and upgrade/downgrade/cancel options.
 *
 * Uses a catch-all route ([[...rest]]) so that Clerk's internal
 * path-based navigation (e.g. /settings/security, /settings/billing)
 * is handled by this same page instead of returning 404 on refresh.
 *
 * Protected by Clerk middleware — requires authentication.
 *
 * Used by: app/(app)/layout.tsx (via sidebar navigation)
 */

"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { UserProfile } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme, type Theme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

/**
 * Theme option definitions for the toggle buttons.
 */
const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Moon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * SettingsPage renders the user settings with theme toggle
 * and Clerk's UserProfile component which includes billing management.
 */
export default function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-6 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Appearance Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Choose your preferred theme. Dark mode is the default.
            </p>
          </div>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((option) => {
              const isActive = theme === option.value;
              return (
                <Button
                  key={option.value}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "gap-2",
                    isActive && "pointer-events-none"
                  )}
                >
                  <option.icon className="size-4" />
                  {option.label}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Rate Limits Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rate Limits</CardTitle>
          <CardDescription>
            API request limits to ensure fair usage for all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-6 font-medium text-muted-foreground">Category</th>
                  <th className="pb-2 pr-6 font-medium text-muted-foreground">Free Plan</th>
                  <th className="pb-2 font-medium text-muted-foreground">Pro Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-2 pr-6">AI Generation</td>
                  <td className="py-2 pr-6">10 req/min</td>
                  <td className="py-2">30 req/min</td>
                </tr>
                <tr>
                  <td className="py-2 pr-6">Export</td>
                  <td className="py-2 pr-6">5 req/min</td>
                  <td className="py-2">5 req/min</td>
                </tr>
                <tr>
                  <td className="py-2 pr-6">General API</td>
                  <td className="py-2 pr-6">60 req/min</td>
                  <td className="py-2">60 req/min</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Rate limits reset every 60 seconds. If you hit a limit, the chat will show a countdown timer.
          </p>
        </CardContent>
      </Card>

      {/* Account & Billing Section — Clerk UserProfile */}
      {/* When Clerk Billing is enabled, UserProfile auto-includes a Billing tab */}
      {/* showing: current plan, invoices, payment methods, subscription management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account & Billing</CardTitle>
        </CardHeader>
        <CardContent>
          <UserProfile
            routing="path"
            path="/settings"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-none bg-transparent",
                navbar: "hidden",
                pageScrollBox: "p-0",
              },
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
