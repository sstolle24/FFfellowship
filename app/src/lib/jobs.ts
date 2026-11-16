import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import { sendTemplate } from "@/lib/email";
import { purgeDeletedAccount } from "@/lib/purge";
import { ninetyCount, ninetyReminderDue, ninetyStart } from "@/lib/ninety";
import { daysBetween, todayIn, weekStart } from "@/lib/time";

const SOBRIETY_MILESTONES = [7, 30, 60, 90, 365];
const DAY = 86_400_000;

type P = {
  id: string; first_name: string; timezone: string; role: string; status: string; primary_leader_id: string | null;
  sobriety_start_date: string | null; program_start_date: string | null; ninety_start_date: string | null;
  last_active_at: string; stage: string;
};

async function base() {
  const db = supabaseService();
  const [{ data: people }, { data: rels }] = await Promise.all([
    db.from("profiles").select("id, first_name, timezone, role, status, primary_leader_id, sobriety_start_date, program_start_date, ninety_start_date, last_active_at, stage")
      // Locked men (0028) get no nudges, summaries or reminders; a leader is already on it.
      .eq("status", "active").is("deleted_at", null).is("locked_at", null),
    db.from("relationships").select("mentor_id, mentee_id, type, mutual").eq("status", "active"),
  ]);
  const { data: outside } = await db.from("outside_sponsors").select("man_id").eq("status", "approved");
  const men = (people as P[]) ?? [];
  const leaders = men.filter((p) => ["leader", "admin"].includes(p.role)).map((p) => p.id);
  const leadersFor = (p: Pick<P, "primary_leader_id">) => (p.primary_leader_id ? [p.primary_leader_id] : leaders);
  const mentorsOf = (id: string) => [...new Set((rels ?? [])
    .filter((r) => r.mentee_id === id || (r.mutual && r.mentor_id === id))
    .map((r) => (r.mentee_id === id ? r.mentor_id : r.mentee_id)))];
  // An FF sponsor, or an outside sponsor a leader approved.
  const hasSponsor = (id: string) => (rels ?? []).some((r) => r.mentee_id === id && r.type !== "ap")
    || (outside ?? []).some((o) => o.man_id === id);
  return { db, men, leaders, leadersFor, mentorsOf, hasSponsor };
}

/**
 * Inactivity lock (0028): warns men working their keys at day 10, locks them at
 * day 14 (the database decides who the rule applies to) and tells his leaders.
 */
export async function runInactivityLock(db: ReturnType<typeof supabaseService>, leadersFor: (p: Pick<P, "primary_leader_id">) => string[]) {
  const sent: Record<string, number> = {};
  const tick = (k: string, ok: boolean) => { if (ok) sent[k] = (sent[k] ?? 0) + 1; };
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "inactivity_lock_days").single();
  const lockDays = Number(setting?.value ?? 14);

  const { data: locked, error } = await db.rpc("lock_inactive_members");
  if (error) { console.error("lock_inactive_members", error.message); return { sent, locked: 0 }; }
  for (const m of (locked ?? []) as { id: string; first_name: string; primary_leader_id: string | null }[]) {
    tick("account_locked", await sendTemplate(m.id, "account_locked"));
    for (const l of leadersFor(m)) if (l !== m.id) tick("account_locked_leader", await sendTemplate(l, "account_locked_leader", { man: m.first_name, man_id: m.id }));
  }

  const { data: subjects } = await db.rpc("inactivity_subjects");
  for (const s of (subjects ?? []) as { id: string; quiet_since: string }[]) {
    const days = Math.floor((Date.now() - new Date(s.quiet_since).getTime()) / DAY);
    if (days >= lockDays - 4 && days < lockDays) {
      tick("inactivity_lock_warning", await sendTemplate(s.id, "inactivity_lock_warning", { days, left: lockDays - days }, { dedupeKey: `lock:${s.quiet_since.slice(0, 10)}` }));
    }
  }
  return { sent, locked: (locked ?? []).length };
}

