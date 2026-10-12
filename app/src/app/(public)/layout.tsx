import Link from "next/link";
import { Logo } from "@/components/ui";
import { getMe } from "@/lib/auth";

const NAV = [
  ["/about", "About"],
  ["/how-it-works", "How It Works"],
  ["/meetings", "Meetings"],
  ["/faq", "FAQ"],
  ["/pastors-corner", "Pastor's Corner"],
  ["/give", "Give"],
] as const;

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-navy/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <Logo size={38} priority />
            <span className="display hidden text-lg text-gold sm:inline">Finally Free</span>
          </Link>
          <nav className="ml-auto hidden items-center gap-5 text-sm lg:flex">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-muted hover:text-gold">{label}</Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-4">
            <Link href="/get-help" className="rounded-lg bg-danger px-3 py-1.5 text-sm font-semibold text-white">Get Help Now</Link>
            {me ? (
              <Link href="/app" className="rounded-lg border border-gold px-3 py-1.5 text-sm text-gold">My Dashboard</Link>
            ) : (
              <Link href="/login" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-gold">Log in</Link>
            )}
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto px-4 pb-2 text-sm lg:hidden">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="shrink-0 text-muted hover:text-gold">{label}</Link>
          ))}
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-line/60 py-8 text-sm text-muted">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4">
          <span className="display text-gold">Finally Free Fellowship</span>
          <Link href="/get-started" className="hover:text-gold">Get Started</Link>
          <Link href="/privacy" className="hover:text-gold">Privacy</Link>
          <Link href="/get-help" className="hover:text-gold">Get Help Now</Link>
          <span className="ml-auto italic">&ldquo;If the Son sets you free, you will be free indeed.&rdquo; — John 8:36</span>
        </div>
      </footer>
    </div>
  );
}
