import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { addDays, daysBetween, fmtDate, todayIn } from "@/lib/time";
import { ActionForm, ActionButton, Submit } from "@/components/forms";
import { Card, Empty, SectionTitle, Stat } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { addMeetingLog, deleteMeetingLog } from "../actions";

export const metadata = { title: "90 in 90" };

export default async function Ninety() {
  const me = await requireActive();
  const db = await supabaseServer();
  const [{ data: logs }, { data: meetings }] = await Promise.all([
    db.from("meeting_logs").select("*, meetings(name)").eq("man_id", me.id).order("date", { ascending: false }),
    db.from("meetings").select("id, name").eq("active", true).order("name"),
  ]);
  const start = me.program_start_date ?? todayIn(me.timezone);
  const counted = (logs ?? []).filter((l) => l.counts_90 && l.date >= start);
  const day = Math.min(90, daysBetween(start, todayIn(me.timezone)) + 1);

  return (
    <div className="max-w-4xl space-y-6">
      <SectionTitle sub={'Key 2 #10 — only "Finally Free" and "SA" support meetings count.'}>90 Meetings in 90 Days</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Meetings logged" value={`${Math.min(90, counted.length)}/90`} />
        <Stat label="Program day" value={day} hint={`Started ${fmtDate(start)}`} />
        <Stat label="Finish by" value={fmtDate(addDays(start, 89))} />
      </div>

      <Card className="no-print">
        <h2 className="mb-3 text-lg text-gold">Log a meeting</h2>
        <ActionForm action={addMeetingLog} resetOnOk className="grid gap-3 sm:grid-cols-2">
          <div><label className="lbl" htmlFor="date">Date</label><input id="date" name="date" type="date" required defaultValue={todayIn(me.timezone)} className="field" /></div>
          <div>
            <label className="lbl" htmlFor="meeting_id">Finally Free meeting</label>
            <select id="meeting_id" name="meeting_id" className="field" defaultValue="">
              <option value="">— Other (SA) meeting —</option>
              {(meetings ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><label className="lbl" htmlFor="other_name">Or SA meeting name</label><input id="other_name" name="other_name" className="field" maxLength={120} /></div>
          <div><label className="lbl" htmlFor="location">Location / online</label><input id="location" name="location" className="field" maxLength={120} /></div>
          <div className="sm:col-span-2"><label className="lbl" htmlFor="notes">Notes</label><input id="notes" name="notes" className="field" maxLength={2000} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="counts_90" defaultChecked className="accent-[#c9973a]" /> Counts toward 90 in 90 (FF or SA)</label>
          <div className="sm:text-right"><Submit>Log it</Submit></div>
        </ActionForm>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg text-gold">Your log</h2>
        <PrintButton />
      </div>
      {logs?.length ? (
        <div className="print-card divide-y divide-line rounded-xl border border-line bg-panel">
          {logs.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="w-28 text-muted">{fmtDate(l.date)}</span>
              <span className="flex-1">{(l.meetings as { name: string } | null)?.name ?? l.other_name}{l.location && <span className="text-muted"> · {l.location}</span>}{l.notes && <span className="block text-muted">{l.notes}</span>}</span>
              {!l.counts_90 && <span className="text-xs text-muted">not counted</span>}
              <span className="no-print"><ActionButton variant="quiet" run={deleteMeetingLog.bind(null, l.id)} confirm="Remove this entry?">Remove</ActionButton></span>
            </div>
          ))}
        </div>
      ) : <Empty>No meetings logged yet. Your first one counts.</Empty>}
    </div>
  );
}
