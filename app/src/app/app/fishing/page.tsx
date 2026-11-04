import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { addDays, fmtDate, weekStart } from "@/lib/time";
import { FishingOutcome } from "@/components/FishingOutcome";
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
  const lastWs = addDays(ws, -7);
  const lastWeek = (all ?? []).filter((c) => c.week_start === lastWs).sort((a, b) => a.slot - b.slot);
  const past = (all ?? []).filter((c) => c.week_start !== ws && c.week_start !== lastWs);
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
      {lastWeek.length > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg text-gold">Last week — how did it go?</h2>
            <span className="text-sm text-muted">{lastWeek.filter((c) => c.reached_at).length} of {lastWeek.length} reached</span>
          </div>
          <p className="text-sm text-muted">Week of {fmtDate(lastWs)}. We go over these at The Path on Monday.</p>
          {lastWeek.map((c) => (
            <div key={c.id} className="space-y-1 rounded-lg border border-line p-3">
              <p className="text-sm"><span className="display text-ink">{c.name}</span>{c.method && <span className="text-muted"> · {c.method}</span>}{c.note && <span className="text-muted"> — {c.note}</span>}</p>
              <FishingOutcome weekStart={lastWs} slot={c.slot} name={c.name} outcome={c.outcome} reached={!!c.reached_at} />
            </div>
          ))}
        </Card>
      )}
      {past.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg text-gold">Earlier weeks</h2>
          <ul className="space-y-1 text-sm">
            {past.map((c) => (
              <li key={c.id}>
                <span className="text-muted">{fmtDate(c.week_start)}</span> · {c.reached_at ? "✓ " : ""}{c.name}{c.method && ` (${c.method})`}
                {c.note && <span className="text-muted"> — {c.note}</span>}{c.outcome && <span className="text-ink"> → {c.outcome}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
