import Link from "next/link";
import { Card, LinkButton, Logo } from "@/components/ui";
import { KEY_INFO } from "@/lib/keys";
import { supabaseServer } from "@/lib/supabase/server";
import { holidayOn, type Holiday } from "@/lib/holiday";
import { eventImageLinks, eventVideoLinks } from "@/lib/event-video";
import type { CommunityEvent } from "@/lib/community";
import { HolidayBanner } from "@/components/HolidayBanner";

export default async function Home() {
  // Holiday season banner (0030); the featured item is always a public one.
  const db = await supabaseServer();
  const { data: hs } = await db.rpc("holiday_settings");
  const holiday = hs as Holiday | null;
  const on = holidayOn(holiday);
  let featured: CommunityEvent | null = null;
  let video: string | undefined, image: string | undefined;
  if (on && holiday?.featured_event) {
    const { data } = await db.from("community_events").select("*").eq("id", holiday.featured_event).maybeSingle();
    featured = (data as CommunityEvent | null) ?? null;
    if (featured) {
      [video, image] = await Promise.all([
        eventVideoLinks(db, [featured]).then((r) => r[featured!.id]), eventImageLinks(db, [featured]).then((r) => r[featured!.id]),
      ]);
    }
  }
  return (
    <>
      <section className="relative overflow-hidden border-b border-line/60">
        {/* Hero photo: Eric BARBEAU on Unsplash (Chamonix). Credits: public/hero/CREDITS.md */}
        <div className="hero-photo pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center md:py-28">
          <Logo size={84} glow priority />
          <h1 className="mt-6 text-4xl text-ink md:text-6xl">Finally <span className="text-gold">Free</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-ink/80 md:text-xl">
            A Christ-centered, peer-led fellowship of men walking out of sexual addiction — together, every day, with a
            clear path to lasting freedom.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/get-help" variant="danger" className="px-6 py-3 text-base">Get Help Now</LinkButton>
            <LinkButton href="/get-started" className="px-6 py-3 text-base">Get Started</LinkButton>
            <LinkButton href="/meetings" variant="ghost" className="px-6 py-3 text-base">See Meetings</LinkButton>
          </div>
        </div>
      </section>

      {on && holiday && <HolidayBanner h={holiday} featured={featured} video={video} image={image} />}

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-16 md:grid-cols-3">
        {Object.values(KEY_INFO).map((k) => (
          <Card key={k.label}>
            <div className="display text-sm tracking-[0.3em] text-gold">{k.label}</div>
            <p className="mt-3 text-ink">{k.what}</p>
            <p className="mt-3 text-sm"><span className="text-muted">In the Kingdom: </span><span className="text-gold">{k.kingdom}</span></p>
            <p className="mt-1 text-sm text-muted">{k.application}</p>
          </Card>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20 text-center">
        <p className="text-lg text-muted">
          You don&apos;t have to do this alone, and you don&apos;t have to wait. Meetings run every day of the week.
        </p>
        <p className="mt-4">
          <Link href="/how-it-works" className="text-gold underline">How the program works →</Link>
        </p>
      </section>
    </>
  );
}
