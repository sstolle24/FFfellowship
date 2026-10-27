import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/time";
import { ActionForm, ActionButton, Submit } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { addJournal, deleteJournal, toggleJournalShare } from "../actions";

export const metadata = { title: "Meeting Journal" };

export default async function Journal() {
  const me = await requireActive();
  const db = await supabaseServer();
  const [{ data: entries }, { data: meetings }] = await Promise.all([
    db.from("journal_entries").select("*, meetings(name)").eq("man_id", me.id).order("created_at", { ascending: false }),
    db.from("meetings").select("id, name").eq("active", true).order("name"),
  ]);
  return (
    <div className="space-y-6">
      <SectionTitle sub="Catalog what you hear and learn — this feeds your “My Program” page (Key 2 #11).">Meeting Journal</SectionTitle>
      <Card>
        <ActionForm action={addJournal} resetOnOk className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="lbl" htmlFor="meeting_id">Meeting (optional)</label>
              <select id="meeting_id" name="meeting_id" className="field" defaultValue="">
                <option value="">—</option>
                {(meetings ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div><label className="lbl" htmlFor="key_insight">Key insight</label><input id="key_insight" name="key_insight" className="field" maxLength={500} /></div>
          </div>
          <div><label className="lbl" htmlFor="body">Entry</label><textarea id="body" name="body" required className="field min-h-32" maxLength={20000} /></div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shared" className="accent-gold" /> Share with my AP / sponsor</label>
            <Submit>Save entry</Submit>
          </div>
          <p className="text-xs text-muted">Entries you don&apos;t share are visible only to you and fellowship leaders.</p>
        </ActionForm>
      </Card>
      {entries?.length ? entries.map((e) => (
        <Card key={e.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span>{fmtDateTime(e.created_at, me.timezone)}</span>
            {(e.meetings as { name: string } | null)?.name && <Badge>{(e.meetings as { name: string }).name}</Badge>}
            {e.shared_with_mentors ? <Badge tone="gold">Shared with AP/sponsor</Badge> : <Badge>Private</Badge>}
          </div>
          {e.key_insight && <p className="display text-gold">{e.key_insight}</p>}
          <p className="whitespace-pre-line">{e.body}</p>
          <div className="flex gap-2">
            <ActionButton variant="quiet" run={toggleJournalShare.bind(null, e.id, !e.shared_with_mentors)}>{e.shared_with_mentors ? "Make private" : "Share"}</ActionButton>
            <ActionButton variant="quiet" run={deleteJournal.bind(null, e.id)} confirm="Delete this entry?">Delete</ActionButton>
          </div>
        </Card>
      )) : <Empty>No entries yet.</Empty>}
    </div>
  );
}
