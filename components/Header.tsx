import Link from "next/link";
import HeaderSearch from "./HeaderSearch";

// Trimmed Calculator from primary nav (still reachable via /compare and
// the homepage hero CTA) to make room for the global search input. Keeps
// the header from getting cramped on laptop widths.
const navLinks = [
  { href: "/quiz", label: "Quiz" },
  { href: "/best-cities", label: "Best Cities" },
  { href: "/compare", label: "Compare" },
  { href: "/rankings", label: "Rankings" },
  { href: "/blog", label: "Blog" },
];

export default function Header() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur sticky top-0 z-40">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center gap-6">
        <Link
          href="/"
          className="text-xl font-semibold tracking-tight shrink-0"
        >
          Urb<span className="text-[var(--accent)]">Rank</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <HeaderSearch />
          <Link
            href="/compare"
            className="md:hidden text-sm text-[var(--accent)] font-medium"
          >
            Compare
          </Link>
        </div>
      </div>
    </header>
  );
}