/** Daily: inactivity, day-75 no sponsor, stale requests, sobriety milestones, 90-in-90, purge. */
export async function runDaily() {
  const { db, men, leaders, leadersFor, mentorsOf, hasSponsor } = await base();
  const sent: Record<string, number> = {};
  const tick = (k: string, ok: boolean) => { if (ok) sent[k] = (sent[k] ?? 0) + 1; };

  const { data: logs } = await db.from("meeting_logs").select("man_id, date").eq("counts_90", true);

  for (const p of men) {
    const quiet = Math.floor((Date.now() - new Date(p.last_active_at).getTime()) / DAY);
    const streak = p.last_active_at.slice(0, 10); // one nudge per quiet streak
    if (quiet >= 3) {
      tick("inactive_3d", await sendTemplate(p.id, "inactive_3d", {}, { dedupeKey: streak }));
      for (const m of mentorsOf(p.id)) tick("inactive_3d_mentor", await sendTemplate(m, "inactive_3d_mentor", { man: p.first_name }, { dedupeKey: `${p.id}:${streak}` }));
    }
    if (quiet >= 7) {
      for (const l of leadersFor(p)) if (l !== p.id) tick("inactive_7d_leader", await sendTemplate(l, "inactive_7d_leader", { man: p.first_name, man_id: p.id }, { dedupeKey: `${p.id}:${streak}` }));
    }

    // Day 75 of the program without a sponsor (Key 2 #18 is due at 90).
    if (p.program_start_date && !hasSponsor(p.id) && daysBetween(p.program_start_date, todayIn(p.timezone)) >= 75) {
      for (const l of leadersFor(p)) if (l !== p.id) tick("day75_no_sponsor", await sendTemplate(l, "day75_no_sponsor", { man: p.first_name, man_id: p.id }, { dedupeKey: `${p.id}:${p.program_start_date}` }));
    }

    // Sobriety milestones: send on the day, or catch up within 3 days if a run was missed.
    if (p.sobriety_start_date) {
      const d = daysBetween(p.sobriety_start_date, todayIn(p.timezone));
      for (const m of SOBRIETY_MILESTONES) {
        if (d >= m && d - m <= 3) tick("sobriety_milestone", await sendTemplate(p.id, "sobriety_milestone", { days: m }, { dedupeKey: `${p.sobriety_start_date}:${m}` }));
      }
      if (d > 365 && d % 365 <= 3) {
        const years = Math.floor(d / 365);
        tick("sobriety_milestone", await sendTemplate(p.id, "sobriety_milestone", { days: years * 365 }, { dedupeKey: `${p.sobriety_start_date}:${years}y` }));
      }
    }

    // 90 in 90 complete.
    const count = ninetyCount((logs ?? []).filter((l) => l.man_id === p.id), ninetyStart(p));
    if (count >= 90) tick("ninety_complete", await sendTemplate(p.id, "ninety_complete", {}, { dedupeKey: ninetyStart(p) ?? "x" }));
  }

  // Match requests open 7+ days → leaders (once per request).
  const { data: reqs } = await db.from("match_requests").select("id, requester_id, type, created_at").in("status", ["open", "offered"]);
  for (const r of reqs ?? []) {
    if (Date.now() - new Date(r.created_at).getTime() < 7 * DAY) continue;
    const who = men.find((m) => m.id === r.requester_id);
    for (const l of leaders) tick("match_open_7d", await sendTemplate(l, "match_open_7d", { man: who?.first_name ?? "A brother", kind: r.type === "ap" ? "AP" : "sponsor" }, { dedupeKey: r.id }));
  }

  // Purge accounts deleted more than N days ago (files, his records, contact fields, auth user).
  const { data: setting } = await db.from("app_settings").select("value").eq("key", "purge_submissions_after_days").single();
  const cutoff = new Date(Date.now() - Number(setting?.value ?? 30) * DAY).toISOString();
  const { data: gone } = await db.from("profiles").select("id").lt("deleted_at", cutoff);
  let purged = 0;
  for (const g of gone ?? []) {
    try {
      purged += await purgeDeletedAccount(db, g.id);
    } catch (err) {
      console.error((err as Error).message); // retried on the next daily run
    }
  }
  const lock = await runInactivityLock(db, leadersFor);
  return { sent: { ...sent, ...lock.sent }, locked: lock.locked, purged_files: purged };
}

