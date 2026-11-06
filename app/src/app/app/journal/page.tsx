import Link from "next/link";
import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtDate, fmtDateTime } from "@/lib/time";
import { ActionButton } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { deleteJournal, toggleJournalShare } from "../actions";

export const metadata = { title: "My takeaways" };

type Entry = {
  id: string; body: string; key_insight: string | null; shared_with_mentors: boolean; created_at: string;
  meetings: { name: string } | null;
  meeting_logs: { date: string; other_name: string | null; location: string | null; meetings: { name: string } | null } | null;
};

/**
 * Every takeaway from his meetings, newest meeting first — the base of his
 * "My Program" page (Key 2 #11). Takeaways are added in the 90 in 90 log;
 * older journal notes not tied to a meeting are listed under "Other notes".
 */
export default async function Takeaways() {
  const me = await requireActive();
  const db = await supabaseServer();
  const { data } = await db.from("journal_entries")
    .select("id, body, key_insight, shared_with_mentors, created_at, meetings(name), meeting_logs(date, other_name, location, meetings(name))")
    .eq("man_id", me.id);
  const all = (data as unknown as Entry[]) ?? [];
  const fromMeetings = all.filter((e) => e.meeting_logs).sort((a, b) => b.meeting_logs!.date.localeCompare(a.meeting_logs!.date));
  const other = all.filter((e) => !e.meeting_logs).sort((a, b) => b.created_at.localeCompare(a.created_at));

  const card = (e: Entry, when: string, where: string | null) => (
    <Card key={e.id} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span className="font-semibold text-ink">{when}</span>
        {where && <span>{where}</span>}
        {e.shared_with_mentors ? <Badge tone="gold">Shared with AP/sponsor</Badge> : <Badge>Private</Badge>}
      </div>
      {e.key_insight && <p className="display text-lg text-gold">{e.key_insight}</p>}
      {e.body.trim() !== e.key_insight?.trim() && <p className="whitespace-pre-line">{e.body}</p>}
      <div className="flex gap-2">
        <ActionButton variant="quiet" run={toggleJournalShare.bind(null, e.id, !e.shared_with_mentors)}>{e.shared_with_mentors ? "Make private" : "Share"}</ActionButton>
        <ActionButton variant="quiet" run={deleteJournal.bind(null, e.id)} confirm="Delete this takeaway? The meeting stays in your 90 in 90.">Delete</ActionButton>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <SectionTitle sub={<>What you heard and want to carry with you — the base of your &ldquo;My Program&rdquo; page (Key 2 #11).</>}>My takeaways</SectionTitle>
      <p className="text-sm text-muted">
        Add a takeaway when you log a meeting, or on any meeting in your log, on the <Link href="/app/ninety" className="text-gold underline">90 in 90 page</Link>.
        Takeaways you don&apos;t share are visible only to you and fellowship leaders.
      </p>
      {fromMeetings.length ? fromMeetings.map((e) => {
        const l = e.meeting_logs!;
        return card(e, fmtDate(l.date), [l.meetings?.name ?? l.other_name, l.location].filter(Boolean).join(" · ") || null);
      }) : <Empty>No takeaways yet. Add one when you log your next meeting.</Empty>}
      {other.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg text-gold">Other notes</h2>
          {other.map((e) => card(e, fmtDateTime(e.created_at, me.timezone), e.meetings?.name ?? null))}
        </section>
      )}
    </div>
  );
}
