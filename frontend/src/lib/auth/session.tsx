"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { authApi } from "@/lib/api/services";
import type { CurrentUser } from "@/lib/api/types";

interface SessionValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = React.createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = React.useState<CurrentUser | null>(null);
  const [isLoading, setLoading] = React.useState(true);

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      // A dead session must surface immediately: otherwise the header
      // keeps showing a logged-in user whose server gates all bounce.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Revalidate on every navigation (silently after the first paint) so the
  // header never shows a stale logged-in state with dead cookies.
  const firstRun = React.useRef(true);
  React.useEffect(() => {
    const silent = !firstRun.current;
    firstRun.current = false;
    void load(silent);
  }, [pathname, load]);

  // Revalidate when the tab regains focus (tokens may have expired away).
  React.useEffect(() => {
    const onFocus = () => {
      void load(true);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const value: SessionValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    refresh: load,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within <SessionProvider>");
  return ctx;
}
