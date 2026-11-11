"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { sendTemplate } from "@/lib/email";
import { env } from "@/lib/env";
import { safeTz, zonedTime } from "@/lib/time";
import { videoEmbedUrl } from "@/lib/video";
import { callRpc } from "@/lib/rpc";
import { dispatchEvents } from "@/lib/events";
import { mergeBulkEvents } from "@/lib/bulk";
import type { RpcEvent, RpcResult } from "@/lib/types";
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
/** Denies a pending sign-up: closed like a deleted account (purged later). Emailing him is optional. */
export async function denyMember(id: string, _: S, form: FormData): Promise<S> {
  const r = await callRpc("deny_member", { p_man: id, p_reason: String(form.get("reason") ?? "") || null });
  if (r.ok && form.get("notify") === "on") await sendTemplate(id, "member_denied", {}, { evenIfClosed: true }).catch(() => false);
  return done(r, form.get("notify") === "on" ? "Denied — he was emailed." : "Denied.");
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
  local_day: z.coerce.number().int().min(0).max(6),
  local_time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(200).optional(),
  zoom_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  zoom_id: z.string().trim().max(40).optional(),
  zoom_password: z.string().trim().max(60).optional(),
  secretary_first_name: z.string().trim().max(40).optional(),
  closed_note: z.string().trim().max(120).optional(),
});
/**
 * A meeting is saved in its own time zone (weekday + local time), so it keeps
 * the same local time across daylight saving; the database fills in the UTC fields.
 */
export async function saveMeeting(id: string | null, _: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in." };
  const p = Meeting.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].path.join(".") + ": " + p.error.issues[0].message };
  if (safeTz(p.data.timezone) !== p.data.timezone) return { error: "Choose a time zone from the list." };
  const row = {
    ...p.data,
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

/** Admin, man with no AP: finishes Module 0 and Key 1 for him as a recorded override and opens Key 2. */
export async function unlockKey2(manId: string): Promise<S> {
  return done(await callRpc("admin_unlock_key2", { p_man: manId }), "Key 2 is open for him.");
}

// ───────────────────────── meeting artwork ─────────────────────────
const ART_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** One-time upload pass for a meeting's image ({meeting}/{file}); storage checks he's a leader. */
export async function meetingArtTicket(meetingId: string, fileName: string): Promise<{ path?: string; token?: string; type?: string; error?: string }> {
  const me = await getMe();
  if (!me || !["leader", "admin"].includes(me.role)) return { error: "Leaders only." };
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!ART_TYPES[ext]) return { error: "Use a JPG, PNG or WebP image." };
  const safe = fileName.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60) || "art";
  const path = `${meetingId}/${Date.now()}-${safe}.${ext}`;
  const { data, error } = await (await supabaseServer()).storage.from("meeting-art").createSignedUploadUrl(path);
  return error ? { error: error.message } : { path, token: data.token, type: ART_TYPES[ext] };
}

/** Sets (or, with null, removes) a meeting's image, and removes the old file. */
export async function setMeetingArt(meetingId: string, path: string | null): Promise<S> {
  const db = await supabaseServer();
  const { data: cur } = await db.from("meetings").select("art_path").eq("id", meetingId).maybeSingle();
  const { error } = await db.from("meetings").update({ art_path: path }).eq("id", meetingId);
  if (error) return { error: error.message };
  if (cur?.art_path && cur.art_path !== path && !cur.art_path.startsWith("static/")) await db.storage.from("meeting-art").remove([cur.art_path]);
  revalidatePath("/leader/meetings");
  revalidatePath("/meetings");
  revalidatePath("/app/meetings");
  return { ok: path ? "Image saved." : "Image removed." };
}

// ───────────────────────── What's Happening ─────────────────────────
const EventForm = z.object({
  kind: z.enum(["event", "prayer", "service"]),
  title: z.string().trim().min(1, "Give it a title.").max(120),
  body: z.string().trim().max(2000).optional(),
  date: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
  start: z.string().regex(/^(\d{2}:\d{2})?$/),
  end: z.string().regex(/^(\d{2}:\d{2})?$/),
  timezone: z.string().trim().min(1).max(60),
  location: z.string().trim().max(200).optional(),
  link: z.string().trim().max(500).optional(),
  video_url: z.string().trim().max(300).optional(),
});

/** Adds or updates an item. Date + times are entered in the item's own time zone. */
type EventSaved = { error?: string; ok?: string; newId?: string; title?: string; membersOnly?: boolean } | undefined;
export async function saveEvent(id: string | null, _: EventSaved, form: FormData): Promise<EventSaved> {
  const me = await getMe();
  if (!me) return { error: "Sign in." };
  const p = EventForm.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (safeTz(d.timezone) !== d.timezone) return { error: "Choose a time zone from the list." };
  if (d.link && !/^https:\/\/\S+$/i.test(d.link)) return { error: "The link must start with https://" };
  if (d.video_url && !videoEmbedUrl(d.video_url)) return { error: "The video link must be a YouTube or Vimeo link (https://…)." };
  if ((d.start || d.end) && !d.date) return { error: "Add the date too." };
  if (d.end && !d.start) return { error: "Add the start time too." };
  const starts = d.date ? zonedTime(d.date, d.start || "00:00", d.timezone) : null;
  const ends = d.date && d.end ? zonedTime(d.date, d.end, d.timezone) : null;
  if (starts && ends && ends < starts) return { error: "The end time is before the start time." };
  const row = {
    kind: d.kind, title: d.title, body: d.body || null, timezone: d.timezone, location: d.location || null, link: d.link || null,
    starts_at: starts?.toISOString() ?? null, ends_at: ends?.toISOString() ?? null, members_only: form.get("members_only") === "on",
    video_url: d.video_url || null,
  };
  const db = await supabaseServer();
  const { data: made, error } = id ? await db.from("community_events").update(row).eq("id", id).select("id").maybeSingle()
    : await db.from("community_events").insert({ ...row, created_by: me.id }).select("id").single();
  revalidatePath("/leader/community");
  revalidatePath("/app/community");
  revalidatePath("/whats-happening");
  if (error) return { error: error.message };
  // A new item: hand back its id so the form can offer the video upload right away.
  return id ? { ok: "Saved." } : { ok: "Posted.", newId: made?.id as string, title: row.title, membersOnly: row.members_only };
}
export async function deleteEvent(id: string): Promise<S> {
  const { error } = await (await supabaseServer()).from("community_events").delete().eq("id", id);
  revalidatePath("/leader/community");
  revalidatePath("/app/community");
  revalidatePath("/whats-happening");
  return error ? { error: error.message } : { ok: "Removed." };
}

