import Link from "next/link";
import { notFound } from "next/navigation";
import { requireLeader } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/program";
import { initialerNames, namesFor } from "@/lib/names";
import { dayCount, fmtDate, fmtDateTime, relDays } from "@/lib/time";
import { STAGE_LABEL, type Profile } from "@/lib/types";
import { ProgramView } from "@/components/ProgramView";
import { AdminAccountCard } from "@/components/AdminAccountCard";
import { Key1Panel } from "@/components/Key1Panel";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { addNote, certifyKey2, deleteNote, endRel, setPrimaryLeader, setStatus } from "../../actions";
import { addedLater, ninetyCount, ninetyStart } from "@/lib/ninety";

export const metadata = { title: "Man detail" };

export default async function ManDetail({ params }: { params: Promise<{ manId: string }> }) {
  const { manId } = await params;
  const me = await requireLeader();
  const db = await supabaseServer();
  const { data: man } = await db.from("profiles").select("*").eq("id", manId).maybeSingle<Profile>();
  if (!man) notFound();

  const [program, { data: intake }, { data: notes }, { data: rels }, { data: leaders }, { data: audit }, { data: resets }, { data: logs }, { data: panics }] = await Promise.all([
    loadProgram(db, manId),
    db.from("profile_intake").select("intake_reason").eq("profile_id", manId).maybeSingle(),
    db.from("leader_notes").select("*").eq("man_id", manId).order("created_at", { ascending: false }),
    db.from("relationships").select("*").or(`mentor_id.eq.${manId},mentee_id.eq.${manId}`).order("created_at", { ascending: false }),
    db.from("profiles").select("id, first_name").in("role", ["leader", "admin"]).eq("status", "active"),
    db.from("audit_log").select("*").eq("target_id", manId).order("at", { ascending: false }).limit(30),
    db.from("sobriety_resets").select("*").eq("man_id", manId).order("created_at", { ascending: false }),
    db.from("meeting_logs").select("id, date, counts_90, created_at").eq("man_id", manId),
    db.from("panic_events").select("created_at").eq("man_id", manId).order("created_at", { ascending: false }).limit(5),
  ]);
  const { data: outside } = await db.from("outside_sponsors").select("name, phone, status").eq("man_id", manId)
    .in("status", ["pending", "approved"]).maybeSingle();
  const names = { ...(await initialerNames(db, program)), ...(await namesFor(db, [...new Set((rels ?? []).flatMap((r) => [r.mentor_id, r.mentee_id]))])) };
  const spAudit = await db.from("audit_log").select("*").in("target_id",
    program.modules.flatMap((m) => m.steps.map((s) => s.progress?.id)).filter(Boolean) as string[]).order("at", { ascending: false }).limit(40);
  const actorNames = await namesFor(db, [...new Set([...(audit ?? []), ...(spAudit.data ?? [])].map((a) => a.actor_id).filter(Boolean))]);
  const stepTitle = new Map(program.modules.flatMap((m) => m.steps.map((s) => [s.progress?.id, `${s.item_number ? `#${s.item_number} ` : ""}${s.title}`])));
  const timeline = [...(audit ?? []), ...(spAudit.data ?? [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
  const k2 = program.byKey.key_2;
  const readyKey2 = !k2.done && k2.steps.every((s) => s.progress?.status === "leader_initialed");
  const k1 = program.byKey.key_1;
  const hasMentor = (rels ?? []).some((r) => r.status === "active" && (r.mentee_id === man.id || (r.mutual && r.mentor_id === man.id)));
  // Same rule as initial_ap's Key 1 fallback: no AP/sponsor → his primary leader (any leader if none).
  const canConfirmKey1 = !hasMentor && man.id !== me.id && (!man.primary_leader_id || man.primary_leader_id === me.id);

  return (
    <div className="space-y-6">
      <Link href="/leader" className="text-sm text-muted hover:text-gold">← Pipeline</Link>
      <SectionTitle sub={`${STAGE_LABEL[man.stage]} · ${man.role.replace("_", "/")} · ${man.status}`}>{man.display_name || man.first_name}</SectionTitle>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="space-y-1 text-sm">
          <h2 className="mb-2 text-gold">Basics</h2>
          <p>Day count: <strong>{dayCount(man.sobriety_start_date, man.timezone) ?? "not set"}</strong></p>
          <p>Joined program: {fmtDate(man.program_start_date) || "—"}</p>
          <p>Last active: {relDays(man.last_active_at)}d ago</p>
          <p>90 in 90: {ninetyCount(logs ?? [], ninetyStart(man))}/90{man.ninety_start_date && <span className="text-muted"> · his start {fmtDate(man.ninety_start_date)}</span>}
            {(logs ?? []).some(addedLater) && <span className="text-muted"> · {(logs ?? []).filter(addedLater).length} added later</span>}</p>
          {outside && <p>Outside sponsor: {outside.name}{outside.phone ? ` · ${outside.phone}` : ""} <span className="text-muted">({outside.status})</span></p>}
          <p>{man.city ? `${man.city}, ` : ""}{man.country ?? ""} · {man.timezone}</p>
          <p className="text-muted">{man.email}{man.phone ? ` · ${man.phone}` : ""}</p>
          <p>Home group: {man.home_group || "—"} · Service: {man.service_position || "—"}</p>
          {(panics ?? []).length > 0 && <p className="text-danger">Panic alerts: {panics!.map((p) => fmtDate(p.created_at)).join(", ")}</p>}
        </Card>
        <Card className="space-y-3 text-sm">
          <h2 className="text-gold">Intake (leaders only)</h2>
          <p className="whitespace-pre-line text-muted">{intake?.intake_reason || "—"}</p>
          <p className="text-xs text-muted">Heard about us: {man.heard_about || "—"}</p>
          {(resets ?? []).length > 0 && <p className="text-xs text-muted">Date changes: {resets!.map((r) => `${fmtDate(r.old_date) || "none"} → ${fmtDate(r.new_date)}`).join("; ")}</p>}
        </Card>
        <Card className="space-y-3 text-sm">
          <h2 className="text-gold">Leader actions</h2>
          <ActionForm action={setPrimaryLeader.bind(null, man.id)} className="flex items-end gap-2">
            <div className="flex-1">
              <label className="lbl" htmlFor="leader">Primary leader</label>
              <select id="leader" name="leader" defaultValue={man.primary_leader_id ?? ""} className="field">
                <option value="">—</option>
                {(leaders ?? []).map((l) => <option key={l.id} value={l.id}>{l.first_name}</option>)}
              </select>
            </div>
            <Submit variant="ghost">Set</Submit>
          </ActionForm>
          {readyKey2 && man.id !== me.id && <ActionButton run={certifyKey2.bind(null, man.id)} confirm="Certify Detox-21 and open Key 3?">Certify Detox-21</ActionButton>}
          {man.id !== me.id && (man.status === "active"
            ? <ActionButton variant="ghost" run={setStatus.bind(null, man.id, "inactive")} confirm="Mark inactive? He'll lose member access and all his AP/sponsor relationships end.">Mark inactive</ActionButton>
            : man.status === "inactive" && <ActionButton variant="ghost" run={setStatus.bind(null, man.id, "active")}>Reactivate</ActionButton>)}
        </Card>
      </div>

      {man.status === "active" && k1.unlocked && !k1.done && man.id !== me.id && (
        <Key1Panel first={man.first_name} key1={k1} hasMentor={hasMentor} canConfirm={canConfirmKey1} />
      )}

      {me.role === "admin" && !man.deleted_at && <AdminAccountCard manId={man.id} email={man.email} first={man.first_name} />}

      <Card>
        <h2 className="mb-3 text-gold">Relationships</h2>
        <ul className="space-y-2 text-sm">
          {(rels ?? []).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2">
              <Badge tone={r.status === "active" ? "ok" : "muted"}>{r.status}</Badge>
              <span>{names[r.mentor_id]} → {names[r.mentee_id]} ({r.type === "ap" ? "AP" : r.type.replace("_", " ")})</span>
              <span className="text-xs text-muted">{fmtDate(r.started_at ?? r.created_at)}{r.ended_at ? ` – ${fmtDate(r.ended_at)}` : ""}</span>
              {r.status === "active" && <ActionButton variant="quiet" run={endRel.bind(null, r.id)} confirm="End this relationship? Access is revoked immediately.">End</ActionButton>}
            </li>
          ))}
          {!rels?.length && <li className="text-muted">None. <Link href="/leader/matching" className="text-gold underline">Match him</Link>.</li>}
        </ul>
      </Card>

      <ProgramView man={man} program={program} names={names} self={false} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-gold">Private leader notes</h2>
          <ActionForm action={addNote.bind(null, man.id)} resetOnOk className="space-y-2">
            <textarea name="body" required className="field min-h-20" maxLength={5000} />
            <Submit variant="ghost">Add note</Submit>
          </ActionForm>
          <ul className="mt-4 space-y-3 text-sm">
            {(notes ?? []).map((n) => (
              <li key={n.id} className="border-t border-line pt-2">
                <div className="flex justify-between text-xs text-muted"><span>{actorNames[n.leader_id] ?? names[n.leader_id] ?? "Leader"} · {fmtDateTime(n.created_at, me.timezone)}</span>
                  {n.leader_id === me.id && <ActionButton variant="quiet" run={deleteNote.bind(null, n.id, man.id)} confirm="Delete note?">Delete</ActionButton>}</div>
                <p className="whitespace-pre-line">{n.body}</p>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 text-gold">Timeline</h2>
          <ul className="space-y-1.5 text-sm">
            {timeline.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="w-28 shrink-0 text-xs text-muted">{fmtDateTime(a.at, me.timezone)}</span>
                <span>{actorNames[a.actor_id] ?? "System"} · {a.action.replace(/_/g, " ")}{stepTitle.get(a.target_id) ? ` — ${stepTitle.get(a.target_id)}` : ""}{a.detail?.note ? `: “${a.detail.note}”` : ""}</span>
              </li>
            ))}
            {!timeline.length && <li className="text-muted">No activity yet.</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
