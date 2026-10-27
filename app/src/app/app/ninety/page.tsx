import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { addDays, daysBetween, fmtDate, todayIn } from "@/lib/time";
import { addedLater, countedLogs, ninetyStart } from "@/lib/ninety";
import { ActionForm, ActionButton, Submit } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle, Stat } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { SponsorStatus } from "@/components/SponsorStatus";
import { addMeetingLog, deleteMeetingLog, saveHomeGroup, setNinetyStart } from "../actions";

export const metadata = { title: "90 in 90" };

export default async function Ninety() {
  const me = await requireActive();
  const db = await supabaseServer();
  const today = todayIn(me.timezone);
  const [{ data: logs }, { data: meetings }, { data: takeaways }] = await Promise.all([
    db.from("meeting_logs").select("*, meetings(name)").eq("man_id", me.id).order("date", { ascending: false }),
    db.from("meetings").select("id, name").eq("active", true).order("name"),
    db.from("journal_entries").select("meeting_log_id, body, key_insight, shared_with_mentors").eq("man_id", me.id).not("meeting_log_id", "is", null),
  ]);
  const start = ninetyStart(me) ?? today;
  const counted = countedLogs(logs ?? [], start);
  const day = Math.min(90, daysBetween(start, today) + 1);
  const notesFor = new Map((takeaways ?? []).map((t) => [t.meeting_log_id as string, t]));

  return (
    <div className="space-y-6">
      <SectionTitle sub={'Key 2 #10 — only "Finally Free" and "SA" support meetings count.'}>90 Meetings in 90 Days</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Meetings counted" value={`${Math.min(90, counted.length)}/90`} />
        <Stat label="Day" value={day} hint={`Started ${fmtDate(start)}`} />
        <Stat label="Finish by" value={fmtDate(addDays(start, 89))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="no-print space-y-2">
          <h2 className="text-lg text-gold">When did you start?</h2>
          <p className="text-sm text-muted">Started your 90 in 90 on paper before you joined? Set that date (up to 90 days back) and log those meetings below.</p>
          <ActionForm action={setNinetyStart} className="flex flex-wrap items-end gap-2">
            <div><label className="lbl" htmlFor="ninety_start">Start date</label>
              <input id="ninety_start" name="ninety_start" type="date" required defaultValue={start} min={addDays(today, -90)} max={today} className="field" /></div>
            <Submit variant="ghost">Save</Submit>
          </ActionForm>
        </Card>
        <Card className="no-print space-y-2">
          <h2 className="text-lg text-gold">Home group</h2>
          <p className="text-sm text-muted">Your &ldquo;tribe&rdquo; — choose one while you do your 90 in 90.</p>
          <ActionForm action={saveHomeGroup} className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1"><label className="lbl" htmlFor="home_group">Home group</label>
              <input id="home_group" name="home_group" defaultValue={me.home_group ?? ""} placeholder="Still looking" maxLength={80} className="field" /></div>
            <Submit variant="ghost">Save</Submit>
          </ActionForm>
        </Card>
        <div className="no-print"><SponsorStatus manId={me.id} /></div>
      </div>

      <Card className="no-print">
        <h2 className="mb-3 text-lg text-gold">Log a meeting</h2>
        <ActionForm action={addMeetingLog} resetOnOk className="grid gap-3 sm:grid-cols-2">
          <div><label className="lbl" htmlFor="date">Date</label><input id="date" name="date" type="date" required defaultValue={today} min={start} max={today} className="field" /></div>
          <div>
            <label className="lbl" htmlFor="meeting_id">Finally Free meeting</label>
            <select id="meeting_id" name="meeting_id" className="field" defaultValue="">
              <option value="">— Other (SA) meeting —</option>
              {(meetings ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div><label className="lbl" htmlFor="other_name">Or SA meeting name</label><input id="other_name" name="other_name" className="field" maxLength={120} /></div>
          <div><label className="lbl" htmlFor="location">Location / online</label><input id="location" name="location" className="field" maxLength={120} /></div>
          <details className="rounded-lg border border-line p-3 sm:col-span-2">
            <summary className="cursor-pointer text-sm text-gold">Notes / takeaways (optional)</summary>
            <div className="mt-3 space-y-3">
              <div><label className="lbl" htmlFor="key_insight">Key takeaway</label><input id="key_insight" name="key_insight" className="field" maxLength={500} /></div>
              <div><label className="lbl" htmlFor="takeaway">Notes</label><textarea id="takeaway" name="takeaway" className="field min-h-28" maxLength={20000} placeholder="What did you hear? What will you do with it?" /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shared" className="accent-gold" /> Share with my AP / sponsor</label>
              <p className="text-xs text-muted">Saved to your Meeting Journal too. Unshared notes are visible only to you and fellowship leaders.</p>
            </div>
          </details>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="counts_90" defaultChecked className="accent-gold" /> Counts toward 90 in 90 (FF or SA)</label>
          <div className="sm:text-right"><Submit>Log it</Submit></div>
        </ActionForm>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-lg text-gold">Your log</h2>
        <PrintButton />
      </div>
      {logs?.length ? (
        <div className="print-card divide-y divide-line rounded-xl border border-line bg-panel">
          {logs.map((l) => {
            const t = notesFor.get(l.id);
            return (
              <div key={l.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="w-28 text-muted">{fmtDate(l.date)}</span>
                <span className="min-w-0 flex-1">
                  {(l.meetings as { name: string } | null)?.name ?? l.other_name}{l.location && <span className="text-muted"> · {l.location}</span>}
                  {l.notes && <span className="block text-muted">{l.notes}</span>}
                  {t && (
                    <span className="mt-1 block border-l-2 border-gold/50 pl-2 text-muted">
                      {t.key_insight && <strong className="block text-ink">{t.key_insight}</strong>}
                      <span className="whitespace-pre-line">{t.body}</span>
                    </span>
                  )}
                </span>
                {!l.counts_90 && <span className="text-xs text-muted">not counted</span>}
                {l.counts_90 && l.date < start && <span className="text-xs text-muted">before your start date — not counted</span>}
                {addedLater(l) && <Badge>Added later</Badge>}
                <span className="no-print"><ActionButton variant="quiet" run={deleteMeetingLog.bind(null, l.id)} confirm="Remove this entry?">Remove</ActionButton></span>
              </div>
            );
          })}
        </div>
      ) : <Empty>No meetings logged yet. Your first one counts.</Empty>}
    </div>
  );
}
