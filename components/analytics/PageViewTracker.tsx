"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTracked = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    if (lastTracked.current === path) return;
    lastTracked.current = path;

    const payload = JSON.stringify({
      path,
      referrer: document.referrer || null,
    });

    // Prefer sendBeacon so the request survives navigation.
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/pageview", blob);
      return;
    }

    fetch("/api/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      /* swallow — analytics must never break the page */
    });
  }, [pathname, searchParams]);

  return null;
}
