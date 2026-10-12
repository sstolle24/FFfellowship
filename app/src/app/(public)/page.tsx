import Link from "next/link";
import { Card, LinkButton, Logo } from "@/components/ui";

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-line/60">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(201,151,58,0.18),transparent_60%)]" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-20 text-center md:py-28">
          <Logo size={84} glow priority />
          <h1 className="mt-6 text-4xl text-ink md:text-6xl">Finally <span className="text-gold">Free</span></h1>
          <p className="mt-5 max-w-2xl text-lg text-muted md:text-xl">
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

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-16 md:grid-cols-3">
        {[
          ["Key 1", "Three videos and the Fishing worksheet — the why behind everything we do."],
          ["Key 2", "“The 21”: your virtual detox. Twenty-one concrete actions, signed off by you, your AP and a leader."],
          ["Key 3", "Bill's Story — the movie and questionnaire that show how one man helping another changed the world."],
        ].map(([k, t]) => (
          <Card key={k}>
            <div className="display text-sm tracking-[0.3em] text-gold">{k}</div>
            <p className="mt-3 text-ink">{t}</p>
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
