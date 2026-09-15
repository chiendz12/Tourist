import { NextResponse, type NextRequest } from "next/server";
import { API_URL_INTERNAL } from "@/lib/env";
import { setAuthCookies } from "@/lib/auth/cookies";
import type { AuthResult } from "@/lib/api/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.text();

  const upstream = await fetch(`${API_URL_INTERNAL}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body,
    cache: "no-store",
  });

  const payload = (await upstream.json().catch(() => null)) as {
    data?: AuthResult & { pending?: boolean };
  } | null;

  if (!upstream.ok || !payload?.data) {
    return NextResponse.json(
      payload ?? { error: "Không thể tạo tài khoản" },
      { status: upstream.status || 500 },
    );
  }

  // Pending-approval registrations carry no tokens — nothing to sign in.
  if (payload.data.pending || !payload.data.accessToken) {
    return NextResponse.json({ user: payload.data.user, pending: true });
  }

  const { accessToken, refreshToken, user } = payload.data;
  const res = NextResponse.json({ user });
  setAuthCookies(res, { accessToken, refreshToken });
  return res;
}
