import { NextResponse } from "next/server";
import { API_URL_INTERNAL } from "@/lib/env";
import { ACCESS_COOKIE, REFRESH_COOKIE, clearAuthCookies } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  // Best effort: notify the backend (which revokes the refresh token row) but
  // always clear the cookies locally regardless of the upstream result.
  await fetch(`${API_URL_INTERNAL}/auth/logout`, {
    method: "POST",
    headers: { cookie: "" },
    cache: "no-store",
  }).catch(() => undefined);

  const res = NextResponse.json({ ok: true });
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    void name;
  }
  clearAuthCookies(res);
  return res;
}
