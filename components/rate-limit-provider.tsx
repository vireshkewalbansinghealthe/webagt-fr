/**
 * components/rate-limit-provider.tsx
 *
 * Global rate limit state provider.
 * Stores the rate-limited-until timestamp in React context and
 * sessionStorage so the countdown survives route navigations
 * and persists within the browser tab session.
 *
 * When a 429 is received from the Worker, any component can call
 * setRateLimitedUntil() to start the countdown. The RateLimitBanner
 * component (rendered in the app layout) shows the global indicator,
 * and ChatInput also consumes the context to disable input.
 *
 * Used by: components/providers.tsx, app/(app)/layout.tsx,
 *          components/editor/chat-input.tsx,
 *          app/(app)/project/[projectId]/page.tsx
 */

"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { Clock } from "lucide-react";

/** sessionStorage key for persisting rate limit across navigations */
const STORAGE_KEY = "rateLimitedUntil";

/**
 * Context value shape.
 *
 * @property rateLimitedUntil - Timestamp (ms) when the rate limit expires (null = not limited)
 * @property rateLimitSeconds - Countdown seconds remaining (0 = not limited)
 * @property isRateLimited - Whether the user is currently rate limited
 * @property setRateLimitedUntil - Set the rate limit expiry timestamp
 */
interface RateLimitContextValue {
  rateLimitedUntil: number | null;
  rateLimitSeconds: number;
  isRateLimited: boolean;
  setRateLimitedUntil: (timestamp: number | null) => void;
}

const RateLimitContext = createContext<RateLimitContextValue>({
  rateLimitedUntil: null,
  rateLimitSeconds: 0,
  isRateLimited: false,
  setRateLimitedUntil: () => {},
});

/**
 * RateLimitProvider manages the global rate-limit countdown timer.
 * Persists the expiry timestamp to sessionStorage so navigating
 * between pages doesn't lose the countdown.
 *
 * @param children - App content to wrap
 */
export function RateLimitProvider({ children }: { children: ReactNode }) {
  const [rateLimitedUntil, setRateLimitedUntilState] = useState<number | null>(
    null
  );
  const [rateLimitSeconds, setRateLimitSeconds] = useState(0);

  /**
   * On mount, restore any persisted rate limit from sessionStorage.
   * If the stored timestamp is still in the future, resume the countdown.
   */
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const timestamp = parseInt(stored, 10);
        if (timestamp > Date.now()) {
          setRateLimitedUntilState(timestamp);
        } else {
          sessionStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // sessionStorage unavailable — skip
    }
  }, []);

  /**
   * Listen for "rate-limited" custom events dispatched by the API client.
   * This catches 429 responses from ANY API call (not just chat),
   * including project loads, auto-saves, credit checks, etc.
   */
  useEffect(() => {
    function handleRateLimitEvent(event: Event) {
      const detail = (event as CustomEvent<{ retryAfter: number }>).detail;
      const retryAfter = detail?.retryAfter ?? 60;
      const timestamp = Date.now() + retryAfter * 1000;

      setRateLimitedUntilState(timestamp);
      try {
        sessionStorage.setItem(STORAGE_KEY, String(timestamp));
      } catch {
        // sessionStorage unavailable — skip
      }
    }

    window.addEventListener("rate-limited", handleRateLimitEvent);
    return () =>
      window.removeEventListener("rate-limited", handleRateLimitEvent);
  }, []);

  /**
   * Setter that updates both state and sessionStorage.
   * Passing null clears the rate limit.
   */
  const setRateLimitedUntil = useCallback((timestamp: number | null) => {
    setRateLimitedUntilState(timestamp);
    try {
      if (timestamp) {
        sessionStorage.setItem(STORAGE_KEY, String(timestamp));
      } else {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // sessionStorage unavailable — skip
    }
  }, []);

  /**
   * Countdown effect — ticks every second while rate limited.
   * Clears the rate limit when the timer reaches zero.
   */
  useEffect(() => {
    if (!rateLimitedUntil || rateLimitedUntil <= Date.now()) {
      setRateLimitSeconds(0);
      return;
    }

    setRateLimitSeconds(Math.ceil((rateLimitedUntil - Date.now()) / 1000));

    const interval = setInterval(() => {
      const remaining = Math.ceil((rateLimitedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        setRateLimitSeconds(0);
        setRateLimitedUntilState(null);
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // ignore
        }
        clearInterval(interval);
      } else {
        setRateLimitSeconds(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitedUntil]);

  const isRateLimited = rateLimitSeconds > 0;

  return (
    <RateLimitContext.Provider
      value={{
        rateLimitedUntil,
        rateLimitSeconds,
        isRateLimited,
        setRateLimitedUntil,
      }}
    >
      {children}
    </RateLimitContext.Provider>
  );
}

/**
 * Hook to access the global rate limit state and setter.
 *
 * @returns The rate limit context value
 */
export function useRateLimit() {
  return useContext(RateLimitContext);
}

/**
 * RateLimitBanner renders an amber banner at the top of the page
 * when the user is rate limited. Shows a countdown timer.
 * Renders nothing when not rate limited.
 *
 * Used by: app/(app)/layout.tsx
 */
export function RateLimitBanner() {
  const { isRateLimited, rateLimitSeconds } = useRateLimit();

  if (!isRateLimited) return null;

  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-500">
      <Clock className="size-4 shrink-0" />
      <span>
        You&apos;re being rate limited — please wait{" "}
        <span className="font-medium">{rateLimitSeconds}s</span> before trying
        again
      </span>
    </div>
  );
}
