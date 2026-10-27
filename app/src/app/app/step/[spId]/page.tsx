import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActive, isLeader } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { dueDate } from "@/lib/program";
import { namesFor } from "@/lib/names";
import { fmtDate, fmtDateTime } from "@/lib/time";
import type { ModuleKey, ProgramStep, StepProgress, Submission, WorksheetQuestion } from "@/lib/types";
import { Badge, Card, Notice, SectionTitle } from "@/components/ui";
import { InitialBoxes, StatusBadge } from "@/components/StepParts";
import { ActionButton } from "@/components/forms";
import { ReturnForm, TextTurnIn, WorksheetForm } from "@/components/StepForms";
import { UploadTurnIn } from "@/components/UploadTurnIn";
import { initialAp, initialLeader, initialSelf, setReadToGroup } from "../../actions";

export const metadata = { title: "Program item" };

/**
 * One program item, for whoever may see it (RLS decides): the man himself,
 * his active AP/sponsor, or a leader. Buttons shown match what the server allows.
 */
export default async function StepPage({ params }: { params: Promise<{ spId: string }> }) {
  const { spId } = await params;
  const me = await requireActive();
  const db = await supabaseServer();

  const { data: sp } = await db.from("step_progress").select("*").eq("id", spId).maybeSingle<StepProgress>();
  if (!sp) notFound();
  const [{ data: step }, { data: subs }] = await Promise.all([
    db.from("program_steps").select("*").eq("id", sp.step_id).single<ProgramStep>(),
    db.from("submissions").select("*").eq("step_progress_id", spId).order("version", { ascending: false }),
  ]);
  if (!step) notFound();
  const { data: mod } = await db.from("program_modules").select("key, title").eq("id", step.module_id).single<{ key: ModuleKey; title: string }>();

  const self = sp.man_id === me.id;
  const leader = isLeader(me);

  // Locked item (opened by URL): no instructions, worksheet or upload — just what opens it.
  if (sp.status === "locked") {
    const { data: reason } = await db.rpc("step_lock_reason", { p_sp: spId });
    return (
      <div className="space-y-5">
        <Link href={self ? "/app/program" : leader ? `/leader/men/${sp.man_id}` : "/app/sponsor-desk"} className="text-sm text-muted hover:text-gold">← Back</Link>
        <SectionTitle sub={mod?.title}>{step.item_number ? `#${step.item_number} ` : ""}{step.title}</SectionTitle>
        <Notice><strong>Locked.</strong> {(reason as string | null) ?? "This item isn't open yet."}</Notice>
      </div>
    );
  }
  const { data: rels } = await db.from("relationships").select("type, mentor_id, mentee_id, mutual").eq("status", "active");
  const mentorOfHim = (rels ?? []).some((r) =>
    (r.mentor_id === me.id && r.mentee_id === sp.man_id) || (r.mutual && r.mentee_id === me.id && r.mentor_id === sp.man_id));
  const { data: manRow } = leader
    ? await db.from("profiles").select("id, first_name, program_start_date, primary_leader_id, home_group, service_position").eq("id", sp.man_id).single()
    : self
      ? { data: me }
      : await db.from("member_cards").select("id, first_name").eq("id", sp.man_id).single();
  const man = manRow as { id: string; first_name: string; program_start_date?: string | null; primary_leader_id?: string | null; home_group?: string | null; service_position?: string | null };

  // Key 1 fallback: no AP/sponsor → his primary leader (any leader if none) gives the AP confirmation.
  const manHasMentor = leader
    ? ((await db.from("relationships").select("id", { count: "exact", head: true }).eq("status", "active")
        .or(`mentee_id.eq.${sp.man_id},and(mentor_id.eq.${sp.man_id},mutual.eq.true)`)).count ?? 0) > 0
    : true;
  const key1Fallback = mod?.key === "key_1" && leader && !manHasMentor && (!man.primary_leader_id || man.primary_leader_id === me.id);

  // Key 1: the worksheet stays locked until all 3 videos are checked off (enforced by initial_self too).
  let videosPending = false;
  if (mod?.key === "key_1" && step.helper?.type === "worksheet") {
    const [{ data: vids }, { data: watched }] = await Promise.all([
      db.from("videos").select("id").eq("module_id", step.module_id),
      db.from("video_progress").select("video_id").eq("man_id", sp.man_id).not("watched_at", "is", null),
    ]);
    const done = new Set((watched ?? []).map((w) => w.video_id));
    videosPending = (vids ?? []).some((v) => !done.has(v.id));
  }

  const st = sp.status;
  const editable = self && (st === "open" || st === "returned") && !videosPending;
  const canAp = !self && (mentorOfHim || key1Fallback) && st === "self_initialed" && ["self_ap", "triple"].includes(step.gate_type);
  const canLeader = !self && leader && sp.ap_initial_by !== me.id && (
    (step.gate_type === "triple" && st === "ap_initialed") || (step.gate_type === "leader" && st === "self_initialed"));
  const canReturn = !self && ((st === "self_initialed" && (leader || mentorOfHim)) || (st === "ap_initialed" && leader));
  const isWorksheet = step.helper?.type === "worksheet";

  let questions: (WorksheetQuestion & { answers: string[] })[] = [];
  if (isWorksheet) {
    const [{ data: qs }, { data: ans }] = await Promise.all([
      db.from("worksheet_questions").select("*").eq("module_id", step.module_id).order("order_no"),
      db.from("worksheet_answers").select("question_id, slot, answer").eq("man_id", sp.man_id),
    ]);
    questions = (qs as WorksheetQuestion[] ?? []).map((q) => {
      const a: string[] = [];
      for (const x of ans ?? []) if (x.question_id === q.id) a[x.slot - 1] = x.answer ?? "";
      return { ...q, answers: a };
    });
  }

  // Signed, short-lived links — created with the viewer's session, so storage RLS applies.
  const files = await Promise.all(((subs as Submission[]) ?? []).map(async (s) => {
    if (!s.file_path) return { ...s, url: null as string | null };
    // download: served as an attachment, never rendered inline on the storage origin.
    const { data } = await db.storage.from("submissions").createSignedUrl(s.file_path, 300, { download: true });
    return { ...s, url: data?.signedUrl ?? null };
  }));

  const names = await namesFor(db, [sp.ap_initial_by, sp.leader_initial_by, sp.returned_by].filter(Boolean) as string[]);
  const helper = await helperInfo(db, step, sp.man_id, man);
  const due = dueDate(man.program_start_date ?? null, step.due_day);
  const back = self ? "/app/program" : leader ? `/leader/men/${sp.man_id}` : "/app/sponsor-desk";

  // Large screens: reading/worksheet in the main column, status + turn-in + sign-offs in a side panel.
  // Phones: the columns dissolve (`contents`) and `order` keeps the original single-column sequence.
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_24rem] xl:gap-8">
      {/* -mb-5: grid gaps don't collapse with the title's own bottom margin (keeps the old spacing). */}
      <div className="-mb-5 lg:col-span-2">
        <Link href={back} className="text-sm text-muted hover:text-gold">← Back</Link>
        <SectionTitle sub={`${mod?.title ?? ""}${self ? "" : ` · ${man.first_name}`}`}>
          {step.item_number ? `#${step.item_number} ` : ""}{step.title}
        </SectionTitle>
      </div>

      <div className="contents lg:col-start-1 lg:block lg:space-y-5">
      {st === "returned" && sp.review_note && (
        <Notice tone="danger" className="order-2">
          <strong>Returned by {names[sp.returned_by ?? ""] ?? "a reviewer"}:</strong> {sp.review_note}
          <div className="mt-1 text-xs text-muted">{fmtDateTime(sp.returned_at, me.timezone)}</div>
        </Notice>
      )}

      {self && videosPending && <Notice className="order-2">Watch the 3 videos first — check each one off in <Link href="/app/program#key_1" className="underline">My Program</Link>, then this worksheet opens.</Notice>}
      {step.description && <Card className="order-2 whitespace-pre-line leading-relaxed"><div className="max-w-prose">{step.description}</div></Card>}
      {helper && <Notice className="order-2">{helper}</Notice>}

      {isWorksheet && (
        <Card className="order-2">
          <h2 className="mb-4 text-lg text-gold">Worksheet</h2>
          <WorksheetForm questions={questions} editable={editable} />
        </Card>
      )}
      </div>

      <aside className="contents lg:col-start-2 lg:row-start-2 lg:block lg:space-y-5" aria-label="Status and sign-offs">
      <div className="order-1 flex flex-wrap items-center gap-3 lg:rounded-xl lg:border lg:border-line lg:bg-panel lg:p-4">
        <StatusBadge step={{ ...step, progress: sp, submissions: [], lockNote: null }} />
        {step.turn_in && <Badge tone="orange">Turn in</Badge>}
        {due && <Badge>Due {fmtDate(due)}</Badge>}
        <div className="ml-auto lg:ml-0 lg:basis-full"><InitialBoxes step={{ ...step, progress: sp, submissions: [], lockNote: null }} names={names} /></div>
      </div>

      {(step.turn_in || step.requires_upload || isWorksheet) && (
        <Card className="order-3 space-y-4">
          <h2 className="text-lg text-gold">{isWorksheet ? "Or upload your paper worksheet" : "Turn in"}</h2>
          {editable && (
            <>
              {!isWorksheet && <TextTurnIn spId={sp.id} />}
              <UploadTurnIn spId={sp.id} stepId={step.id} manId={me.id} />
            </>
          )}
          <SubmissionList files={files} tz={me.timezone} />
        </Card>
      )}

      <Card className="order-3 flex flex-wrap items-center gap-3">
        {editable && (
          <ActionButton run={initialSelf.bind(null, sp.id)}
            confirm={step.gate_type === "leader" ? "Submit your certification packet for leader review?" : "Initial this item as complete?"}>
            {step.gate_type === "leader" ? "Submit packet" : "Initial (mine)"}
          </ActionButton>
        )}
        {canAp && <ActionButton run={initialAp.bind(null, sp.id)} confirm={`Give your AP initials for ${man.first_name}?`}>Initial as AP</ActionButton>}
        {canLeader && <ActionButton run={initialLeader.bind(null, sp.id)} confirm="Give leader initials?">{step.gate_type === "leader" ? "Approve packet" : "Initial as leader"}</ActionButton>}
        {leader && !self && mod?.key === "key_2" && step.item_number && step.item_number >= 13 && step.item_number <= 15 && (
          <ActionButton variant="ghost" run={setReadToGroup.bind(null, sp.id, !sp.read_to_group)}>
            {sp.read_to_group ? "Un-mark read to group" : "Mark read to group"}
          </ActionButton>
        )}
        {!editable && !canAp && !canLeader && <span className="text-sm text-muted">Nothing for you to do on this item right now.</span>}
      </Card>
      {canReturn && <div className="order-3"><ReturnForm spId={sp.id} /></div>}
      </aside>
    </div>
  );
}

