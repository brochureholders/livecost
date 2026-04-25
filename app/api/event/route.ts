/**
 * Custom event tracker. Pairs with lib/analytics.ts on the client.
 *
 * Body: { name: string, path?: string, props?: object }
 *
 * Strict allow-list of event names — anything else is dropped, so a
 * leaked endpoint can't be used to flood the table with arbitrary
 * categories. Props are stored as JSONB and never inspected; client
 * is expected to keep them small (a few key/value pairs).
 */
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

const urlOk = !!SUPABASE_URL && /^https?:\/\//.test(SUPABASE_URL);
const keyOk =
  !!SERVICE_ROLE && SERVICE_ROLE !== "your-supabase-service-role-key";

const admin =
  urlOk && keyOk
    ? createClient(SUPABASE_URL!, SERVICE_ROLE!, {
        auth: { persistSession: false },
      })
    : null;

// Allow-list of event names. Add new entries here as the product grows.
const ALLOWED_EVENTS = new Set<string>([
  "quiz_started",
  "quiz_completed",
  "quiz_result_clicked",
  "search_queried",
  "search_picked",
  "compare_submitted",
  "calculator_submitted",
  "score_profile_changed",
]);

const MAX_PROPS_BYTES = 2_000;

export async function POST(req: Request) {
  if (!admin) return new Response(null, { status: 204 });

  let body: { name?: unknown; path?: unknown; props?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return new Response("invalid body", { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : null;
  if (!name || !ALLOWED_EVENTS.has(name)) {
    return new Response("invalid name", { status: 400 });
  }

  const path =
    typeof body.path === "string" ? body.path.slice(0, 500) : null;

  // Validate props is a plain object and not too large.
  let props: Record<string, unknown> | null = null;
  if (body.props && typeof body.props === "object" && !Array.isArray(body.props)) {
    const serialized = JSON.stringify(body.props);
    if (serialized.length <= MAX_PROPS_BYTES) {
      props = body.props as Record<string, unknown>;
    }
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  await admin
    .from("events")
    .insert({
      name,
      path,
      props,
      user_agent: userAgent,
      country,
    })
    .then(
      () => null,
      (err) => {
        console.warn("[event] insert failed", err);
      },
    );

  return new Response(null, { status: 204 });
}
