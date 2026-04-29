import Link from "next/link";
import AdForm from "../AdForm";
import { createAd } from "../actions";

export default function NewAdPage() {
  return (
    <div>
      <nav aria-label="Breadcrumb" className="text-sm text-[var(--muted)] mb-6">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/admin/ads" className="hover:text-[var(--foreground)]">
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

      <AdForm action={createAd} submitLabel="Save & publish" />
    </div>
  );
}
