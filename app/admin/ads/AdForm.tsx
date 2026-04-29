import Link from "next/link";
import { AD_SLOTS, type AdBlock } from "@/lib/ads";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  initial?: Partial<AdBlock>;
  submitLabel: string;
};

function toLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  // datetime-local input wants "YYYY-MM-DDTHH:mm" in local time.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdForm({ action, initial, submitLabel }: Props) {
  return (
    <form action={action} className="space-y-6 max-w-2xl" encType="multipart/form-data">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
          Name <span className="text-[var(--accent)]">*</span>
        </label>
        <input
          name="name"
          required
          defaultValue={initial?.name ?? ""}
          placeholder="e.g. Movers — Nationwide Q4 2026"
          className="w-full h-11 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)]"
        />
        <p className="text-xs text-[var(--muted)] mt-1">
          Admin-only label. Won&apos;t show on the site.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
            Slot <span className="text-[var(--accent)]">*</span>
          </label>
          <select
            name="slot"
            required
            defaultValue={initial?.slot ?? AD_SLOTS[0].name}
            className="w-full h-11 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)]"
          >
            {AD_SLOTS.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} — {s.description}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
            Weight
          </label>
          <input
            type="number"
            name="weight"
            min={1}
            defaultValue={initial?.weight ?? 1}
            className="w-full h-11 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)]"
          />
          <p className="text-xs text-[var(--muted)] mt-1">
            Higher wins when multiple blocks match.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="text-sm font-semibold tracking-tight">
          Quick affiliate banner
        </h3>
        <p className="text-xs text-[var(--muted)] mt-1">
          Fill these and we&apos;ll generate the linked-image HTML automatically.
          Skip if you&apos;re using raw HTML below.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Upload image
            </label>
            <input
              type="file"
              name="imageFile"
              accept="image/*"
              className="block w-full text-sm"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              Uploads to the <code className="text-xs">ad-images</code> Supabase
              Storage bucket. Or paste a URL below if you prefer affiliate-hosted.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Image URL
            </label>
            <input
              name="imageUrl"
              type="url"
              defaultValue={initial?.image_url ?? ""}
              placeholder="https://…"
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Click-through URL
            </label>
            <input
              name="clickUrl"
              type="url"
              defaultValue={initial?.click_url ?? ""}
              placeholder="https://affiliate.example/?ref=urbrank"
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Alt text
            </label>
            <input
              name="altText"
              defaultValue={initial?.alt_text ?? ""}
              placeholder="Get 20% off your move with United Van Lines"
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] text-sm"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
          Raw HTML (optional)
        </label>
        <textarea
          name="rawHtml"
          rows={6}
          defaultValue={
            initial?.html && !initial?.image_url ? initial.html : ""
          }
          placeholder="<a href='…'><img src='…' /></a>  or AdSense / iframe / any HTML"
          className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] font-mono text-xs"
        />
        <p className="text-xs text-[var(--muted)] mt-1">
          If filled, this overrides the quick-banner fields above.
        </p>
      </div>

      <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <summary className="cursor-pointer text-sm font-medium">
          Advanced — targeting + schedule
        </summary>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--muted)] mb-1">
              Page filter (optional)
            </label>
            <input
              name="pageFilter"
              defaultValue={initial?.page_filter ?? ""}
              placeholder="e.g. /compare/  or  /cost-of-living/austin-tx"
              className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] text-sm font-mono"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              Only show on pages whose path startsWith this string. Empty = all
              pages with this slot.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                Start (optional)
              </label>
              <input
                type="datetime-local"
                name="startAt"
                defaultValue={toLocalDateTime(initial?.start_at)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--muted)] mb-1">
                End (optional)
              </label>
              <input
                type="datetime-local"
                name="endAt"
                defaultValue={toLocalDateTime(initial?.end_at)}
                className="w-full h-10 px-3 rounded-lg border border-[var(--border)] bg-[var(--background)] focus:outline-none focus:border-[var(--accent)] text-sm"
              />
            </div>
          </div>
        </div>
      </details>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={initial?.enabled ?? true}
          className="h-4 w-4"
        />
        Enabled (live on the site)
      </label>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
        >
          {submitLabel}
        </button>
        <Link
          href="/admin/ads"
          className="px-5 py-2.5 rounded-lg border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
