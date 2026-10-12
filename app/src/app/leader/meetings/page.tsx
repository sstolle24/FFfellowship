import { requireLeader } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { DAYS, localSlot } from "@/lib/time";
import type { Meeting } from "@/lib/types";
import { ActionButton } from "@/components/forms";
import { Card, SectionTitle } from "@/components/ui";
import { MeetingForm } from "@/components/MeetingForm";
import { deleteMeeting } from "../actions";

export const metadata = { title: "Meetings Admin" };

export default async function MeetingsAdmin() {
  const me = await requireLeader();
  const db = await supabaseServer();
  const { data } = await db.from("meetings").select("*").order("name");
  const rows = ((data as Meeting[]) ?? []).map((m) => ({ ...m, slot: localSlot(m.day_of_week, m.start_time_utc.slice(0, 5), me.timezone) }))
    .sort((a, b) => a.slot.dayIndex - b.slot.dayIndex);
  return (
    <div className="max-w-4xl space-y-6">
      <SectionTitle sub={`Enter times in your timezone (${me.timezone}); members see them in theirs. Links, IDs and passcodes are only ever shown to signed-in members.`}>
        Meetings Admin
      </SectionTitle>
      <Card>
        <h2 className="mb-3 text-lg text-gold">Add a meeting</h2>
        <MeetingForm tz={me.timezone} />
      </Card>
      {rows.map((m) => (
        <Card key={m.id}>
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <span className="w-28 text-muted">{m.slot.weekday}</span>
              <span className="w-32">{m.slot.time}</span>
              <span className="display flex-1 text-ink">{m.name}</span>
              {!m.active && <span className="text-xs text-muted">inactive</span>}
              {!m.zoom_url && <span className="text-xs text-orange">no link</span>}
            </summary>
            <div className="mt-4 space-y-3">
              <MeetingForm tz={me.timezone} meeting={{ ...m, localDay: m.slot.dayIndex, localTime: hhmm(m.slot.at, me.timezone) }} />
              <ActionButton variant="danger" run={deleteMeeting.bind(null, m.id)} confirm={`Delete ${m.name}? Logged meetings keep their history.`}>Delete</ActionButton>
            </div>
          </details>
        </Card>
      ))}
      <p className="text-xs text-muted">Days: {DAYS.join(", ")}.</p>
    </div>
  );
}

function hhmm(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
}
