import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { requireLeader } from "@/lib/auth";
import { fmtDateTime, relDays } from "@/lib/time";
import { ActionButton } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { awardCertifiedAnother, certifyKey2, reviewOutsideSponsor } from "../actions";

export const metadata = { title: "Review Queue" };

export default async function Review() {
  const me = await requireLeader();
  const db = await supabaseServer();
  const [{ data: prog }, { data: steps }, { data: men }, { data: rels }, { data: ms }] = await Promise.all([
    db.from("step_progress").select("*").in("status", ["self_initialed", "ap_initialed", "leader_initialed"]),
    db.from("program_steps").select("id, title, item_number, gate_type, turn_in, program_modules(key, title)"),
    db.from("profiles").select("id, first_name, display_name, primary_leader_id").eq("status", "active"),
    db.from("relationships").select("mentor_id, mentee_id, type, mutual, status"),
    db.from("milestones").select("man_id, type, related_man_id"),
  ]);
  const { data: outsideAll } = await db.from("outside_sponsors").select("*").eq("status", "pending").order("created_at");
  const outside = (outsideAll ?? []).filter((o) => o.man_id !== me.id); // another leader approves his own
  const step = new Map((steps ?? []).map((s) => [s.id, s]));
  const mod = (id: string) => (step.get(id)?.program_modules as unknown as { key: string; title: string } | null);
  const name = (id: string) => { const m = men?.find((x) => x.id === id); return m?.display_name || m?.first_name || "?"; };
  const activeRels = (rels ?? []).filter((r) => r.status === "active");
  const hasMentor = (id: string) => activeRels.some((r) => r.mentee_id === id || (r.mutual && r.mentor_id === id));

  const leaderQueue = (prog ?? []).filter((p) => {
    const s = step.get(p.step_id);
    return p.man_id !== me.id && s && ((s.gate_type === "triple" && p.status === "ap_initialed") || (s.gate_type === "leader" && p.status === "self_initialed"));
  }).sort((a, b) => (a.ap_initialed_at ?? a.self_initialed_at ?? "").localeCompare(b.ap_initialed_at ?? b.self_initialed_at ?? ""));

  const key1Fallback = (prog ?? []).filter((p) => {
    const s = step.get(p.step_id);
    const m = men?.find((x) => x.id === p.man_id);
    return s?.gate_type === "self_ap" && mod(p.step_id)?.key === "key_1" && p.status === "self_initialed"
      && !hasMentor(p.man_id) && p.man_id !== me.id && (!m?.primary_leader_id || m.primary_leader_id === me.id);
  });

  // Items waiting on the AP column (his AP/sponsor hasn't signed). A leader can override from the item page.
  const fallbackIds = new Set(key1Fallback.map((p) => p.id));
  const waitingOnAp = (prog ?? []).filter((p) => {
    const s = step.get(p.step_id);
    return p.man_id !== me.id && p.status === "self_initialed" && s && ["self_ap", "triple"].includes(s.gate_type) && !fallbackIds.has(p.id);
  }).sort((a, b) => (a.self_initialed_at ?? "").localeCompare(b.self_initialed_at ?? ""));

  const k2Count = new Map<string, number>();
  for (const p of prog ?? []) if (p.status === "leader_initialed" && mod(p.step_id)?.key === "key_2") k2Count.set(p.man_id, (k2Count.get(p.man_id) ?? 0) + 1);
  const readyKey2 = [...k2Count.entries()].filter(([id, n]) => n === 21 && id !== me.id
    && !(ms ?? []).some((x) => x.man_id === id && x.type === "detox21_certified")).map(([id]) => id);

  const certAnother = (ms ?? []).filter((x) => x.type === "fellowship_certified").flatMap((x) =>
    (rels ?? []).filter((r) => r.mentee_id === x.man_id && r.type !== "ap" && ["active", "ended"].includes(r.status) && r.mentor_id !== me.id
      && !(ms ?? []).some((y) => y.man_id === r.mentor_id && y.type === "certified_another" && y.related_man_id === x.man_id))
      .map((r) => ({ mentor: r.mentor_id, mentee: x.man_id })));

  return (
    <div className="space-y-8">
      <SectionTitle sub="Oldest first. Your own items never appear here — another leader signs those.">Review Queue</SectionTitle>

      {readyKey2.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg text-gold">Ready for Detox-21 certification</h2>
          <div className="space-y-2">
            {readyKey2.map((id) => (
              <Card key={id} className="flex items-center gap-3 p-3">
                <Link href={`/leader/men/${id}`} className="display min-w-0 flex-1 break-words hover:text-gold">{name(id)}</Link>
                <Badge tone="ok">21/21 signed off</Badge>
                <ActionButton run={certifyKey2.bind(null, id)} confirm={`Certify ${name(id)} for Detox-21 and open Key 3?`}>Certify</ActionButton>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-lg text-gold">Waiting for leader initials ({leaderQueue.length})</h2>
        {leaderQueue.length ? (
          <div className="space-y-2">
            {leaderQueue.map((p) => {
              const s = step.get(p.step_id)!;
              const since = p.ap_initialed_at ?? p.self_initialed_at;
              return (
                <Link key={p.id} href={`/app/step/${p.id}`} className="block">
                  <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:border-gold">
                    <span className="display min-w-0 basis-full break-words text-ink sm:basis-56 sm:shrink-0">{name(p.man_id)}</span>
                    <span className="min-w-0 flex-1 break-words">{s.item_number ? `#${s.item_number} ` : ""}{s.title}</span>
                    {s.turn_in && <Badge tone="orange">Turn in</Badge>}
                    <span className="text-xs text-muted" title={fmtDateTime(since, me.timezone)}>{relDays(since)}d waiting</span>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : <Empty>Nothing waiting on a leader.</Empty>}
      </section>

      {key1Fallback.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg text-gold">Key 1 — no AP yet, needs your confirmation</h2>
          <p className="mb-2 text-sm text-muted">These men have no active AP or sponsor, so their primary leader confirms Key 1.</p>
          {key1Fallback.map((p) => (
            <Link key={p.id} href={`/app/step/${p.id}`} className="mb-2 block"><Card className="p-3 hover:border-gold">{name(p.man_id)} — {step.get(p.step_id)?.title}</Card></Link>
          ))}
        </section>
      )}

      {waitingOnAp.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg text-gold">Waiting on AP ({waitingOnAp.length})</h2>
          <p className="mb-2 text-sm text-muted">His AP or sponsor hasn&apos;t signed yet. If they can&apos;t, open the item to override the AP sign-off (reason required).</p>
          <div className="space-y-2">
            {waitingOnAp.map((p) => {
              const s = step.get(p.step_id)!;
              const days = relDays(p.self_initialed_at) ?? 0;
              return (
                <Link key={p.id} href={`/app/step/${p.id}`} className="block">
                  <Card className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3 hover:border-gold">
                    <span className="display min-w-0 basis-full break-words text-ink sm:basis-56 sm:shrink-0">{name(p.man_id)}</span>
                    <span className="min-w-0 flex-1 break-words">{s.item_number ? `#${s.item_number} ` : ""}{s.title}</span>
                    {days >= 7 ? <Badge tone="danger">{days}d waiting</Badge> : <span className="text-xs text-muted">{days}d waiting</span>}
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {outside.length > 0 && (
        <section>
          <h2 className="mb-1 text-lg text-gold">Outside sponsors — approve as an exception</h2>
          <p className="mb-2 text-sm text-muted">Sponsors who aren&apos;t in Finally Free. Once approved, they count for Key 2 #18.</p>
          {outside.map((o) => (
            <Card key={o.id} className="mb-2 flex flex-wrap items-center gap-3 p-3 text-sm">
              <span className="min-w-0 flex-1 break-words">
                <Link href={`/leader/men/${o.man_id}`} className="display hover:text-gold">{name(o.man_id)}</Link>
                <span className="text-muted"> — {o.name}{o.phone ? ` · ${o.phone}` : ""}{o.email ? ` · ${o.email}` : ""}{o.notes ? ` · ${o.notes}` : ""}</span>
              </span>
              <ActionButton run={reviewOutsideSponsor.bind(null, o.id, true)} confirm={`Approve ${o.name} as ${name(o.man_id)}'s sponsor?`}>Approve</ActionButton>
              <ActionButton variant="quiet" run={reviewOutsideSponsor.bind(null, o.id, false)} confirm="Decline this sponsor?">Decline</ActionButton>
            </Card>
          ))}
        </section>
      )}

      {certAnother.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg text-gold">Certified another — confirm</h2>
          {certAnother.map(({ mentor, mentee }) => (
            <Card key={mentor + mentee} className="mb-2 flex items-center gap-3 p-3">
              <span className="flex-1">{name(mentor)} sponsored {name(mentee)}, who is now Fellowship certified.</span>
              <ActionButton run={awardCertifiedAnother.bind(null, mentor, mentee)} confirm="Award 'certified another'?">Confirm</ActionButton>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}
