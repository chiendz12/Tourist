/**
 * Same-origin BFF wrapper. The browser never sees the raw API URL for
 * authenticated calls; instead, it calls /bff/* and the server injects the
 * bearer cookie. Public endpoints (search, nearby, bbox, geocode, etc.)
 * can still hit the public API directly.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ApiBody = BodyInit | null | undefined | object;
type ApiQuery = Record<string, string | number | boolean | readonly string[] | null | undefined>;
type ApiInit = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: ApiBody;
  query?: ApiQuery;
  signal?: AbortSignal;
  /** Skip cookies by hitting the public URL directly (server-side / BFF only). */
  public?: boolean;
  /**
   * Cache public GETs in the Data Cache for N seconds. Repeat visits then
   * skip the backend entirely. NEVER use for user-specific data.
   */
  revalidate?: number;
};

function toQuery(query: ApiQuery | undefined): string {
  if (!query) return "";
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/**
 * Server-side bearer header. Server Components cannot call the same-origin
 * BFF with a relative URL (Node fetch has no base), so authenticated
 * server calls go straight to the API with the user's access cookie.
 * Dynamic imports keep next/headers out of the client bundle.
 */
async function serverAuthHeaders(): Promise<Record<string, string>> {
  try {
    const [{ cookies }, { ACCESS_COOKIE }] = await Promise.all([
      import("next/headers"),
      import("@/lib/auth/cookies"),
    ]);
    const token = (await cookies()).get(ACCESS_COOKIE)?.value;
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Server-side equivalent of the BFF's refresh-on-401: swap the refresh
 * cookie for a fresh access token and return it. The new pair cannot be
 * persisted from a Server Component (no cookie writes allowed there), but
 * it lets the current render succeed; client BFF calls persist rotation.
 */
async function serverRefreshAccessToken(base: string): Promise<string | null> {
  try {
    const [{ cookies }, { REFRESH_COOKIE }] = await Promise.all([
      import("next/headers"),
      import("@/lib/auth/cookies"),
    ]);
    const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
    if (!refreshToken) return null;
    const res = await fetch(`${base}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: { accessToken?: string };
      accessToken?: string;
    };
    return body.data?.accessToken ?? body.accessToken ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const isServer = typeof window === "undefined";
  // Public reads go direct-to-API on the server (no CORS server-side) but
  // through the same-origin /pub proxy in the browser, because the API's
  // CORS allowlist does not include the frontend dev origin.
  // Authenticated reads use /bff in the browser; on the server they call
  // the API directly with the request's access token (relative /bff URLs
  // cannot resolve in Node, which previously broke every server gate).
  const base = init.public
    ? isServer
      ? (process.env.API_URL_INTERNAL ??
        process.env.NEXT_PUBLIC_API_URL ??
        "")
      : "/pub"
    : isServer
      ? (process.env.API_URL_INTERNAL ??
        process.env.NEXT_PUBLIC_API_URL ??
        "")
      : "/bff";
  const authHeaders = !init.public && isServer ? await serverAuthHeaders() : {};
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}${toQuery(init.query)}`;
  const cacheOpt =
    init.revalidate != null && (init.method ?? "GET") === "GET"
      ? { next: { revalidate: init.revalidate } }
      : { cache: "no-store" as const };
  const doFetch = (extra?: Record<string, string>) =>
    fetch(url, {
      method: init.method ?? "GET",
      credentials: init.public ? "omit" : "include",
      signal: init.signal,
      headers: {
        ...(init.body ? { "content-type": "application/json" } : undefined),
        ...authHeaders,
        ...extra,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      ...cacheOpt,
    });
  let res = await doFetch();
  if (res.status === 401 && !init.public && isServer) {
    const fresh = await serverRefreshAccessToken(base);
    if (fresh) res = await doFetch({ authorization: `Bearer ${fresh}` });
  }
  if (!res.ok) {
    let msg = res.statusText || `HTTP ${res.status}`;
    try {
      const data = await res.json();
      msg =
        (data && (data.message || data.error?.message || data.error)) || msg;
    } catch {
      /* ignore */
    }
    throw new ApiError(String(msg), res.status);
  }
  if (res.status === 204) return undefined as T;
  return unwrap(await res.json()) as T;
}

/**
 * The NestJS API wraps every JSON payload in `{ success, data, timestamp }`.
 * Unwrap once here so all service callers receive the inner `data` shape
 * they declare (arrays, paginated objects, entities). Non-enveloped bodies
 * pass through untouched.
 */
function unwrap<T>(body: T): T {
  if (
    body !== null &&
    typeof body === "object" &&
    !Array.isArray(body) &&
    (body as { success?: unknown }).success === true &&
    "data" in body
  ) {
    return (body as { data: T }).data;
  }
  return body;
}
