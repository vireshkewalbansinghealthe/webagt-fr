/**
 * components/editor/device-toggle.tsx
 *
 * Pill-shaped toggle for switching the preview between device viewports.
 * Three modes: Desktop (100%), Tablet (768px), Phone (375px).
 *
 * Only rendered on desktop when the Preview tab is active.
 * Uses the same visual pattern as the tab switcher pill
 * (active = bg-foreground text-background, inactive = muted).
 *
 * Used by: components/editor/editor-header.tsx
 */

"use client";

import { Monitor, Tablet, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The three device modes available for the preview.
 * - desktop: 100% width (no frame)
 * - tablet: 768px centered with frame
 * - phone: 375px centered with frame
 */
export type DeviceMode = "desktop" | "tablet" | "phone";

/**
 * Props for the DeviceToggle component.
 *
 * @property deviceMode - Currently selected device mode
 * @property onDeviceModeChange - Callback when user clicks a device button
 */
export interface DeviceToggleProps {
  deviceMode: DeviceMode;
  onDeviceModeChange: (mode: DeviceMode) => void;
}

/**
 * Device options with their icons and labels.
 */
const DEVICES = [
  { mode: "desktop" as const, icon: Monitor, label: "Desktop" },
  { mode: "tablet" as const, icon: Tablet, label: "Tablet (768px)" },
  { mode: "phone" as const, icon: Smartphone, label: "Phone (375px)" },
] as const;

/**
 * DeviceToggle renders three icon buttons in a compact pill shape.
 * The active device gets a filled background matching the tab switcher style.
 * Includes aria-labels for accessibility and tooltips via title attribute.
 *
 * @param deviceMode - Currently active device mode
 * @param onDeviceModeChange - Called when user selects a different device
 */
export function DeviceToggle({
  deviceMode,
  onDeviceModeChange,
}: DeviceToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-secondary/60 p-0.5">
      {DEVICES.map((device) => {
        const isActive = deviceMode === device.mode;
        return (
          <button
            key={device.mode}
            onClick={() => onDeviceModeChange(device.mode)}
            title={device.label}
            aria-label={`Preview as ${device.label}`}
            className={cn(
              "flex cursor-pointer items-center justify-center rounded-md p-1.5 transition-all duration-150",
              isActive
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <device.icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
