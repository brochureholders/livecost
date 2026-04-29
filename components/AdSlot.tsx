import { resolveAd, type AdSlotName } from "@/lib/ads";

type Props = {
  /** Named slot — see AD_SLOTS in lib/ads.ts. */
  name: AdSlotName;
  /** Current pathname so per-page filters work. Server components don't get
   *  this for free, so each caller passes it through. */
  pathname: string;
  /** Optional className applied to the wrapper. */
  className?: string;
};

export default async function AdSlot({ name, pathname, className }: Props) {
  const ad = await resolveAd(name, pathname);
  if (!ad) return null;

  return (
    <aside
      data-ad-slot={name}
      data-ad-id={ad.id}
      className={`my-8 flex flex-col items-center gap-2 ${className ?? ""}`}
    >
      <span className="text-[10px] uppercase tracking-widest text-[var(--muted)]">
        Sponsored
      </span>
      <div
        className="max-w-full"
        dangerouslySetInnerHTML={{ __html: ad.html }}
      />
    </aside>
  );
}
