import { requireActive, isSponsorRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { namesFor } from "@/lib/names";
import { fmtDate } from "@/lib/time";
import { STAGE_LABEL, type Stage } from "@/lib/types";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { acceptOffer, closeRequest, offerMatch, requestMatch } from "../actions";

export const metadata = { title: "Find a Sponsor / AP" };

export default async function SponsorPage() {
  const me = await requireActive();
  const db = await supabaseServer();
  const { data: reqs } = await db.from("match_requests").select("*").eq("requester_id", me.id).order("created_at", { ascending: false });
  const reqIds = (reqs ?? []).map((r) => r.id);
  const { data: offers } = reqIds.length ? await db.from("match_offers").select("*").in("request_id", reqIds) : { data: [] };
  const names = await namesFor(db, [...new Set((offers ?? []).map((o) => o.offerer_id))]);
  const { data: cards } = await db.from("member_cards").select("id, day_count, stage, home_group").in("id", Object.keys(names).length ? Object.keys(names) : ["00000000-0000-0000-0000-000000000000"]);
  const board = isSponsorRole(me) ? (await db.from("sponsor_board").select("*").order("created_at")).data ?? [] : null;
  const open = (reqs ?? []).filter((r) => ["open", "offered", "pending_leader"].includes(r.status));

  return (
    <div className="max-w-4xl space-y-8">
      <SectionTitle sub="Key 2 #16: get an accountability partner and talk daily. #18: have a sponsor or temporary sponsor by day 90.">
        Find a Sponsor / AP
      </SectionTitle>

      {open.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg text-gold">Your open requests</h2>
          {open.map((r) => {
            const mine = (offers ?? []).filter((o) => o.request_id === r.id && o.status === "offered");
            return (
              <Card key={r.id} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="display">{r.type === "ap" ? "Accountability partner" : "Sponsor"}</span>
                  <Badge tone="gold">{r.status === "pending_leader" ? "Waiting on a leader to confirm" : r.status}</Badge>
                  <span className="text-xs text-muted">posted {fmtDate(r.created_at)}</span>
                  {r.status !== "pending_leader" && <span className="ml-auto"><ActionButton variant="quiet" run={closeRequest.bind(null, r.id)} confirm="Close this request?">Close</ActionButton></span>}
                </div>
                {mine.length ? mine.map((o) => {
                  const c = cards?.find((x) => x.id === o.offerer_id);
                  return (
                    <div key={o.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
                      <span className="font-semibold">{names[o.offerer_id]}</span>
                      {c && <span className="text-sm text-muted">{c.day_count ?? "?"} days · {STAGE_LABEL[c.stage as Stage]}{c.home_group ? ` · ${c.home_group}` : ""}</span>}
                      <span className="ml-auto"><ActionButton run={acceptOffer.bind(null, o.id)} confirm={`Accept ${names[o.offerer_id]}?`}>Accept</ActionButton></span>
                    </div>
                  );
                }) : r.status !== "pending_leader" && <p className="text-sm text-muted">No offers yet. Keep showing up — and ask men at meetings directly.</p>}
              </Card>
            );
          })}
        </section>
      )}

      <Card>
        <h2 className="mb-3 text-lg text-gold">Ask for a match</h2>
        <ActionForm action={requestMatch} resetOnOk className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="lbl" htmlFor="type">I&apos;m looking for</label>
            <select id="type" name="type" className="field"><option value="ap">An accountability partner (AP)</option><option value="sponsor">A sponsor</option></select>
          </div>
          <div><label className="lbl" htmlFor="timezone">My timezone</label><input id="timezone" name="timezone" defaultValue={me.timezone} className="field" /></div>
          <div><label className="lbl" htmlFor="best_times">Best times to talk</label><input id="best_times" name="best_times" className="field" placeholder="Weekday evenings" /></div>
          <div><label className="lbl" htmlFor="contact_pref">Best way to reach me</label><input id="contact_pref" name="contact_pref" className="field" placeholder="Signal, call, text" /></div>
          <div className="sm:col-span-2">
            <label className="lbl" htmlFor="notes">Anything else? (only leaders and the man who matches with you will see this)</label>
            <textarea id="notes" name="notes" className="field min-h-20" maxLength={2000} />
          </div>
          <div className="sm:col-span-2"><Submit>Post request</Submit></div>
        </ActionForm>
        <p className="mt-3 text-xs text-muted">On the Sponsor Board, sponsors see only your first name, timezone, day count and stage.</p>
      </Card>

      {board && (
        <section>
          <h2 className="mb-1 text-lg text-gold">Sponsor Board</h2>
          <p className="mb-3 text-sm text-muted">Men asking for an AP or sponsor. Offer only if you can talk with him daily.</p>
          {board.length ? (
            <div className="space-y-2">
              {board.map((b) => (
                <Card key={b.request_id} className="flex flex-wrap items-center gap-3 p-4">
                  <span className="display text-ink">{b.first_name}</span>
                  <Badge tone="gold">{b.type === "ap" ? "Needs an AP" : "Needs a sponsor"}</Badge>
                  <span className="text-sm text-muted">{b.day_count ?? "?"} days · {STAGE_LABEL[b.stage as Stage]} · {b.timezone}</span>
                  <span className="text-xs text-muted">posted {fmtDate(b.created_at)}</span>
                  <span className="ml-auto">
                    {b.i_offered ? <Badge tone="ok">You offered</Badge> : <ActionButton run={offerMatch.bind(null, b.request_id)} confirm={`Offer to walk with ${b.first_name}?`}>Offer</ActionButton>}
                  </span>
                </Card>
              ))}
            </div>
          ) : <Empty>No one is waiting right now.</Empty>}
        </section>
      )}
    </div>
  );
}