/** Sunday: weekly summary to each active man. */
export async function runWeeklyMember() {
  const { db, men } = await base();
  const since = new Date(Date.now() - 7 * DAY).toISOString().slice(0, 10);
  const [{ data: logs }, { data: fish }, { data: prog }] = await Promise.all([
    db.from("meeting_logs").select("man_id, date, counts_90"),
    db.from("fishing_contacts").select("man_id, week_start"),
    db.from("step_progress").select("man_id, status"),
  ]);
  let n = 0;
  for (const p of men) {
    const mine = (logs ?? []).filter((l) => l.man_id === p.id);
    const ninety = ninetyCount(mine, ninetyStart(p));
    const days = p.sobriety_start_date ? daysBetween(p.sobriety_start_date, todayIn(p.timezone)) : "not set";
    const openItems = (prog ?? []).filter((x) => x.man_id === p.id && ["open", "returned"].includes(x.status)).length;
    const ok = await sendTemplate(p.id, "weekly_member_summary", {
      days, meetings: mine.filter((l) => l.date >= since).length, ninety: Math.min(90, ninety),
      fishing: (fish ?? []).filter((f) => f.man_id === p.id && f.week_start === weekStart(p.timezone)).length,
      next: openItems ? `${openItems} program item${openItems > 1 ? "s" : ""} open` : "Keep going to meetings and fishing",
    }, { dedupeKey: todayIn("UTC") });
    if (ok) n++;
  }
  return { sent: n };
}

/** Monday: digest to every leader. */
export async function runWeeklyLeader() {
  const { db, men, leaders } = await base();
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const [{ count: pending }, { data: prog }, { count: matches }, { count: panic }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
    db.from("step_progress").select("status, program_steps(gate_type)").in("status", ["self_initialed", "ap_initialed"]),
    db.from("match_requests").select("id", { count: "exact", head: true }).in("status", ["open", "offered", "pending_leader"]),
    db.from("panic_events").select("id", { count: "exact", head: true }).gt("created_at", weekAgo),
  ]);
  const review = (prog ?? []).filter((p) => {
    const g = (p.program_steps as unknown as { gate_type: string } | null)?.gate_type;
    return (g === "triple" && p.status === "ap_initialed") || (g === "leader" && p.status === "self_initialed");
  }).length;
  const inactive = men.filter((p) => Date.now() - new Date(p.last_active_at).getTime() >= 7 * DAY).length;
  let n = 0;
  for (const l of leaders) {
    if (await sendTemplate(l, "weekly_leader_digest", { pending: pending ?? 0, review, matches: matches ?? 0, inactive, panic: panic ?? 0 }, { dedupeKey: todayIn("UTC") })) n++;
  }
  return { sent: n };
}

/** Hourly: the 8 pm "did you make a meeting today?" reminder for men in their 90 in 90 (once a day each). */
export async function runHourly() {
  const { db, men } = await base();
  const now = new Date();
  const since = new Date(now.getTime() - 100 * DAY).toISOString().slice(0, 10);
  const ids = men.map((m) => m.id);
  const { data: logs } = ids.length
    ? await db.from("meeting_logs").select("man_id, date, counts_90").in("man_id", ids).gte("date", since)
    : { data: [] };
  let sent = 0;
  for (const m of men) {
    const due = ninetyReminderDue(m, (logs ?? []).filter((l) => l.man_id === m.id), now);
    if (!due) continue;
    if (await sendTemplate(m.id, "ninety_reminder", { day: due.day, count: due.count }, { dedupeKey: `ninety:${due.today}` })) sent++;
  }
  return { sent: { ninety_reminder: sent } };
}
