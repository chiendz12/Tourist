/** Refresh + retry helper used by the BFF proxy route. */
import { API_URL_INTERNAL } from "@/lib/env";
import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "./cookies";

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export async function refreshTokens(
  refreshToken: string,
): Promise<RefreshResult | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL_INTERNAL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: RefreshResult };
    return data?.data ?? null;
  } catch {
    return null;
  }
}

export { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies };
