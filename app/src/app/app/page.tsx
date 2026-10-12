import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { loadProgram, nextStep } from "@/lib/program";
import { dayCount, daysBetween, localSlot, todayIn, weekStart } from "@/lib/time";
import { Card, LinkButton, Notice, Stat, SectionTitle, Badge } from "@/components/ui";
import { PanicButton } from "@/components/PanicButton";
import { STAGE_LABEL, type Meeting } from "@/lib/types";
import { env } from "@/lib/env";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const me = await requireUser();
  const supabase = await supabaseServer();
  const tz = me.timezone;
  const today = todayIn(tz);

  const { data: meetings } = await supabase.from("meetings").select("*").eq("active", true);
  const todays = ((meetings as Meeting[]) ?? [])
    .map((m) => ({ ...m, slot: localSlot(m.day_of_week, m.start_time_utc.slice(0, 5), tz) }))
    .filter((m) => m.slot.localDate === today)
    .sort((a, b) => a.slot.at.getTime() - b.slot.at.getTime());

  if (me.status !== "active") {
    return (
      <div className="max-w-3xl space-y-6">
        <SectionTitle>Welcome, {me.first_name}</SectionTitle>
        <Notice>
          Your sign-up is waiting for a leader&apos;s approval. You&apos;ll get an email as soon as you&apos;re in. Until then,
          come to a meeting — you don&apos;t need to wait to start.
        </Notice>
        <TodaysMeetings meetings={todays} />
        <p className="text-sm text-muted">Struggling right now? <Link href="/get-help" className="text-gold underline">Get help now</Link>.</p>
      </div>
    );
  }

  const [program, rels, logs, fishing] = await Promise.all([
    loadProgram(supabase, me.id),
    supabase.from("relationships").select("id, mentor_id, mentee_id, type, mutual").eq("status", "active"),
    supabase.from("meeting_logs").select("date").eq("man_id", me.id).eq("counts_90", true),
    supabase.from("fishing_contacts").select("slot").eq("man_id", me.id).eq("week_start", weekStart(tz)),
  ]);
  const myMentors = (rels.data ?? []).filter((r) => r.mentee_id === me.id || (r.mutual && r.mentor_id === me.id));
  const ids = myMentors.map((r) => (r.mentee_id === me.id ? r.mentor_id : r.mentee_id));
  const { data: cards } = ids.length ? await supabase.from("member_cards").select("id, first_name").in("id", ids) : { data: [] };
  const name = (id: string) => cards?.find((c) => c.id === id)?.first_name ?? "—";
  const ap = myMentors.find((r) => r.type === "ap");
  const sponsor = myMentors.find((r) => r.type !== "ap" && r.mentee_id === me.id);

  const days = dayCount(me.sobriety_start_date, tz);
  const ninety = Math.min(90, (logs.data ?? []).filter((l) => !me.program_start_date || l.date >= me.program_start_date).length);
  const next = nextStep(program);
  const signal = env.signalGroupUrl();

  return (
    <div className="max-w-5xl space-y-6">
      <SectionTitle sub={STAGE_LABEL[me.stage]}>Welcome back, {me.first_name}</SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Day count" value={days ?? "—"} hint={days === null ? <Link className="underline" href="/app/profile#sobriety">Set your date</Link> : "days free"} />
        <Stat label="90 in 90" value={`${ninety}/90`} hint={<Link className="underline" href="/app/ninety">Log a meeting</Link>} />
        <Stat label="Fishing" value={`${fishing.data?.length ?? 0}/3`} hint={<Link className="underline" href="/app/fishing">This week</Link>} />
        <PanicButton signalUrl={signal} />
      </div>

      <Card className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-widest text-muted">Your next step</div>
          <div className="display mt-1 text-lg text-ink">{next.label}</div>
        </div>
        <LinkButton href={next.href}>Go</LinkButton>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-lg text-gold">Your men</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Accountability partner</dt><dd>{ap ? name(ap.mentee_id === me.id ? ap.mentor_id : ap.mentee_id) : <Link href="/app/sponsor" className="text-gold underline">Find an AP</Link>}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Sponsor</dt><dd>{sponsor ? name(sponsor.mentor_id) : <Link href="/app/sponsor" className="text-gold underline">Find a sponsor</Link>}</dd></div>
          </dl>
          {!sponsor && me.program_start_date && daysBetween(me.program_start_date, today) >= 60 && (
            <p className="mt-3 text-sm text-orange">Key 2 #18: you need a sponsor or temporary sponsor by day 90.</p>
          )}
        </Card>
        <TodaysMeetings meetings={todays} />
      </div>
    </div>
  );
}

function TodaysMeetings({ meetings }: { meetings: (Meeting & { slot: { time: string } })[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-gold">Today&apos;s meetings</h2>
        <Link href="/app/meetings" className="text-sm text-muted hover:text-gold">All meetings →</Link>
      </div>
      {meetings.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {meetings.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2">
              <span className="w-32 font-semibold">{m.slot.time}</span>
              <Link href={`/app/meetings#${m.id}`} className="hover:text-gold">{m.name}</Link>
              {m.beginner && <Badge tone="gold">Beginner</Badge>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted">No meetings today in your timezone. Check the full schedule.</p>
      )}
    </Card>
  );
}
