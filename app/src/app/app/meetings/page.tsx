import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { DAYS, localSlot } from "@/lib/time";
import type { Meeting } from "@/lib/types";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { JoinButton } from "@/components/JoinButton";

export const metadata = { title: "Meetings & Links" };

export default async function MemberMeetings() {
  const me = await requireUser();
  const db = await supabaseServer();
  const { data } = await db.from("meetings").select("*").eq("active", true);
  const rows = ((data as Meeting[]) ?? [])
    .map((m) => ({ ...m, slot: localSlot(m.day_of_week, m.start_time_utc.slice(0, 5), me.timezone) }))
    .sort((a, b) => a.slot.at.getTime() - b.slot.at.getTime());

  return (
    <div className="max-w-4xl">
      <SectionTitle sub={`Times in your timezone (${me.timezone}). Change it in Profile.`}>Meetings &amp; Links</SectionTitle>
      <p className="mb-6 text-sm text-muted">Join from here — your first join checks off Key 2 item #4 (D) automatically. Please don&apos;t share links or passwords outside the Fellowship.</p>
      <div className="space-y-6">
        {DAYS.map((d, i) => {
          const day = rows.filter((r) => r.slot.dayIndex === i);
          if (!day.length) return null;
          return (
            <div key={d}>
              <h2 className="mb-2 text-lg text-gold">{d}</h2>
              <div className="space-y-2">
                {day.map((m) => (
                  <Card key={m.id} id={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <span className="w-36 font-semibold">{m.slot.time}</span>
                    <div className="min-w-0 flex-1">
                      <div className="display flex flex-wrap items-center gap-2 text-ink">{m.name}{m.beginner && <Badge tone="gold">Beginner</Badge>}</div>
                      {m.tagline && <p className="text-sm text-muted">{m.tagline}</p>}
                      <p className="mt-1 text-xs text-muted">
                        {m.zoom_id && <>Meeting ID <span className="text-ink">{m.zoom_id}</span> · </>}
                        {m.zoom_password && <>Passcode <span className="text-ink">{m.zoom_password}</span> · </>}
                        {m.secretary_first_name && <>Secretary {m.secretary_first_name}</>}
                      </p>
                    </div>
                    {m.zoom_url ? <JoinButton meetingId={m.id} /> : <span className="text-xs text-muted">Link not set</span>}
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
