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

export async function POST(req: Request) {
  // No-op if Supabase isn't configured — keeps local dev friction-free.
  if (!admin) return new Response(null, { status: 204 });

  let body: { path?: unknown; referrer?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return new Response("invalid body", { status: 400 });
  }

  const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;
  if (!path || !path.startsWith("/")) {
    return new Response("invalid path", { status: 400 });
  }

  const referrer =
    typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry") ??
    null;

  // Fire-and-forget insert; any failure here should never break the page load.
  await admin
    .from("page_views")
    .insert({ path, referrer, user_agent: userAgent, country })
    .then(
      () => null,
      (err) => {
        console.warn("[pageview] insert failed", err);
      },
    );

  return new Response(null, { status: 204 });
}
