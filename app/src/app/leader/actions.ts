"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { sendTemplate } from "@/lib/email";
import { env } from "@/lib/env";
import { callRpc } from "@/lib/rpc";
import { getMe } from "@/lib/auth";

type S = { error?: string; ok?: string } | undefined;
const done = (r: { ok: boolean; error?: string }, ok = "Done."): S => {
  revalidatePath("/leader", "layout");
  revalidatePath("/app", "layout");
  return r.ok ? { ok } : { error: (r as { error: string }).error };
};

export async function approveMember(id: string, _: S, form: FormData): Promise<S> {
  return done(await callRpc("approve_member", { p_man: id, p_primary_leader: (form.get("leader") as string) || null }), "Approved — welcome email sent.");
}
export async function setRole(id: string, _: S, form: FormData): Promise<S> {
  return done(await callRpc("set_member_role", { p_man: id, p_role: String(form.get("role")) }), "Role updated.");
}
export async function setStatus(id: string, status: "active" | "inactive"): Promise<S> {
  return done(await callRpc("set_member_status", { p_man: id, p_status: status }));
}
export async function setPrimaryLeader(id: string, _: S, form: FormData): Promise<S> {
  return done(await callRpc("set_primary_leader", { p_man: id, p_leader: (form.get("leader") as string) || null }), "Primary leader set.");
}
export async function certifyKey2(id: string): Promise<S> {
  return done(await callRpc("leader_certify_key2", { p_man: id }), "Detox-21 certified — Key 3 is open.");
}
export async function awardCertifiedAnother(mentor: string, mentee: string): Promise<S> {
  return done(await callRpc("leader_award_certified_another", { p_mentor: mentor, p_mentee: mentee }), "Milestone awarded.");
}
export async function confirmRelationship(id: string): Promise<S> {
  return done(await callRpc("leader_confirm_relationship", { p_rel: id }), "Match confirmed.");
}
export async function createRelationship(_: S, form: FormData): Promise<S> {
  const mentor = String(form.get("mentor") ?? ""), mentee = String(form.get("mentee") ?? ""), type = String(form.get("type") ?? "");
  if (!mentor || !mentee || mentor === mentee) return { error: "Pick two different men." };
  return done(await callRpc("leader_create_relationship", { p_mentor: mentor, p_mentee: mentee, p_type: type }), "Matched.");
}
export async function endRel(id: string): Promise<S> {
  return done(await callRpc("end_relationship", { p_rel: id }), "Ended.");
}

export async function addNote(manId: string, _: S, form: FormData): Promise<S> {
  const me = await getMe();
  const body = String(form.get("body") ?? "").trim();
  if (!me || !body) return { error: "Write a note first." };
  const db = await supabaseServer();
  const { error } = await db.from("leader_notes").insert({ man_id: manId, leader_id: me.id, body: body.slice(0, 5000) });
  revalidatePath(`/leader/men/${manId}`);
  return error ? { error: error.message } : { ok: "Note saved." };
}
export async function deleteNote(id: string, manId: string): Promise<S> {
  const db = await supabaseServer();
  await db.from("leader_notes").delete().eq("id", id);
  revalidatePath(`/leader/men/${manId}`);
  return { ok: "Deleted." };
}

const Meeting = z.object({
  name: z.string().trim().min(1).max(80),
  day_of_week: z.coerce.number().int().min(0).max(6),
  start_time_utc: z.string().regex(/^\d{2}:\d{2}$/),
  tagline: z.string().trim().max(200).optional(),
  zoom_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  zoom_id: z.string().trim().max(40).optional(),
  zoom_password: z.string().trim().max(60).optional(),
  secretary_first_name: z.string().trim().max(40).optional(),
  closed_note: z.string().trim().max(120).optional(),
});
/**
 * Leaders enter meeting times in their own timezone; we convert to the UTC
 * weekday + time the database stores.
 */
export async function saveMeeting(id: string | null, _: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in." };
  const p = Meeting.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].path.join(".") + ": " + p.error.issues[0].message };
  const { day, time } = localToUtc(p.data.day_of_week, p.data.start_time_utc, String(form.get("tz") || me.timezone));
  const row = {
    ...p.data, day_of_week: day, start_time_utc: time,
    zoom_url: p.data.zoom_url || null, zoom_id: p.data.zoom_id || null, zoom_password: p.data.zoom_password || null,
    tagline: p.data.tagline || null, secretary_first_name: p.data.secretary_first_name || null,
    beginner: form.get("beginner") === "on", active: form.get("active") === "on",
    temp_closed: form.get("temp_closed") === "on", closed_note: p.data.closed_note || null,
  };
  const db = await supabaseServer();
  const { error } = id ? await db.from("meetings").update(row).eq("id", id) : await db.from("meetings").insert(row);
  revalidatePath("/leader/meetings");
  revalidatePath("/meetings");
  revalidatePath("/app/meetings");
  return error ? { error: error.message } : { ok: "Saved." };
}
export async function deleteMeeting(id: string): Promise<S> {
  const db = await supabaseServer();
  const { error } = await db.from("meetings").delete().eq("id", id);
  revalidatePath("/leader/meetings");
  return error ? { error: error.message } : { ok: "Deleted." };
}

