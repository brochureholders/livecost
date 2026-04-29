import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "./supabase";

export type AdSlotName =
  | "homepage-mid"
  | "compare-mid"
  | "city-profile-mid"
  | "blog-post-end";

type SlotMeta = {
  name: AdSlotName;
  description: string;
  /** Where pages using this slot live; used by revalidateSlot() to bust ISR. */
  revalidatePaths: { path: string; type: "page" | "layout" }[];
};

export const AD_SLOTS: SlotMeta[] = [
  {
    name: "homepage-mid",
    description: "Between sections on the homepage",
    revalidatePaths: [{ path: "/", type: "page" }],
  },
  {
    name: "compare-mid",
    description: "Between Detailed numbers and Quality of life on /compare/[pair]",
    revalidatePaths: [{ path: "/compare", type: "layout" }],
  },
  {
    name: "city-profile-mid",
    description:
      "Between Demographics and Quality of life on /cost-of-living/[slug]",
    revalidatePaths: [{ path: "/cost-of-living", type: "layout" }],
  },
  {
    name: "blog-post-end",
    description: "Under the article on /blog/[slug]",
    revalidatePaths: [{ path: "/blog", type: "layout" }],
  },
];

export type AdBlock = {
  id: string;
  name: string;
  slot: AdSlotName;
  html: string;
  enabled: boolean;
  image_url: string | null;
  click_url: string | null;
  alt_text: string | null;
  start_at: string | null;
  end_at: string | null;
  page_filter: string | null;
  weight: number;
  created_at: string;
  updated_at: string;
};

/** Bust the ISR cache on every route that hosts this slot, so a freshly
 *  saved or paused block is visible the next time those pages render. */
export function revalidateSlot(slot: AdSlotName): void {
  const meta = AD_SLOTS.find((s) => s.name === slot);
  if (!meta) return;
  for (const { path, type } of meta.revalidatePaths) {
    revalidatePath(path, type);
  }
}

/**
 * Pick the block to show for a given slot + current path. Filters by:
 *   - enabled (handled by the SQL)
 *   - schedule (start_at / end_at vs now)
 *   - page_filter (startsWith match against pathname, if set)
 * Then picks by weight: highest weight wins; ties broken by most-recently-updated.
 *
 * Returns null when nothing matches — the slot renders nothing.
 *
 * No in-process cache: pages calling this are themselves ISR-cached, so the
 * Supabase hit lands once per regeneration window, not per user request.
 */
export async function resolveAd(
  slot: AdSlotName,
  pathname: string,
): Promise<AdBlock | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("ad_blocks")
    .select("*")
    .eq("slot", slot)
    .eq("enabled", true);
  if (error) {
    console.warn(`[ads] failed to load slot=${slot}: ${error.message}`);
    return null;
  }
  const candidates = (data ?? []) as AdBlock[];

  const now = Date.now();
  const matches = candidates.filter((b) => {
    if (b.start_at && new Date(b.start_at).getTime() > now) return false;
    if (b.end_at && new Date(b.end_at).getTime() < now) return false;
    if (b.page_filter && !pathname.startsWith(b.page_filter)) return false;
    return true;
  });
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return (
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  });
  return matches[0];
}

/** List every block for the admin dashboard. Bypasses the slot cache. */
export async function listAllAds(): Promise<AdBlock[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("ad_blocks")
    .select("*")
    .order("slot", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to load ads: ${error.message}`);
  return (data ?? []) as AdBlock[];
}

export async function getAdById(id: string): Promise<AdBlock | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("ad_blocks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return null;
  return (data as AdBlock | null) ?? null;
}

/** Build the standard affiliate-banner HTML from quick-form inputs. */
export function buildBannerHtml(args: {
  imageUrl: string;
  clickUrl: string;
  altText: string;
}): string {
  const { imageUrl, clickUrl, altText } = args;
  // Escape attribute values defensively. The admin is trusted, but a stray
  // double-quote in alt text shouldn't break the markup.
  const e = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return (
    `<a href="${e(clickUrl)}" rel="sponsored noopener" target="_blank">` +
    `<img src="${e(imageUrl)}" alt="${e(altText)}" loading="lazy" />` +
    `</a>`
  );
}
