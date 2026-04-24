"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CityOption } from "@/lib/cities";

type Props = {
  label: string;
  cities: CityOption[];
  value: string | null;
  onChange: (slug: string | null) => void;
  placeholder?: string;
};

export default function CitySelect({
  label,
  cities,
  value,
  onChange,
  placeholder = "Search for a city",
}: Props) {
  const listboxId = useId();
  const selected = useMemo(
    () => cities.find((c) => c.slug === value) ?? null,
    [cities, value],
  );
  const displayForValue = selected
    ? `${selected.name}, ${selected.state_code}`
    : "";

  const [query, setQuery] = useState(displayForValue);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Sync query to value when the `value` prop changes from outside (e.g.
  // URL param sync or programmatic reset). Comparing prev-value state
  // during render is the documented React pattern for "adjusting some
  // state when a prop changes" — no effect, no cascading renders.
  // See https://react.dev/learn/you-might-not-need-an-effect
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setQuery(displayForValue);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Empty query: show the top ~100 by population (cities are already
    // ordered that way from getCityOptions) so the dropdown opens with a
    // useful list without being overwhelming. Any search surfaces every
    // match in the full 500-city set.
    if (!q) return cities.slice(0, 100);
    return cities.filter((c) => {
      const hay = `${c.name} ${c.state} ${c.state_code}`.toLowerCase();
      return hay.includes(q);
    });
  }, [query, cities]);

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(option: CityOption) {
    setQuery(`${option.name}, ${option.state_code}`);
    onChange(option.slug);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[highlight]) {
        e.preventDefault();
        pick(filtered[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
        {label}
      </label>
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          if (e.target.value === "") onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="mt-2 w-full h-12 px-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)]"
      />
      {open && filtered.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg"
        >
          {filtered.map((option, i) => (
            <li key={option.slug}>
              <button
                type="button"
                role="option"
                aria-selected={option.slug === value}
                onMouseDown={(e) => {
                  // Prevent input blur before click fires
                  e.preventDefault();
                  pick(option);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-[var(--background)] ${
                  i === highlight ? "bg-[var(--background)]" : ""
                } ${option.slug === value ? "font-semibold" : ""}`}
              >
                <div>{option.name}, {option.state_code}</div>
                {option.cost_index != null && (
                  <div className="text-xs text-[var(--muted)]">
                    Cost index {option.cost_index.toFixed(0)}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
