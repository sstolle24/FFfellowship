import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ModuleKey, ProgramModule, ProgramStep, StepProgress, Submission, WorksheetQuestion, Gate, StepStatus,
} from "@/lib/types";

export type StepView = ProgramStep & {
  progress: StepProgress | null; submissions: Submission[];
  /** Why this item is locked ("Finish #3 first."), or null when it's open to him. Mirrors app.lock_reason. */
  lockNote: string | null;
};
export type VideoView = {
  id: string; order_no: number; title: string; video_url: string | null; watched_at: string | null; notes: string | null;
  /** Videos are watched in order: "Watch Video 1 first." */
  lockNote: string | null;
};
export type ModuleView = ProgramModule & {
  steps: StepView[];
  videos: VideoView[];
  questions: (WorksheetQuestion & { answers: string[] })[];
  unlocked: boolean;
  done: boolean;
  /** For a locked key: "Finish Key 1 first." */
  lockNote: string | null;
};

/** What has to be finished before each key opens (keys are strictly sequential). */
const PREV_KEY: Partial<Record<ModuleKey, string>> = {
  key_1: "Module 0", key_2: "Key 1", key_3_part_1: "Key 2", key_3_part_2: "Key 3 Part 1", certification: "Key 3",
};

/** His part of an item is done (a returned item was done once; it never re-locks what follows). */
export function selfDone(s: StepStatus | undefined) {
  return !!s && ["self_initialed", "ap_initialed", "leader_initialed", "returned"].includes(s);
}
/** Timed / waiting-on-others items (helper.background) don't hold back the next item once started. */
export function blocksNext(step: ProgramStep, s: StepStatus | undefined) {
  return !(selfDone(s) || (step.helper?.background === true && !!s && s !== "locked"));
}

export function stepDone(s: StepStatus | undefined, g: Gate) {
  if (!s) return false;
  if (g === "self") return ["self_initialed", "ap_initialed", "leader_initialed"].includes(s);
  if (g === "self_ap") return ["ap_initialed", "leader_initialed"].includes(s);
  return s === "leader_initialed";
}

/**
 * Everything about one man's program, read with the caller's own client —
 * so RLS decides whether the caller may see it (self, active AP/sponsor, leader).
 */
