import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-layer logic that runs before any route handler. Two responsibilities:
 *
 *   1. Canonicalize /compare?from=X&to=Y into /compare/{min}-vs-{max} — can't
 *      live in next.config.ts because the destination is computed from the
 *      query string. Runs before ISR so the cache doesn't swallow params.
 *   2. Gate /admin/* behind Basic Auth. Single-admin tool; ADMIN_USER and
 *      ADMIN_PASSWORD env vars must be set in .env.local AND in Vercel.
 *
 * Note: Next 16 deprecated this filename in favor of `proxy.ts`, but as of
 * 16.2.4 Turbopack's edge bundle still hardcodes `middleware.ts` references
 * after a rename, so we stay on the deprecated name for now. Migrate when
 * a future Next release fully cuts over.
 */
export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === "/compare") {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to && from !== to) {
      const [a, b] = [from, to].sort();
      const redirect = new URL(`/compare/${a}-vs-${b}`, req.url);
      return NextResponse.redirect(redirect, { status: 308 });
    }
  }

  if (pathname.startsWith("/admin")) {
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASSWORD;
    if (!user || !pass) {
      // Misconfiguration — refuse to serve rather than expose an open admin.
      return new NextResponse(
        "Admin not configured. Set ADMIN_USER and ADMIN_PASSWORD env vars.",
        { status: 503 },
      );
    }

    const auth = req.headers.get("authorization");
    // Hand-rolled base64 because the Edge runtime doesn't have Node's Buffer.
    const expected = "Basic " + btoa(`${user}:${pass}`);
    if (auth !== expected) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="UrbRank Admin"' },
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/compare", "/admin/:path*"],
};
