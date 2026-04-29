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

export default async function AdsListPage() {
  const ads = await listAllAds();
  const slotMeta = new Map(AD_SLOTS.map((s) => [s.name, s.description]));
  const bySlot = new Map<AdSlotName, typeof ads>();
  for (const a of ads) {
    const arr = bySlot.get(a.slot as AdSlotName) ?? [];
    arr.push(a);
    bySlot.set(a.slot as AdSlotName, arr);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Ad blocks</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {ads.length} block{ads.length === 1 ? "" : "s"} across{" "}
            {AD_SLOTS.length} slots.
          </p>
        </div>
        <Link
          href="/admin/ads/new"
          className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          + New block
        </Link>
      </div>

      <div className="mt-8 space-y-8">
        {AD_SLOTS.map((slot) => {
          const items = bySlot.get(slot.name) ?? [];
          return (
            <section key={slot.name}>
              <header className="mb-3">
                <h3 className="font-mono text-sm font-semibold">{slot.name}</h3>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {slotMeta.get(slot.name)}
                </p>
              </header>

              {items.length === 0 ? (
                <p className="text-sm italic text-[var(--muted)] py-4">
                  No blocks for this slot.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                  {items.map((ad) => (
                    <li
                      key={ad.id}
                      className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium truncate">
                            {ad.name}
                          </span>
                          {ad.enabled ? (
                            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-100 text-emerald-900">
                              Live
                            </span>
                          ) : (
                            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded bg-[var(--border)] text-[var(--muted)]">
                              Paused
                            </span>
                          )}
                          {ad.page_filter && (
                            <span className="text-xs text-[var(--muted)] font-mono">
                              filter: {ad.page_filter}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-1">
                          weight {ad.weight} · updated {fmtDate(ad.updated_at)}
                          {ad.start_at && ` · starts ${fmtDate(ad.start_at)}`}
                          {ad.end_at && ` · ends ${fmtDate(ad.end_at)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <form
                          action={async () => {
                            "use server";
                            await toggleEnabled(
                              ad.id,
                              ad.slot as AdSlotName,
                              !ad.enabled,
                            );
                          }}
                        >
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--accent)]"
                          >
                            {ad.enabled ? "Pause" : "Resume"}
                          </button>
                        </form>
                        <Link
                          href={`/admin/ads/${ad.id}`}
                          className="px-3 py-1.5 text-xs rounded border border-[var(--border)] hover:border-[var(--accent)]"
                        >
                          Edit
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await deleteAd(ad.id, ad.slot as AdSlotName);
                          }}
                        >
                          <button
                            type="submit"
                            className="px-3 py-1.5 text-xs rounded border border-red-200 text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
