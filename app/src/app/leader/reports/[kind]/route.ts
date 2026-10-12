import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { dayCount } from "@/lib/time";

type Row = Record<string, unknown>;

function csv(rows: Row[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

/** Leader CSV reports. Reads with the leader's own session (RLS), and logs each export. */
export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const db = await supabaseServer();
  const { error: authErr } = await db.rpc("log_report_export", { p_kind: kind });
  if (authErr) return NextResponse.json({ error: "Leaders only" }, { status: 403 });

  const { data: people } = await db.from("profiles").select("*").is("deleted_at", null);
  const name = (id: string | null) => people?.find((p) => p.id === id)?.first_name ?? "";
  let rows: Row[] = [];

  if (kind === "members") {
    rows = (people ?? []).map((p) => ({
      first_name: p.first_name, display_name: p.display_name, email: p.email, status: p.status, role: p.role, stage: p.stage,
      day_count: dayCount(p.sobriety_start_date, p.timezone), sobriety_start_date: p.sobriety_start_date,
      program_start_date: p.program_start_date, last_active_at: p.last_active_at, primary_leader: name(p.primary_leader_id),
      timezone: p.timezone, country: p.country, home_group: p.home_group, service_position: p.service_position,
    }));
  } else if (kind === "progress") {
    const [{ data: prog }, { data: steps }, { data: rels }, { data: subs }] = await Promise.all([
      db.from("step_progress").select("man_id, step_id, status"),
      db.from("program_steps").select("id, turn_in, program_modules(key)"),
      db.from("relationships").select("mentor_id, mentee_id, type, mutual").eq("status", "active"),
      db.from("submissions").select("man_id, step_progress_id"),
    ]);
    const key = new Map((steps ?? []).map((s) => [s.id, (s.program_modules as unknown as { key: string }).key]));
    const orange = new Set((steps ?? []).filter((s) => s.turn_in).map((s) => s.id));
    rows = (people ?? []).filter((p) => p.status === "active").map((p) => {
      const mine = (prog ?? []).filter((x) => x.man_id === p.id);
      const st = (k: string) => mine.filter((x) => key.get(x.step_id) === k).map((x) => x.status).join("|");
      const ap = (rels ?? []).find((r) => r.type === "ap" && (r.mentee_id === p.id || r.mentor_id === p.id));
      const sp = (rels ?? []).find((r) => r.type !== "ap" && r.mentee_id === p.id);
      return {
        first_name: p.first_name, stage: p.stage,
        key1: st("key_1"), key2_signed_off: mine.filter((x) => key.get(x.step_id) === "key_2" && x.status === "leader_initialed").length,
        key2_turn_ins: new Set((subs ?? []).filter((s) => s.man_id === p.id).map((s) => s.step_progress_id)).size,
        key2_orange_items: [...orange].length,
        key3_part1: st("key_3_part_1"), key3_part2: st("key_3_part_2"), certification: st("certification"),
        ap: ap ? name(ap.mentee_id === p.id ? ap.mentor_id : ap.mentee_id) : "", sponsor: sp ? name(sp.mentor_id) : "",
      };
    });
  } else if (kind === "ninety") {
    const { data: logs } = await db.from("meeting_logs").select("man_id, date, counts_90");
    rows = (people ?? []).filter((p) => p.status === "active").map((p) => {
      const l = (logs ?? []).filter((x) => x.man_id === p.id && x.counts_90 && (!p.program_start_date || x.date >= p.program_start_date));
      return { first_name: p.first_name, program_start_date: p.program_start_date, meetings_logged: l.length, complete: l.length >= 90 };
    });
  } else if (kind === "milestones") {
    const { data: ms } = await db.from("milestones").select("*").order("awarded_at");
    rows = (ms ?? []).map((m) => ({ man: name(m.man_id), milestone: m.type, awarded_at: m.awarded_at, awarded_by: name(m.awarded_by), related_man: name(m.related_man_id) }));
  } else if (kind === "audit") {
    const { data: a } = await db.from("audit_log").select("*").order("at", { ascending: false }).limit(5000);
    rows = (a ?? []).map((x) => ({ at: x.at, actor: name(x.actor_id), action: x.action, table: x.target_table, target_id: x.target_id, detail: x.detail }));
  } else {
    return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }

  return new NextResponse(csv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ff-${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
