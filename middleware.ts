import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge-layer redirects that can't be expressed as static next.config.ts
 * rules because the destination is computed from query-string inputs.
 *
 * Currently: /compare?from=X&to=Y  →  /compare/{min(X,Y)}-vs-{max(X,Y)}
 *
 * Runs at the edge before any route handler, so ISR caching on the
 * /compare landing page can't swallow the query string anymore.
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/compare"],
};
