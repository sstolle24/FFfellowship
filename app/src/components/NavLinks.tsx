"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "@/lib/nav";

export function NavLinks({ links }: { links: [string, string][] }) {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 text-sm md:flex-col md:overflow-visible">
      {links.map(([href, label]) => {
        const on = isActive(path, href);
        return (
          <Link key={href} href={href}
            className={`shrink-0 rounded-md px-3 py-2 ${on ? "bg-gold/10 text-gold" : "text-muted hover:text-ink"}`}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
