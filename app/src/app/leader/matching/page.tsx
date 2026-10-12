import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { dayCount, daysBetween, fmtDate, relDays, todayIn } from "@/lib/time";
import { STAGE_LABEL, type Stage } from "@/lib/types";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { confirmRelationship, createRelationship } from "../actions";
import { closeRequest } from "../../app/actions";

export const metadata = { title: "Matching Board" };

export default async function Matching() {
  const db = await supabaseServer();
  const [{ data: reqs }, { data: offers }, { data: pendingRels }, { data: men }, { data: active }] = await Promise.all([
    db.from("match_requests").select("*").in("status", ["open", "offered", "pending_leader"]).order("created_at"),
    db.from("match_offers").select("*").eq("status", "offered"),
    db.from("relationships").select("*").in("status", ["accepted", "offered"]),
    db.from("profiles").select("id, first_name, display_name, role, stage, sobriety_start_date, program_start_date, timezone").eq("status", "active").order("first_name"),
    db.from("relationships").select("mentor_id, mentee_id, type, mutual").eq("status", "active"),
  ]);
  const name = (id: string) => { const m = men?.find((x) => x.id === id); return m?.display_name || m?.first_name || "?"; };
  const man = (id: string) => men?.find((x) => x.id === id);
  const noSponsor75 = (men ?? []).filter((m) => m.program_start_date && daysBetween(m.program_start_date, todayIn(m.timezone)) >= 75
    && !(active ?? []).some((r) => r.mentee_id === m.id && r.type !== "ap"));

  return (
    <div className="max-w-5xl space-y-8">
      <SectionTitle sub="Requests, offers, sponsor confirmations — and direct matches.">Matching Board</SectionTitle>

      {(pendingRels ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 text-lg text-gold">Sponsor matches waiting for confirmation</h2>
          {pendingRels!.map((r) => (
            <Card key={r.id} className="mb-2 flex flex-wrap items-center gap-3 p-3">
              <span className="flex-1">{name(r.mentor_id)} → sponsor for {name(r.mentee_id)}</span>
              <ActionButton run={confirmRelationship.bind(null, r.id)} confirm="Confirm this sponsor match?">Confirm</ActionButton>
            </Card>
          ))}
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg text-gold">Open requests</h2>
        {reqs?.length ? (
          <div className="space-y-2">
            {reqs.map((r) => {
              const m = man(r.requester_id);
              const age = relDays(r.created_at) ?? 0;
              const os = (offers ?? []).filter((o) => o.request_id === r.id);
              return (
                <Card key={r.id} className="space-y-1 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/leader/men/${r.requester_id}`} className="display text-base hover:text-gold">{name(r.requester_id)}</Link>
                    <Badge tone="gold">{r.type === "ap" ? "AP" : "Sponsor"}</Badge>
                    <Badge>{r.status.replace("_", " ")}</Badge>
                    {age >= 7 && <Badge tone="danger">Open {age} days</Badge>}
                    <span className="ml-auto text-xs text-muted">{fmtDate(r.created_at)}</span>
                  </div>
                  {m && <p className="text-muted">{dayCount(m.sobriety_start_date, m.timezone) ?? "?"} days · {STAGE_LABEL[m.stage as Stage]} · {r.timezone}</p>}
                  <p className="text-muted">Best times: {r.best_times || "—"} · Contact: {r.contact_pref || "—"}</p>
                  {r.notes && <p className="whitespace-pre-line">Notes: {r.notes}</p>}
                  {os.length > 0 && <p>Offers from: {os.map((o) => name(o.offerer_id)).join(", ")}</p>}
                  {r.status !== "pending_leader" && <ActionButton variant="quiet" run={closeRequest.bind(null, r.id)} confirm="Close this request?">Close request</ActionButton>}
                </Card>
              );
            })}
          </div>
        ) : <Empty>No open requests.</Empty>}
      </section>

      {noSponsor75.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg text-gold">Day 75+ without a sponsor</h2>
          <div className="flex flex-wrap gap-2">{noSponsor75.map((m) => <Link key={m.id} href={`/leader/men/${m.id}`}><Badge tone="danger">{m.display_name || m.first_name}</Badge></Link>)}</div>
        </section>
      )}

      <Card>
        <h2 className="mb-3 text-lg text-gold">Match directly</h2>
        <ActionForm action={createRelationship} className="grid gap-3 sm:grid-cols-4 sm:items-end">
          <div>
            <label className="lbl" htmlFor="mentor">Sponsor / AP</label>
            <select id="mentor" name="mentor" className="field" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {(men ?? []).map((m) => <option key={m.id} value={m.id}>{m.display_name || m.first_name}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="mentee">For</label>
            <select id="mentee" name="mentee" className="field" required defaultValue="">
              <option value="" disabled>Choose…</option>
              {(men ?? []).map((m) => <option key={m.id} value={m.id}>{m.display_name || m.first_name}</option>)}
            </select>
          </div>
          <div>
            <label className="lbl" htmlFor="type">As</label>
            <select id="type" name="type" className="field"><option value="ap">AP (mutual)</option><option value="sponsor">Sponsor</option><option value="temp_sponsor">Temporary sponsor</option></select>
          </div>
          <Submit>Match</Submit>
        </ActionForm>
      </Card>
    </div>
  );
}
