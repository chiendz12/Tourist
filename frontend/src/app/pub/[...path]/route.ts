import { NextResponse, type NextRequest } from "next/server";
import { API_URL_INTERNAL } from "@/lib/env";

/**
 * Same-origin proxy for PUBLIC (unauthenticated) reads. Browser calls to
 * the backend API directly are blocked by the API's CORS allowlist, so
 * public traffic goes through here instead. No cookies are forwarded.
 */
export const dynamic = "force-dynamic";

async function forward(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname.replace(/^\/pub\/?/, "");
  const target = `${API_URL_INTERNAL}/${path}${req.nextUrl.search}`;
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "manual",
    });
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Không kết nối được máy chủ API" },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest) {
  return forward(req);
}
