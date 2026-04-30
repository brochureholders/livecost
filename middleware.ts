import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { VANITY_TO_CANONICAL } from "@/lib/vanity-slugs";

/**
 * Edge-layer logic that runs before any route handler. Three responsibilities:
 *
 *   1. Canonicalize /compare?from=X&to=Y into /compare/{min}-vs-{max} — can't
 *      live in next.config.ts because the destination is computed from the
 *      query string. Runs before ISR so the cache doesn't swallow params.
 *   2. Vanity-slug redirects: /cost-of-living/nashville-tn,
 *      /should-i-move-to/louisville-ky, /compare/honolulu-hi-vs-… —
 *      301 to the long Census-canonical slug stored in the DB so the
 *      page itself only ever renders one URL.
 *   3. Gate /admin/* behind Basic Auth. Single-admin tool; ADMIN_USER and
 *      ADMIN_PASSWORD env vars must be set in .env.local AND in Vercel.
 *
 * Note: Next 16 deprecated this filename in favor of `proxy.ts`, but as of
 * 16.2.4 Turbopack's edge bundle still hardcodes `middleware.ts` references
 * after a rename, so we stay on the deprecated name for now. Migrate when
 * a future Next release fully cuts over.
 */

/** Resolve a single slug to its canonical form, or return it unchanged. */
function canonicalize(slug: string): string {
  return VANITY_TO_CANONICAL[slug] ?? slug;
}

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === "/compare") {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from && to && from !== to) {
      // Resolve vanity slugs in form-submit redirects too so a search like
      // "Nashville" → "Detroit" still lands on the canonical pair.
      const [a, b] = [canonicalize(from), canonicalize(to)].sort();
      const redirect = new URL(`/compare/${a}-vs-${b}`, req.url);
      return NextResponse.redirect(redirect, { status: 308 });
    }
  }

  // Vanity redirects for the city-profile and urbrank-score routes. Pattern
  // is /{prefix}/{slug} — extract slug, swap if it's a vanity, 301 redirect.
  for (const prefix of ["/cost-of-living/", "/should-i-move-to/"]) {
    if (pathname.startsWith(prefix)) {
      const slug = pathname.slice(prefix.length).split("/")[0];
      const canonical = VANITY_TO_CANONICAL[slug];
      if (canonical) {
        const redirect = new URL(`${prefix}${canonical}`, req.url);
        // Preserve any query string the user came in with.
        redirect.search = req.nextUrl.search;
        return NextResponse.redirect(redirect, { status: 301 });
      }
      break;
    }
  }

  // Comparison-page vanity redirect: /compare/{a}-vs-{b}. If either half is
  // a vanity slug, swap and re-canonicalize alphabetical order.
  if (pathname.startsWith("/compare/")) {
    const pair = pathname.slice("/compare/".length).split("/")[0];
    const sep = "-vs-";
    const idx = pair.indexOf(sep);
    if (idx > 0) {
      const a = pair.slice(0, idx);
      const b = pair.slice(idx + sep.length);
      const ca = canonicalize(a);
      const cb = canonicalize(b);
      if (ca !== a || cb !== b) {
        const [x, y] = [ca, cb].sort();
        const redirect = new URL(`/compare/${x}-vs-${y}`, req.url);
        redirect.search = req.nextUrl.search;
        return NextResponse.redirect(redirect, { status: 301 });
      }
    }
  }

  if (pathname.startsWith("/admin")) {
    const user = process.env.ADMIN_USER;
    const pass = process.env.ADMIN_PASSWORD;
    if (!user || !pass) {
      // Misconfiguration — refuse to serve rather than expose an open admin.
      // Reports which specific var is missing (without leaking values) so
      // a Vercel scope/typo issue is diagnosable from the response itself.
      const missing = [
        !user && "ADMIN_USER",
        !pass && "ADMIN_PASSWORD",
      ]
        .filter(Boolean)
        .join(", ");
      return new NextResponse(
        `Admin not configured. Missing env var(s): ${missing}. Set them in Vercel → Settings → Environment Variables → Production, then redeploy.`,
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
  matcher: [
    "/compare",
    "/compare/:pair",
    "/cost-of-living/:slug",
    "/should-i-move-to/:slug",
    "/admin/:path*",
  ],
};
