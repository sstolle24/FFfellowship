import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card, LinkButton, SectionTitle } from "@/components/ui";
import { Scripture } from "@/components/Scripture";

export const metadata = {
  title: "Why You Must Stop Now",
  description: "Count the cost of sex and porn addiction — and the way out. Finally Free Fellowship.",
};

// DRAFT (Nov 2026) — Steven to revise. Each card can take a photo later: add `photo: "/why/....jpg"`
// (licensed stock or illustration only; never real people's children or real court papers).
type Cost = { title: string; body: string; icon: ReactNode; photo?: string };

const I = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-7 w-7 shrink-0 text-danger" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const COSTS: Cost[] = [
  { title: "Your marriage", icon: I("M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6C19 16.5 12 21 12 21zM12 6l-1.5 4 3 2-1.5 5"),
    body: "It starts with secrets — the late nights, the second phone, the lies that get easier. Then the fights you can't explain. Then separation papers. One day another man is at your kids' school play, and your wife has remarried." },
  { title: "Your children", icon: I("M8 7a3 3 0 1 0 0-.01M16 9a2.5 2.5 0 1 0 0-.01M3 21v-2a5 5 0 0 1 10 0v2M13 21v-1.5a4 4 0 0 1 8 0V21"),
    body: "They see more than you think. The look on your son's face when he finds out. A daughter learning from you what a man is. Supervised visits on a Saturday morning in a family-court office." },
  { title: "Your job", icon: I("M4 8h16v11H4zM9 8V5h6v3M4 13h16"),
    body: "A flagged laptop. A call into HR. Walked out with a box of your things, fired for cause — and a reason you'll never want to say out loud at the next interview." },
  { title: "Your home and money", icon: I("M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"),
    body: "Sites, apps, affairs, lawyers. The money goes quietly, then all at once. Missed payments. A foreclosure notice taped to the front door for the neighbors to read." },
  { title: "The courtroom", icon: I("M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0zM8 21h8"),
    body: "Addiction always wants more. Some men cross a line they swore they never would — and meet a judge. A record that follows you for life. A family-court judge deciding when you get to see your own kids." },
  { title: "Your body and mind", icon: I("M12 4v16M4 12h16M7 4h10v16H7z"),
    body: "Shame. Anxiety. Depression. Nights you can't sleep and mornings you can't face. For some, a hospital bed, a detox and treatment facility — and for some, thoughts of ending it all." },
];

export default function WhyStopNow() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 leading-relaxed">
      <SectionTitle sub={<>Count the cost (<Scripture text="Luke 14:28" />). This is where it goes if nothing changes.</>}>
        Why you must stop now
      </SectionTitle>

      <p className="max-w-prose text-lg text-ink">
        Nobody plans to lose everything. It happens one &ldquo;just this once&rdquo; at a time. Men in this fellowship have
        lived every line on this page. Read it slowly — and then read the end, because it doesn&apos;t have to finish this way.
      </p>

      <h2 className="mt-10 text-xl text-gold">Where it leads</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {COSTS.map((c) => (
          <Card key={c.title} className="space-y-2">
            {c.photo && <Image src={c.photo} alt="" width={640} height={360} className="mb-2 aspect-video w-full rounded-lg object-cover" />}
            <div className="flex items-center gap-3">{c.icon}<h3 className="display text-lg text-ink">{c.title}</h3></div>
            <p className="text-muted">{c.body}</p>
          </Card>
        ))}
      </div>

      <Card className="mt-8 border-danger/50 bg-danger/5">
        <h2 className="text-xl text-danger">Jails, institutions and death</h2>
        <p className="mt-2 text-ink">
          The old-timers say this disease ends one of three ways: jails, institutions, or death. Every man who got there
          started right where you are — telling himself he could stop any time.
        </p>
        <p className="mt-2 text-muted">
          &ldquo;When lust hath conceived, it bringeth forth sin: and sin, when it is finished, bringeth forth death&rdquo;
          (<Scripture text="James 1:15" />). &ldquo;The wages of sin is death&rdquo; (<Scripture text="Romans 6:23" />).
        </p>
      </Card>

      <h2 className="mt-10 text-xl text-gold">Your &ldquo;not yets&rdquo;</h2>
      <div className="max-w-prose space-y-3">
        <p>
          Maybe none of this has happened to you. <strong>Not yet.</strong> She hasn&apos;t found out — yet. You haven&apos;t
          been caught at work — yet. You haven&apos;t crossed that line — yet.
        </p>
        <p>
          &ldquo;Not yet&rdquo; isn&apos;t safety. It&apos;s a countdown. Every man who lost it all had a season of not yet.
          &ldquo;Can a man take fire in his bosom, and his clothes not be burned?&rdquo; (<Scripture text="Proverbs 6:27" />)
          &ldquo;Whatsoever a man soweth, that shall he also reap&rdquo; (<Scripture text="Galatians 6:7" />).
        </p>
      </div>

      <h2 className="mt-10 text-xl text-gold">Why now — not later</h2>
      <div className="max-w-prose space-y-3">
        <p>
          Not after the holidays. Not when work calms down. Not after one last time. It will never be easier to stop than it
          is today, because every day you wait, it digs in deeper.
        </p>
        <p>&ldquo;Behold, now is the accepted time; behold, now is the day of salvation&rdquo; (<Scripture text="2 Corinthians 6:2" />).</p>
      </div>

      <Card className="mt-10 space-y-3 border-gold/50 bg-gold/5">
        <h2 className="text-2xl text-gold">It doesn&apos;t have to end there</h2>
        <p className="text-ink">
          Men in this fellowship are free today — marriages rebuilt, kids who trust them again, jobs kept, nights they
          sleep through. Not because they were stronger than you, but because they stopped hiding, got honest, and let
          God and other men help. &ldquo;If the Son therefore shall make you free, ye shall be free indeed&rdquo;
          (<Scripture text="John 8:36" />).
        </p>
        <p className="text-muted">
          God &ldquo;will with the temptation also make a way to escape&rdquo; (<Scripture text="1 Corinthians 10:13" />).
          His mercies &ldquo;are new every morning&rdquo; (<Scripture text="Lamentations 3:22-23" />). Today can be your day one.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <LinkButton href="/get-help" variant="danger">Get help right now</LinkButton>
          <LinkButton href="/meetings">Find a meeting tonight</LinkButton>
          <LinkButton href="/get-started" variant="ghost">Start the program</LinkButton>
        </div>
      </Card>

      <p className="mt-8 text-sm text-muted">
        Thinking about ending your life? Call or text <strong className="text-ink">988</strong> (US) right now, any time.
        Outside the US, see <Link href="/get-help" className="text-gold underline">Get Help Now</Link>.
      </p>
    </div>
  );
}
