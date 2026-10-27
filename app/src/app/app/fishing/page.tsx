import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtDate, weekStart } from "@/lib/time";
import { Card, SectionTitle } from "@/components/ui";
import { PathWeek } from "@/components/PathWeek";

export const metadata = { title: "Fishing" };

export default async function Fishing() {
  const me = await requireActive();
  const db = await supabaseServer();
  const ws = weekStart(me.timezone);
  const [{ data: all }, { data: committed }] = await Promise.all([
    db.from("fishing_contacts").select("*").eq("man_id", me.id).order("week_start", { ascending: false }),
    db.from("fishing_weeks").select("week_start, committed_at").eq("man_id", me.id),
  ]);
  const thisWeek = (all ?? []).filter((c) => c.week_start === ws);
  const past = (all ?? []).filter((c) => c.week_start !== ws);
  const committedAt = (committed ?? []).find((w) => w.week_start === ws)?.committed_at ?? null;

  return (
    <div className="space-y-6">
      <SectionTitle sub={<>&ldquo;Follow me, and I will make you fishers of men.&rdquo; — Mt 4:19. Reach out to 3 men every week.</>}>
        Fishing
      </SectionTitle>
      <Card>
        <h2 className="text-lg text-gold">Your 3 this week</h2>
        <p className="mb-3 max-w-prose text-sm text-ink">
          Pray, meditate and listen for 3 men God puts on your heart. Who <em>are</em> you going to reach out to this week, how,
          and what are you going to do? We go over them together at <strong>The Path</strong> on Monday night.
        </p>
        <PathWeek weekStart={ws} contacts={thisWeek} committedAt={committedAt} />
      </Card>
      {past.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg text-gold">Past weeks</h2>
          <ul className="space-y-1 text-sm">
            {past.map((c) => <li key={c.id}><span className="text-muted">{fmtDate(c.week_start)}</span> · {c.name}{c.method && ` (${c.method})`}{c.note && <span className="text-muted"> — {c.note}</span>}</li>)}
          </ul>
        </Card>
      )}
    </div>
  );
}
