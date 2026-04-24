import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--border)] mt-24">
      <div className="mx-auto max-w-6xl px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-sm text-[var(--muted)]">
        <div>
          <span className="font-semibold text-[var(--foreground)]">
            Urb<span className="text-[var(--accent)]">Rank</span>
          </span>
          <span className="ml-2">© {new Date().getFullYear()}</span>
        </div>
        <nav className="flex gap-6">
          <Link href="/about" className="hover:text-[var(--foreground)]">
            About
          </Link>
          <Link href="/methodology" className="hover:text-[var(--foreground)]">
            Methodology
          </Link>
          <Link href="/privacy" className="hover:text-[var(--foreground)]">
            Privacy
          </Link>
          <Link href="/contact" className="hover:text-[var(--foreground)]">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  );
}
