"use client";

import { LogOut } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { useSession } from "@/lib/auth/session";

/** Signs the user out via the session route, then lands on login. */
export function LogoutButton({ className }: { className?: string }) {
  const { refresh } = useSession();
  const logout = async () => {
    try {
      await fetch("/session/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    // Hard navigation: drops SessionContext + router cache entirely. A
    // client-side replace can land on /login while stale session state is
    // still committed, and the login page then bounces straight to /me.
    try {
      await refresh();
    } catch {
      /* session already gone */
    }
    window.location.href = "/login";
  };
  return (
    <button type="button" onClick={logout} className={className ?? buttonClass({ variant: "outline" })}>
      <LogOut className="size-4" />
      Đăng xuất
    </button>
  );
}
