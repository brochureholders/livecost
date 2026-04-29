import Link from "next/link";
import AdForm from "../AdForm";
import { createAd } from "../actions";
import { AD_SLOTS, type AdSlotName } from "@/lib/ads";

type SearchParams = { slot?: string };

function isAdSlot(s: string): s is AdSlotName {
  return AD_SLOTS.some((x) => x.name === s);
}

export default async function NewAdPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const presetSlot: AdSlotName | undefined =
    params.slot && isAdSlot(params.slot) ? params.slot : undefined;

  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)] mb-6">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link
              href={
                presetSlot ? `/admin/ads?slot=${presetSlot}` : "/admin/ads"
              }
              className="hover:text-[var(--foreground)]"
            >
              Ad blocks
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-[var(--foreground)] font-medium">New</li>
        </ol>
      </nav>

      <h2 className="text-xl font-semibold tracking-tight mb-6">
        New ad block
      </h2>

      <AdForm
        action={createAd}
        initial={presetSlot ? { slot: presetSlot } : undefined}
        submitLabel="Save & publish"
      />
    </div>
  );
}
