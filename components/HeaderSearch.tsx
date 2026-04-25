"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { track } from "@/lib/analytics";

type CityEntry = { slug: string; name: string; state_code: string };

/**
 * Global city search for the header. On first focus, lazy-fetches the
 * compact 1000-city index from /api/cities-index (cached at the edge),
 * then provides typeahead. Submitting routes to /should-i-move-to/[slug]
 * which renders the city's UrbRank Score profile.
 *
 * Keyboard:  ↑/↓ to navigate, Enter to pick, Esc to close.
 */
export default function HeaderSearch() {
  const router = useRouter();
  const listboxId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [cities, setCities] = useState<CityEntry[] | null>(null);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Fetch the city index once, on first focus. Runs at most once per
  // session because the cached promise is held in component state.
  async function ensureIndex() {
    if (cities || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cities-index", { cache: "force-cache" });
      if (res.ok) setCities(await res.json());
    } catch {
      // Silent fail — search will just be empty until a retry.
    } finally {
      setLoading(false);
    }
  }

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Filter to top 8 matches. If query is empty, show top 8 by population
  // (the index is already population-sorted).
  const q = query.trim().toLowerCase();
  const filtered = cities
    ? q.length === 0
      ? cities.slice(0, 8)
      : cities
          .filter((c) => {
            const hay = `${c.name} ${c.state_code}`.toLowerCase();
            return hay.includes(q);
          })
          .slice(0, 8)
    : [];

  function navigateTo(c: CityEntry) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    track("search_picked", {
      city_slug: c.slug,
      query: query.slice(0, 100),
    });
    router.push(`/should-i-move-to/${c.slug}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      const pick = filtered[highlight];
      if (pick) {
        e.preventDefault();
        navigateTo(pick);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-xs hidden md:block">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={query}
        placeholder="Search 1,000 cities…"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => {
          setOpen(true);
          ensureIndex();
        }}
        onKeyDown={onKeyDown}
        className="w-full h-9 pl-3 pr-3 text-sm rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
      />
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-72 max-h-80 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg right-0"
        >
          {loading && filtered.length === 0 && (
            <li className="px-4 py-2.5 text-sm text-[var(--muted)] italic">
              Loading…
            </li>
          )}
          {!loading && filtered.length === 0 && cities != null && (
            <li className="px-4 py-2.5 text-sm text-[var(--muted)] italic">
              No matches.
            </li>
          )}
          {filtered.map((c, i) => (
            <li key={c.slug}>
              <button
                type="button"
                role="option"
                aria-selected={i === highlight}
                onMouseDown={(e) => {
                  e.preventDefault();
                  navigateTo(c);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--background)] ${
                  i === highlight ? "bg-[var(--background)]" : ""
                }`}
              >
                <span className="font-medium">{c.name}</span>{" "}
                <span className="text-[var(--muted)]">{c.state_code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
