import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Admin — UrbRank",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:py-10">
      <header className="mb-10 flex items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]">
            Internal · noindex
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            UrbRank admin
          </h1>
        </div>
        <nav className="flex gap-4 text-sm">
          <Link
            href="/admin/ads"
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Ad blocks
          </Link>
          <Link
            href="/coverage"
            className="text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Coverage
          </Link>
        </nav>
      </header>
      {children}
    </div>
  );
}
