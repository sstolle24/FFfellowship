import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { addDays, fmtDate, weekStart } from "@/lib/time";
import { Card, SectionTitle } from "@/components/ui";
import { FishingSlot } from "@/components/FishingSlot";

export const metadata = { title: "Fishing" };

export default async function Fishing() {
  const me = await requireActive();
  const db = await supabaseServer();
  const ws = weekStart(me.timezone);
  const { data: all } = await db.from("fishing_contacts").select("*").eq("man_id", me.id).order("week_start", { ascending: false });
  const thisWeek = (all ?? []).filter((c) => c.week_start === ws);
  const past = (all ?? []).filter((c) => c.week_start !== ws);

  return (
    <div className="space-y-6">
      <SectionTitle sub={<>&ldquo;Follow me, and I will make you fishers of men.&rdquo; — Mt 4:19. Reach out to 3 men every week.</>}>
        Fishing
      </SectionTitle>
      <Card>
        <h2 className="text-lg text-gold">Your 3 this week</h2>
        <p className="mb-4 text-sm text-muted">Week of {fmtDate(ws)} – {fmtDate(addDays(ws, 6))}. Resets every Monday.</p>
        <div className="space-y-3">
          {[1, 2, 3].map((slot) => <FishingSlot key={slot} slot={slot} current={thisWeek.find((c) => c.slot === slot) ?? null} />)}
        </div>
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
