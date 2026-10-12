import Link from "next/link";
import { Card, LinkButton, Logo } from "@/components/ui";
import { KEY_INFO } from "@/lib/keys";

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
