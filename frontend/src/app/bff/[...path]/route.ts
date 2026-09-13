import { NextResponse, type NextRequest } from "next/server";
import { API_URL_INTERNAL } from "@/lib/env";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from "@/lib/auth/cookies";
import { refreshTokens } from "@/lib/auth/refresh";

/**
 * Same-origin BFF proxy. Forwards /bff/<path> to the NestJS API, injecting the
 * httpOnly access token cookie. On 401 it tries the refresh cookie once,
 * retries the request, and writes the new tokens back to the response.
 */
export const dynamic = "force-dynamic";

async function forward(
  req: NextRequest,
  path: string,
  bodyBuffer: ArrayBuffer | undefined,
  accessToken: string | undefined,
): Promise<Response> {
  const search = req.nextUrl.search;
  const target = `${API_URL_INTERNAL}/${path}${search}`;

  const headers = new Headers();
  headers.set("accept", "application/json");
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);

  return fetch(target, {
    method: req.method,
    headers,
    body:
      bodyBuffer && bodyBuffer.byteLength > 0 ? bodyBuffer : undefined,
    cache: "no-store",
    redirect: "manual",
  });
}

async function relay(
  upstream: Response,
  refreshed?: RefreshResult | null,
  cleared?: boolean,
): Promise<NextResponse> {
  const buf = await upstream.arrayBuffer();
  const res = new NextResponse(buf, {
    status: upstream.status,
    headers: {
      "content-type":
        upstream.headers.get("content-type") ?? "application/json",
    },
  });
  if (refreshed) setAuthCookies(res, refreshed);
  if (cleared) clearAuthCookies(res);
  return res;
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(req, ctx);
}
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(req, ctx);
}
export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(req, ctx);
}
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(req, ctx);
}
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return handle(req, ctx);
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> | { path: string[] } },
) {
  const raw = await Promise.resolve(ctx.params);
  const segments = Array.isArray(raw.path) ? raw.path : [raw.path];
  const path = segments.map(encodeURIComponent).join("/");

  const access = req.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value;

  const hasBody = !["GET", "HEAD"].includes(req.method);
  const bodyBuffer = hasBody ? await req.arrayBuffer() : undefined;

  let upstream = await forward(req, path, bodyBuffer, access);

  if (upstream.status !== 401 || !refresh) {
    return relay(upstream);
  }

  const tokens = await refreshTokens(refresh);
  if (!tokens) {
    return relay(upstream, null, true);
  }

  upstream = await forward(req, path, bodyBuffer, tokens.accessToken);
  return relay(upstream, tokens);
}
