import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

// Crude in-memory per-IP limiter. Not shared across serverless instances (each
// gets its own counters), but it's a near-zero-cost gate in front of every
// page view and server action — real usage from one or two people never gets
// close, while a script hammering the app gets stopped here instead of
// running up Prisma/Neon usage on every hit.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 200;
const MAX_TRACKED_IPS = 5000; // bounds memory if many distinct IPs show up at once

const hits = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(request: NextRequest): boolean {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || entry.resetAt < now) {
    if (hits.size >= MAX_TRACKED_IPS) hits.clear();
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > MAX_REQUESTS_PER_WINDOW;
}

// Optimistic redirect only — real checks happen server-side in requireUser()/requireAdmin().
export function proxy(request: NextRequest) {
  if (isRateLimited(request)) {
    return new NextResponse("Too many requests — slow down and try again in a minute.", {
      status: 429,
      headers: { "Retry-After": "60" },
    });
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons).*)"],
};
