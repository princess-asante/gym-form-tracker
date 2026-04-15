import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "session-id";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export function proxy(request: NextRequest) {
  const existingId = request.cookies.get(SESSION_COOKIE)?.value;
  const sessionId = existingId ?? crypto.randomUUID();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-session-id", sessionId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  if (!existingId) {
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api",
      maxAge: MAX_AGE,
    });
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};