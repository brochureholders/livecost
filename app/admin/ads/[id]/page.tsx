import Link from "next/link";
import { notFound } from "next/navigation";
import AdForm from "../AdForm";
import { updateAd } from "../actions";
import { getAdById } from "@/lib/ads";

type Params = { id: string };

export default async function EditAdPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const ad = await getAdById(id);
  if (!ad) notFound();

  // Bind id into the server action so the form can stay generic.
  async function action(formData: FormData) {
    "use server";
    await updateAd(id, formData);
  }

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
          <li className="text-[var(--foreground)] font-medium truncate max-w-xs">
            {ad.name}
          </li>
        </ol>
      </nav>

      <h2 className="text-xl font-semibold tracking-tight mb-6">
        Edit ad block
      </h2>

      <AdForm action={action} initial={ad} submitLabel="Save changes" />
    </div>
  );
}
