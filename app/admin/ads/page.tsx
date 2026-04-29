import Link from "next/link";
import { listAllAds, AD_SLOTS, type AdSlotName } from "@/lib/ads";
import { deleteAd, toggleEnabled } from "./actions";

export const dynamic = "force-dynamic";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isAdSlot(s: string): s is AdSlotName {
  return AD_SLOTS.some((x) => x.name === s);
}

type SearchParams = { slot?: string };

export default async function AdsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ads = await listAllAds();
  const params = await searchParams;
  const activeSlot: AdSlotName =
    params.slot && isAdSlot(params.slot) ? params.slot : AD_SLOTS[0].name;

  // Counts per slot for the tab badges.
  const counts = new Map<AdSlotName, { total: number; live: number }>();
  for (const s of AD_SLOTS) counts.set(s.name, { total: 0, live: 0 });
  for (const a of ads) {
    const c = counts.get(a.slot as AdSlotName);
    if (!c) continue;
    c.total++;
    if (a.enabled) c.live++;
  }

  const activeMeta = AD_SLOTS.find((s) => s.name === activeSlot)!;
  const items = ads.filter((a) => a.slot === activeSlot);

  return (
    <div>
      {/* Header row: title + new-block CTA */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Ad blocks</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {ads.length} block{ads.length === 1 ? "" : "s"} across{" "}
            {AD_SLOTS.length} slots.
          </p>
        </div>
        <Link
          href={`/admin/ads/new?slot=${activeSlot}`}
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          + New block in {activeSlot}
        </Link>
      </div>

      {/* Tabs */}
      <nav
        aria-label="Ad slots"
        className="mt-6 -mx-1 flex flex-wrap gap-1 border-b border-[var(--border)]"
      >
        {AD_SLOTS.map((s) => {
          const c = counts.get(s.name)!;
          const active = s.name === activeSlot;
          return (
            <Link
              key={s.name}
              href={`/admin/ads?slot=${s.name}`}
              className={[
                "relative -mb-px px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                active
                  ? "border-[var(--accent)] text-[var(--foreground)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
              ].join(" ")}
            >
              <span className="font-mono text-xs">{s.name}</span>
              <span
                className={[
                  "ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-semibold tabular-nums",
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--border)] text-[var(--muted)]",
                ].join(" ")}
              >
                {c.total}
              </span>
              {c.live > 0 && c.live < c.total && (
                <span className="ml-1.5 text-[10px] text-[var(--muted)]">
                  ({c.live} live)
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Active slot description */}
      <div className="mt-6 mb-5">
        <p className="text-xs text-[var(--muted)]">{activeMeta.description}</p>
      </div>

      {/* Block list (or empty state) for the active slot */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center">
          <p className="text-sm text-[var(--muted)]">
            No blocks for{" "}
            <code className="font-mono text-xs">{activeSlot}</code> yet.
          </p>
          <Link
            href={`/admin/ads/new?slot=${activeSlot}`}
            className="mt-4 inline-block px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
          >
            + Create the first one
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((ad) => (
            <li
              key={ad.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)]/50 transition-colors"
            >
              <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-4 p-4">
                {/* Thumbnail */}
                <div className="md:row-span-2 flex items-center justify-center bg-[var(--background)] rounded-lg border border-[var(--border)] aspect-[3/2] overflow-hidden">
                  {ad.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={ad.image_url}
                      alt={ad.alt_text ?? ""}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
                      Raw HTML
                    </span>
                  )}
                </div>

                {/* Title + metadata */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{ad.name}</span>
                    {ad.enabled ? (
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                        Live
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                        Paused
                      </span>
                    )}
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                    <div>
                      <dt className="inline font-medium text-[var(--foreground)]">
                        Weight:
                      </dt>{" "}
                      <dd className="inline tabular-nums">{ad.weight}</dd>
                    </div>
                    <div className="truncate">
                      <dt className="inline font-medium text-[var(--foreground)]">
                        Updated:
                      </dt>{" "}
                      <dd className="inline">{fmtDate(ad.updated_at)}</dd>
                    </div>
                    {ad.page_filter && (
                      <div className="col-span-2 truncate font-mono">
                        <dt className="inline font-medium text-[var(--foreground)] not-italic">
                          Filter:
                        </dt>{" "}
                        <dd className="inline">{ad.page_filter}</dd>
                      </div>
                    )}
                    {(ad.start_at || ad.end_at) && (
                      <div className="col-span-2 truncate">
                        <dt className="inline font-medium text-[var(--foreground)]">
                          Schedule:
                        </dt>{" "}
                        <dd className="inline">
                          {fmtDate(ad.start_at)} → {fmtDate(ad.end_at)}
                        </dd>
                      </div>
                    )}
                    {ad.click_url && (
                      <div className="col-span-2 truncate">
                        <dt className="inline font-medium text-[var(--foreground)]">
                          Link:
                        </dt>{" "}
                        <dd className="inline">
                          <a
                            href={ad.click_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--accent)] hover:underline"
                          >
                            {ad.click_url}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Actions */}
                <div className="flex md:flex-col items-stretch gap-2 md:min-w-32">
                  <form
                    action={async () => {
                      "use server";
                      await toggleEnabled(
                        ad.id,
                        ad.slot as AdSlotName,
                        !ad.enabled,
                      );
                    }}
                    className="flex-1 md:flex-none"
                  >
                    <button
                      type="submit"
                      className="w-full px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
                    >
                      {ad.enabled ? "Pause" : "Resume"}
                    </button>
                  </form>
                  <Link
                    href={`/admin/ads/${ad.id}`}
                    className="flex-1 md:flex-none px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--accent)] transition-colors text-center"
                  >
                    Edit
                  </Link>
                  <form
                    action={async () => {
                      "use server";
                      await deleteAd(ad.id, ad.slot as AdSlotName);
                    }}
                    className="flex-1 md:flex-none"
                  >
                    <button
                      type="submit"
                      className="w-full px-3 py-1.5 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
