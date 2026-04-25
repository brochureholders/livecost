/**
 * Client-side analytics helper. Fire-and-forget — never throws, never
 * blocks the page.
 *
 * Usage from any client component:
 *   import { track } from "@/lib/analytics";
 *   track("quiz_started");
 *   track("search_picked", { city_slug: "auburn-al" });
 *
 * Backend allow-list lives in /api/event/route.ts. Adding a new event
 * name requires updating both this file's `EventName` union AND the
 * server allow-list, which is a deliberate guard against leaked
 * endpoint floods.
 */

export type EventName =
  | "quiz_started"
  | "quiz_completed"
  | "quiz_result_clicked"
  | "search_queried"
  | "search_picked"
  | "compare_submitted"
  | "calculator_submitted"
  | "score_profile_changed";

export type EventProps = Record<string, string | number | boolean | null>;

export function track(name: EventName, props?: EventProps): void {
  // Bail in SSR / non-browser contexts.
  if (typeof window === "undefined") return;

  const path =
    typeof window.location !== "undefined"
      ? window.location.pathname + window.location.search
      : null;

  const payload = JSON.stringify({ name, path, props: props ?? null });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/event", blob);
      return;
    }
    // Fallback: best-effort fetch with keepalive so the request survives
    // navigation (e.g. user clicks a result and we navigate away).
    void fetch("/api/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* swallow — analytics must never break UX */
    });
  } catch {
    /* swallow */
  }
}