export async function loadProgram(db: SupabaseClient, manId: string) {
  const [mods, steps, prog, subs, vids, vprog, qs, ans, ms] = await Promise.all([
    db.from("program_modules").select("*").order("order_no"),
    db.from("program_steps").select("*").order("order_no"),
    db.from("step_progress").select("*").eq("man_id", manId),
    db.from("submissions").select("*").eq("man_id", manId).order("version"),
    db.from("videos").select("*").order("order_no"),
    db.from("video_progress").select("*").eq("man_id", manId),
    db.from("worksheet_questions").select("*").order("order_no"),
    db.from("worksheet_answers").select("question_id, slot, answer").eq("man_id", manId),
    db.from("milestones").select("type, awarded_at, related_man_id").eq("man_id", manId),
  ]);
  const progBy = new Map((prog.data as StepProgress[] ?? []).map((p) => [p.step_id, p]));
  const subsBy = new Map<string, Submission[]>();
  for (const s of (subs.data as Submission[]) ?? []) subsBy.set(s.step_progress_id, [...(subsBy.get(s.step_progress_id) ?? []), s]);
  const vpBy = new Map((vprog.data ?? []).map((v) => [v.video_id, v]));
  const ansBy = new Map<string, string[]>();
  for (const a of ans.data ?? []) {
    const arr = ansBy.get(a.question_id) ?? [];
    arr[a.slot - 1] = a.answer ?? "";
    ansBy.set(a.question_id, arr);
  }

  const modules: ModuleView[] = ((mods.data as ProgramModule[]) ?? []).map((m) => {
    const videos: VideoView[] = [];
    for (const v of (vids.data ?? []).filter((x) => x.module_id === m.id)) {
      const prev = videos[videos.length - 1];
      videos.push({
        id: v.id, order_no: v.order_no, title: v.title, video_url: v.video_url,
        watched_at: vpBy.get(v.id)?.watched_at ?? null, notes: vpBy.get(v.id)?.notes ?? null,
        lockNote: prev && !prev.watched_at ? (prev.lockNote ?? `Watch ${prev.title} first.`) : null,
      });
    }
    const st: StepView[] = [];
    let blocker: ProgramStep | null = null;
    for (const s of ((steps.data as ProgramStep[]) ?? []).filter((x) => x.module_id === m.id)) {
      const p = progBy.get(s.id) ?? null;
      let lockNote: string | null = null;
      if (!p || p.status === "locked") {
        lockNote = m.key === "key_1" && s.helper?.type === "worksheet" && videos.some((v) => !v.watched_at)
          ? "Watch the 3 videos first."
          : blocker ? `Finish ${blocker.item_number ? `#${blocker.item_number}` : `the ${blocker.title}`} first.` : null;
      }
      if (!blocker && blocksNext(s, p?.status)) blocker = s;
      st.push({ ...s, progress: p, submissions: p ? subsBy.get(p.id) ?? [] : [], lockNote });
    }
    const questions = ((qs.data as WorksheetQuestion[]) ?? []).filter((q) => q.module_id === m.id)
      .map((q) => ({ ...q, answers: ansBy.get(q.id) ?? [] }));
    const milestones = ms.data ?? [];
    const done = m.key === "key_2"
      ? milestones.some((x) => x.type === "detox21_certified")
      : st.length > 0 && st.every((s) => stepDone(s.progress?.status, s.gate_type))
        && (m.key !== "key_1" || videos.every((v) => v.watched_at));
    return { ...m, steps: st, videos, questions, unlocked: st.some((s) => s.progress && s.progress.status !== "locked"), done, lockNote: null };
  });
  // Key 1 opens with its videos (its first step, the worksheet, waits for them).
  for (const [i, m] of modules.entries()) {
    if (m.key === "key_1" && i > 0 && modules[i - 1].done) m.unlocked = true;
    if (!m.unlocked) {
      m.lockNote = `Finish ${PREV_KEY[m.key] ?? "the previous key"} first.`;
      for (const s of m.steps) s.lockNote = m.lockNote;
      for (const v of m.videos) v.lockNote = m.lockNote;
    }
  }

  const byKey = Object.fromEntries(modules.map((m) => [m.key, m])) as Record<ModuleKey, ModuleView>;
  return { modules, byKey, milestones: ms.data ?? [] };
}

export type Program = Awaited<ReturnType<typeof loadProgram>>;

/** The single most useful next thing for the man to do. */
export function nextStep(p: Program): { label: string; href: string } {
  for (const m of p.modules) {
    if (!m.unlocked) continue;
    const returned = m.steps.find((s) => s.progress?.status === "returned");
    if (returned) return { label: `Revise: ${returned.item_number ? `#${returned.item_number} ` : ""}${returned.title}`, href: `/app/step/${returned.progress!.id}` };
    if (m.key === "key_1") {
      const v = m.videos.find((x) => !x.watched_at);
      if (v) return { label: `Watch ${v.title}`, href: "/app/program#key_1" };
    }
    const open = m.steps.find((s) => s.progress?.status === "open");
    if (open) return { label: `${open.item_number ? `#${open.item_number} ` : ""}${open.title}`, href: `/app/step/${open.progress!.id}` };
  }
  const waiting = p.modules.flatMap((m) => m.steps).find((s) => s.progress && ["self_initialed", "ap_initialed"].includes(s.progress.status));
  if (waiting) return { label: "Waiting on sign-offs — keep going to meetings and calling brothers", href: "/app/program" };
  return { label: "Keep fishing — help another man get free", href: "/app/fishing" };
}

export function dueDate(programStart: string | null, dueDay: number | null) {
  if (!programStart || !dueDay) return null;
  const d = new Date(programStart + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dueDay);
  return d.toISOString().slice(0, 10);
}