// ───────────────────────── bulk sign-off ─────────────────────────
type Bulk = { ok?: string; error?: string; skipped?: { item: string; why: string }[] };

/**
 * Runs one gate (leader initials, or the AP override) over several of a man's
 * items. Each goes through the same function and rules as signing it alone;
 * anything refused is skipped with its reason. Emails are combined per person.
 */
async function bulk(manId: string, spIds: string[], fn: "initial_leader" | "leader_override_ap", args: Record<string, unknown> = {}): Promise<Bulk> {
  const me = await getMe();
  if (!me || !["leader", "admin"].includes(me.role) || me.status !== "active") return { error: "Leaders only." };
  if (!spIds.length) return { error: "Select at least one item." };
  if (spIds.length > 60) return { error: "Select at most 60 items at a time." };
  const db = await supabaseServer();
  const { data: items } = await db.from("step_progress").select("id, man_id, program_steps(item_number, title)").in("id", spIds);
  const label = (id: string) => {
    const s = (items ?? []).find((x) => x.id === id)?.program_steps as unknown as { item_number: number | null; title: string } | null;
    return s ? (s.item_number ? `#${s.item_number}` : s.title) : "item";
  };
  const events: RpcEvent[] = [];
  const skipped: { item: string; why: string }[] = [];
  let done = 0;
  for (const id of spIds) {
    if ((items ?? []).find((x) => x.id === id)?.man_id !== manId) { skipped.push({ item: label(id), why: "Not his item." }); continue; }
    const { data, error } = await db.rpc(fn, { p_sp: id, ...args });
    if (error) { skipped.push({ item: label(id), why: error.message }); continue; }
    done++;
    // actor: he isn't emailed about his own sign-offs (e.g. "ready for leader review" on items he can't initial).
    events.push(...(((data as RpcResult)?.events ?? []) as RpcEvent[]).map((e) => ({ ...e, actor: me.id })));
  }
  await dispatchEvents(mergeBulkEvents(events));
  revalidatePath("/leader", "layout");
  revalidatePath("/app", "layout");
  const what = fn === "initial_leader" ? "Leader initials given on" : "AP sign-off given (override) on";
  return { ok: done ? `${what} ${done} item${done === 1 ? "" : "s"}.` : undefined, error: done ? undefined : "Nothing was signed.", skipped };
}
export async function bulkLeaderInitial(manId: string, spIds: string[]): Promise<Bulk> {
  return bulk(manId, spIds, "initial_leader");
}
export async function bulkOverrideAp(manId: string, spIds: string[], reason: string): Promise<Bulk> {
  if (!reason.trim()) return { error: "Give a reason for overriding the AP sign-off." };
  return bulk(manId, spIds, "leader_override_ap", { p_reason: reason.trim().slice(0, 500) });
}

// ───────────────────────── What's Happening videos ─────────────────────────
const VIDEO_TYPES: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

/** One-time upload pass for an item's video ({item}/{file}); storage checks he's a leader. */
export async function eventVideoTicket(eventId: string, fileName: string): Promise<{ path?: string; token?: string; type?: string; error?: string }> {
  const me = await getMe();
  if (!me || !["leader", "admin"].includes(me.role)) return { error: "Leaders only." };
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (!VIDEO_TYPES[ext]) return { error: "Use an MP4, MOV or WebM video." };
  const safe = fileName.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 60) || "video";
  const path = `${eventId}/${Date.now()}-${safe}.${ext}`;
  const { data, error } = await (await supabaseServer()).storage.from("community-video").createSignedUploadUrl(path);
  return error ? { error: error.message } : { path, token: data.token, type: VIDEO_TYPES[ext] };
}

/** Sets (or, with null, removes) an item's uploaded video, and deletes the old file. */
export async function setEventVideo(eventId: string, path: string | null): Promise<S> {
  const db = await supabaseServer();
  const { data: cur } = await db.from("community_events").select("video_path").eq("id", eventId).maybeSingle();
  const { error } = await db.from("community_events").update({ video_path: path }).eq("id", eventId);
  if (error) return { error: error.message };
  if (cur?.video_path && cur.video_path !== path) await db.storage.from("community-video").remove([cur.video_path]);
  revalidatePath("/leader/community");
  revalidatePath("/app/community");
  revalidatePath("/whats-happening");
  return { ok: path ? "Video saved." : "Video removed." };
}
