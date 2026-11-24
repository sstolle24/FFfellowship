import Link from "next/link";
import type { CommunityEvent } from "@/lib/community";
import type { Holiday } from "@/lib/holiday";
import { EventCard } from "@/components/EventList";

/** Home page holiday banner (0030): message, light snowfall and an optional featured item (e.g. Santa's video). */
export function HolidayBanner({ h, featured, video, image }: { h: Holiday; featured: CommunityEvent | null; video?: string; image?: string }) {
  return (
    <section aria-labelledby="holiday-title" className="holiday relative overflow-hidden border-b border-line/60">
      <div className="snow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="garland" aria-hidden="true" />
      <div className="relative mx-auto max-w-3xl space-y-5 px-4 py-12 text-center">
        <p className="text-3xl" aria-hidden="true">🎄</p>
        <h2 id="holiday-title" className="text-3xl md:text-4xl" style={{ color: "var(--holiday-red)" }}>
          {h.headline || "Merry Christmas from Finally Free"}
        </h2>
        {h.message && <p className="mx-auto max-w-2xl whitespace-pre-line text-lg text-ink/80">{h.message}</p>}
        {featured && <div className="text-left"><EventCard e={featured} video={video} image={image} /></div>}
        <p className="text-sm">
          <Link href="/meetings" className="font-semibold text-gold underline">Holiday meeting schedule →</Link>
          <span className="mx-2 text-muted">·</span>
          <Link href="/get-help" className="font-semibold text-gold underline">Struggling today? Get help</Link>
        </p>
      </div>
    </section>
  );
}