function SubmissionList({ files, tz }: { files: (Submission & { url: string | null })[]; tz: string }) {
  if (!files.length) return <p className="text-sm text-muted">Nothing turned in yet.</p>;
  return (
    <ul className="space-y-3">
      {files.map((f) => (
        <li key={f.id} className="rounded-lg border border-line p-3 text-sm">
          <div className="flex justify-between text-xs text-muted"><span>Version {f.version}</span><span>{fmtDateTime(f.created_at, tz)}</span></div>
          {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-gold underline">{f.file_path?.split("/").pop()}</a>}
          {f.body_text && !f.body_text.startsWith("[{") && <p className="mt-1 whitespace-pre-line">{f.body_text}</p>}
          {f.body_text?.startsWith("[{") && <p className="mt-1 italic text-muted">Worksheet answers snapshot (shown above / in the packet).</p>}
        </li>
      ))}
    </ul>
  );
}

type Db = Awaited<ReturnType<typeof supabaseServer>>;
async function helperInfo(db: Db, step: ProgramStep, manId: string, man: { home_group?: string | null; service_position?: string | null }) {
  const h = step.helper?.type;
  if (step.item_number === 10 && man.home_group !== undefined) return `Home group on file: ${man.home_group || "not set yet (Profile)"}.`;
  if (step.item_number === 12 && man.service_position !== undefined) return `Service position on file: ${man.service_position || "not set yet (Profile)"}.`;
  if (h === "meeting_link_joined") {
    const { data } = await db.from("meeting_link_joins").select("joined_at").eq("man_id", manId).order("joined_at").limit(1);
    return data?.[0] ? `(D) ✓ First joined a Finally Free meeting from the app on ${fmtDate(data[0].joined_at)}.` : "(D) No meeting joined from the app yet — open one from Meetings & Links.";
  }
  if (h === "relationship") {
    const rel = step.helper?.rel as string;
    const { data } = await db.from("relationships").select("mentor_id, mentee_id, type, mutual").eq("status", "active")
      .or(`mentee_id.eq.${manId},and(mentor_id.eq.${manId},mutual.eq.true)`);
    const match = (data ?? []).filter((r) => (rel === "ap" ? r.type === "ap" : r.type !== "ap" && r.mentee_id === manId));
    const names = await namesFor(db, match.map((r) => (r.mentee_id === manId ? r.mentor_id : r.mentee_id)));
    let list = Object.values(names).join(", ");
    if (rel !== "ap") {
      const { data: outside } = await db.from("outside_sponsors").select("name, status").eq("man_id", manId).in("status", ["approved", "pending"]);
      for (const o of outside ?? []) list = [list, `${o.name} (outside FF${o.status === "pending" ? ", waiting for a leader's approval" : ", approved"})`].filter(Boolean).join(", ");
    }
    return list ? `${rel === "ap" ? "AP" : "Sponsor"} on file: ${list}.` : `No active ${rel === "ap" ? "AP" : "sponsor"} yet — use Find a Sponsor / AP.`;
  }
  if (h === "mentee_linked") {
    const { data } = await db.from("relationships").select("mentee_id").eq("status", "active").eq("mentor_id", manId).in("type", ["sponsor", "temp_sponsor"]);
    const names = await namesFor(db, (data ?? []).map((r) => r.mentee_id));
    const list = Object.values(names).join(", ");
    if (list) return `Sponsoring: ${list}.`;
    // Names follow member_cards visibility; still show that he is linked.
    return data?.length ? `Sponsoring ${data.length} ${data.length === 1 ? "man" : "men"} in the app.` : "Not linked as anyone's sponsor in the app yet.";
  }
  if (h === "cover_sheet") return "Your AP initials the cover sheet. Every orange item must have its turn-in uploaded first.";
  if (h === "cert_packet") return "Your packet is assembled automatically from your Key 1 worksheet, Key 2 cover sheet and orange turn-ins, and Key 3 Parts 1 and 2.";
  return null;
}