/** Converts "Sunday 7:00 PM in America/Chicago" to UTC weekday + HH:MM for the coming week. */
function localToUtc(dow: number, hhmm: string, tz: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  // Start from a UTC guess on the requested weekday, then correct by the zone's offset at that instant.
  const guess = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + ((dow - now.getUTCDay() + 7) % 7), h, m));
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess).map((x) => [x.type, x.value]));
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  const utc = new Date(guess.getTime() - (asLocal - guess.getTime()));
  return { day: utc.getUTCDay(), time: `${String(utc.getUTCHours()).padStart(2, "0")}:${String(utc.getUTCMinutes()).padStart(2, "0")}` };
}

/** A program video's link and passcode (never stored in the repo). */
export async function saveVideoLink(videoId: string, _: S, form: FormData): Promise<S> {
  const r = await callRpc("leader_set_video", {
    p_video: videoId, p_url: String(form.get("url") ?? ""), p_passcode: String(form.get("passcode") ?? ""),
  });
  revalidatePath("/leader/meetings");
  revalidatePath("/app/program");
  return r.ok ? { ok: "Saved." } : { error: r.error };
}

/** Approve or decline a man's outside (non-FF) sponsor. */
export async function reviewOutsideSponsor(id: string, approve: boolean): Promise<S> {
  return done(await callRpc("review_outside_sponsor", { p_id: id, p_approve: approve, p_note: null }),
    approve ? "Approved — it now counts as his sponsor." : "Declined.");
}

// ───────────────────────── admin: member sign-in ─────────────────────────
/**
 * Changes the email he signs in with. The sign-in account changes first (it
 * refuses an email another account uses); then his profile, with the admin
 * check and audit in admin_set_member_email. Both addresses are told.
 */
export async function adminSetEmail(manId: string, _: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (me?.role !== "admin" || me.status !== "active") return { error: "Only an admin can change a member's email." };
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const svc = supabaseService();
  const { data: before } = await svc.auth.admin.getUserById(manId);
  if (!before?.user) return { error: "Member not found." };
  if (before.user.email?.toLowerCase() === email.data) return { error: "That is already his email." };

  const { error: authErr } = await svc.auth.admin.updateUserById(manId, { email: email.data, email_confirm: true });
  if (authErr) return { error: /already|exists|registered/i.test(authErr.message) ? "Another account already uses that email." : authErr.message };
  const r = await callRpc("admin_set_member_email", { p_man: manId, p_email: email.data });
  if (!r.ok) {
    await svc.auth.admin.updateUserById(manId, { email: before.user.email, email_confirm: true });
    return { error: r.error };
  }
  const old = (r.data?.old_email as string | null) ?? before.user.email;
  await Promise.all([
    sendTemplate(manId, "email_changed", { to: email.data }).catch(() => false),
    old ? sendTemplate(manId, "email_changed", { to: email.data }, { toAddress: old }).catch(() => false) : null,
  ]);
  revalidatePath(`/leader/men/${manId}`);
  revalidatePath("/leader/members");
  return { ok: `Email changed to ${email.data}. He signs in with it now; both addresses were told.` };
}

/**
 * Password reset link for him: emailed to him, or returned for the admin to copy
 * and text. One use, expires in an hour; opening it signs him in to set a new password.
 */
export async function adminResetLink(manId: string, how: "emailed" | "copied"): Promise<{ ok?: string; error?: string; link?: string }> {
  const me = await getMe();
  if (me?.role !== "admin" || me.status !== "active") return { error: "Only an admin can send a password reset." };
  const r = await callRpc("admin_password_reset", { p_man: manId, p_how: how });
  if (!r.ok) return { error: r.error };
  const { data, error } = await supabaseService().auth.admin.generateLink({ type: "recovery", email: r.data?.email as string });
  if (error || !data.properties?.hashed_token) return { error: error?.message ?? "Couldn't make a reset link." };
  const link = `${env.siteUrl}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
  revalidatePath(`/leader/men/${manId}`);
  if (how === "copied") return { ok: "Link ready — copy it and text it to him. It works once and expires in 1 hour.", link };
  const sent = await sendTemplate(manId, "password_reset", { link }).catch(() => false);
  return sent ? { ok: "Reset link emailed. It works once and expires in 1 hour." } : { error: "The email didn't send. Use Copy link instead." };
}

/** Key 1 with no AP or sponsor: his primary leader (any leader if none) confirms the go-over, which opens Key 2. */
export async function confirmKey1(spId: string): Promise<S> {
  return done(await callRpc("initial_ap", { p_sp: spId }), "Key 1 confirmed.");
}
