import { getCoverageBySlug, type Dim, type Status } from "@/lib/coverage";

type Note = { city: string; message: string };

const MISSING_MESSAGES: Partial<Record<Dim, (city: string) => string>> = {
  safety: (city) =>
    `Crime data for ${city} is temporarily unavailable — the FBI Crime Data Explorer API is currently down.`,
  environment: (city) => `Air quality data for ${city} is unavailable.`,
  walkability: (city) => `Walk Score for ${city} is unavailable.`,
  climate: (city) => `Climate data for ${city} is unavailable.`,
};

const FALLBACK_MESSAGES: Partial<Record<Dim, (city: string) => string>> = {
  climate: (city) =>
    `Climate data for ${city} uses a state-average fallback (no local NCEI station).`,
};

function notesFor(slug: string): Note[] {
  const cov = getCoverageBySlug(slug);
  if (!cov) return [];
  const out: Note[] = [];
  for (const key of Object.keys(cov.dims) as Dim[]) {
    const status: Status = cov.dims[key];
    const make =
      status === "missing"
        ? MISSING_MESSAGES[key]
        : status === "fallback"
          ? FALLBACK_MESSAGES[key]
          : null;
    if (make) out.push({ city: cov.name, message: make(cov.name) });
  }
  return out;
}

export default function DataCompletenessBadge({ slugs }: { slugs: string[] }) {
  const seen = new Set<string>();
  const notes: Note[] = [];
  for (const slug of slugs) {
    for (const n of notesFor(slug)) {
      if (seen.has(n.message)) continue;
      seen.add(n.message);
      notes.push(n);
    }
  }
  if (notes.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <div className="font-semibold uppercase tracking-widest text-xs mb-2">
        Data note
      </div>
      <ul className="space-y-1.5">
        {notes.map((n) => (
          <li key={n.message}>{n.message}</li>
        ))}
      </ul>
    </div>
  );
}
