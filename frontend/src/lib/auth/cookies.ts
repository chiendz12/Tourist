/**
 * Same-origin auth cookies. The browser never sees raw API tokens;
 * the BFF proxy attaches them on outbound requests.
 */
export const ACCESS_COOKIE = "vj_access";
export const REFRESH_COOKIE = "vj_refresh";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function setAuthCookies(
  res: Response,
  tokens: TokenPair,
): void {
  const isProd = process.env.NODE_ENV === "production";
  const base = {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };
  res.headers.append(
    "Set-Cookie",
    `${ACCESS_COOKIE}=${tokens.accessToken}; ${Object.entries({
      ...base,
      "Max-Age": 60 * 30,
    })
      .map(([k, v]) => `${k}=${v}`)
      .join("; ")}`,
  );
  res.headers.append(
    "Set-Cookie",
    `${REFRESH_COOKIE}=${tokens.refreshToken}; ${Object.entries({
      ...base,
      "Max-Age": 60 * 60 * 24 * 7,
    })
      .map(([k, v]) => `${k}=${v}`)
      .join("; ")}`,
  );
}

export function clearAuthCookies(res: Response): void {
  // Must mirror setAuthCookies flags (esp. Secure in prod): a Secure cookie
  // cannot be deleted by a non-Secure Set-Cookie, which would leave the user
  // logged in and bounce them straight back to /me after logout.
  const isProd = process.env.NODE_ENV === "production";
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    res.headers.append(
      "Set-Cookie",
      `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProd ? "; Secure" : ""}`,
    );
  }
}
