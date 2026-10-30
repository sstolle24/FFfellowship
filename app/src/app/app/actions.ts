"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { callRpc } from "@/lib/rpc";
import { getMe } from "@/lib/auth";
import { ninetyStartProblem } from "@/lib/ninety";
import { todayIn, weekStart } from "@/lib/time";

type S = { error?: string; ok?: string } | undefined;
const done = (r: { ok: boolean; error?: string }, ok?: string, path = "/app"): S => {
  revalidatePath(path, "layout");
  return r.ok ? { ok } : { error: (r as { error: string }).error };
};

// ───────────────────────── program gates ─────────────────────────
export async function initialSelf(spId: string): Promise<S> {
  return done(await callRpc("initial_self", { p_sp: spId }), "Initialed.");
}
export async function initialAp(spId: string): Promise<S> {
  return done(await callRpc("initial_ap", { p_sp: spId }), "AP initials added.");
}
export async function initialLeader(spId: string): Promise<S> {
  return done(await callRpc("initial_leader", { p_sp: spId }), "Leader initials added.");
}
export async function returnStep(spId: string, _: S, form: FormData): Promise<S> {
  return done(await callRpc("return_step", { p_sp: spId, p_note: String(form.get("note") ?? "") }), "Returned with your note.");
}
/** Leader signs the AP column on the AP's behalf (reason required; another leader gives the leader initials). */
export async function overrideAp(spId: string, _: S, form: FormData): Promise<S> {
  revalidatePath("/leader", "layout");
  return done(await callRpc("leader_override_ap", { p_sp: spId, p_reason: String(form.get("reason") ?? "") }),
    "AP sign-off given as a leader override. Another leader gives the leader initials.");
}
export async function setReadToGroup(spId: string, value: boolean): Promise<S> {
  return done(await callRpc("set_read_to_group", { p_sp: spId, p_value: value }));
}

/** Typed turn-in (no file). */
export async function submitText(spId: string, _: S, form: FormData): Promise<S> {
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write something to turn in." };
  return done(await callRpc("add_submission", { p_sp: spId, p_body: body, p_file_path: null }), "Turned in.");
}

/** Sets a new password for the signed-in man (after a reset link, or from Profile). */
export async function setPassword(_: S, form: FormData): Promise<S> {
  const pw = String(form.get("password") ?? "");
  if (pw.length < 10) return { error: "Use at least 10 characters." };
  if (pw !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const { error } = await (await supabaseServer()).auth.updateUser({ password: pw });
  if (error) return { error: /different from the old/i.test(error.message) ? "Choose a password different from your old one." : error.message };
  return { ok: "Password saved. Use it next time you log in." };
}

/**
 * One-time pass for the browser to upload into his own folder. His session cookie is
 * httpOnly, so the browser can't reach storage as him; the server asks storage instead,
 * and storage checks its upload rules (his folder, an open step or video) as him.
 */
export async function uploadTicket(path: string): Promise<{ token?: string; error?: string }> {
  const me = await getMe();
  if (!me) return { error: "Sign in again, then retry." };
  if (!path.startsWith(`${me.id}/`)) return { error: "You can only upload to your own folder." };
  const db = await supabaseServer();
  const { data, error } = await db.storage.from("submissions").createSignedUploadUrl(path);
  return error ? { error: error.message } : { token: data.token };
}

/** Called after the browser uploaded the file into the man's own storage folder. */
export async function recordUpload(spId: string, path: string, note: string): Promise<S> {
  return done(await callRpc("add_submission", { p_sp: spId, p_body: note || null, p_file_path: path }), "Uploaded.");
}
export async function nextVersion(spId: string): Promise<number> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("next_submission_version", { p_sp: spId });
  if (error) throw new Error(error.message);
  return data as number;
}

/** Saves worksheet answers. The DB trigger refuses edits once the worksheet is initialed. */
export async function saveAnswers(_: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const rows: { man_id: string; question_id: string; slot: number; answer: string }[] = [];
  for (const [k, v] of form.entries()) {
    const m = /^a:([0-9a-f-]{36}):(\d+)$/.exec(k);
    if (m) rows.push({ man_id: me.id, question_id: m[1], slot: Number(m[2]), answer: String(v).slice(0, 5000) });
  }
  if (!rows.length) return { ok: "Nothing to save." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("worksheet_answers").upsert(rows, { onConflict: "man_id,question_id,slot" });
  revalidatePath("/app/program", "layout");
  return error ? { error: error.message } : { ok: "Saved." };
}

export async function saveVideo(videoId: string, _: S, form: FormData): Promise<S> {
  const watched = form.get("watched") === "on";
  const reflection = form.get("reflection");
  const r = await callRpc("save_video", {
    p_video: videoId,
    p_notes: String(form.get("notes") ?? "").slice(0, 10000),
    p_reflection: reflection === null ? null : String(reflection).slice(0, 20000),
    p_file_path: null,
    p_watched: watched,
  });
  revalidatePath("/app/program");
  return r.ok ? { ok: watched ? "Saved and checked off." : "Saved." } : { error: r.error };
}

/** Called after the browser uploaded his reflection file into {man}/{video}/{n}/. */
export async function recordReflectionFile(videoId: string, path: string): Promise<S> {
  const r = await callRpc("save_video", { p_video: videoId, p_notes: null, p_reflection: null, p_file_path: path, p_watched: null });
  revalidatePath("/app/program");
  return r.ok ? { ok: "Reflection uploaded." } : { error: r.error };
}

// ───────────────────────── meetings, 90 in 90, journal, fishing ─────────────────────────
export async function joinMeeting(meetingId: string) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("join_meeting", { p_meeting: meetingId });
  if (error) return { error: error.message };
  return { url: (data as { zoom_url: string | null }).zoom_url };
}

const Log = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meeting_id: z.string().uuid().optional().or(z.literal("")),
  other_name: z.string().trim().max(120).optional(),
  location: z.string().trim().max(120).optional(),
  takeaway: z.string().trim().max(20000).optional(),
  key_insight: z.string().trim().max(500).optional(),
});
/** Logs a meeting; the optional "Notes / takeaways" become a journal entry linked to it. */
export async function addMeetingLog(_: S, form: FormData): Promise<S> {
  const p = Log.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Check the date and meeting." };
  if (!p.data.meeting_id && !p.data.other_name) return { error: "Pick a Finally Free meeting or name the SA meeting." };
  const me = await getMe();
  if (me && p.data.date > todayIn(me.timezone)) return { error: "That date is in the future — log meetings you've already been to." };
  return done(await callRpc("log_meeting", {
    p_date: p.data.date, p_meeting: p.data.meeting_id || null, p_other: p.data.other_name || null,
    p_location: p.data.location || null, p_counts: form.get("counts_90") === "on",
    p_takeaway: p.data.takeaway || null, p_insight: p.data.key_insight || null, p_share: form.get("shared") === "on",
  }), "Logged.");
}

/** His own 90-in-90 start date (may be before he joined — up to 90 days back). */
export async function setNinetyStart(_: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const date = String(form.get("ninety_start") ?? "");
  const problem = ninetyStartProblem(date, todayIn(me.timezone));
  if (problem) return { error: problem };
  return done(await callRpc("set_ninety_start", { p_date: date }), "Start date saved.");
}

/** Home group, from the 90 in 90 page (Key 2 #10). */
export async function saveHomeGroup(_: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const supabase = await supabaseServer();
  const home = String(form.get("home_group") ?? "").trim().slice(0, 80) || null;
  const { error } = await supabase.from("profiles").update({ home_group: home }).eq("id", me.id);
  revalidatePath("/app", "layout");
  return error ? { error: error.message } : { ok: home ? "Home group saved." : "Home group cleared." };
}

/** A sponsor who isn't in Finally Free — counts once a leader approves it. */
export async function submitOutsideSponsor(_: S, form: FormData): Promise<S> {
  return done(await callRpc("submit_outside_sponsor", {
    p_name: String(form.get("name") ?? ""), p_phone: String(form.get("phone") ?? ""),
    p_email: String(form.get("email") ?? ""), p_notes: String(form.get("notes") ?? ""),
  }), "Sent to your leaders for approval.");
}
export async function endOutsideSponsor(id: string): Promise<S> {
  return done(await callRpc("end_outside_sponsor", { p_id: id }), "Removed.");
}

/** "The Path": commit this week's 3 men. */
export async function commitFishingWeek(): Promise<S> {
  return done(await callRpc("commit_fishing_week"), "Committed. See you at The Path on Monday night.");
}
export async function deleteMeetingLog(id: string): Promise<S> {
  const supabase = await supabaseServer();
  await supabase.from("meeting_logs").delete().eq("id", id);
  revalidatePath("/app/ninety");
  return { ok: "Removed." };
}

export async function addJournal(_: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write something first." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("journal_entries").insert({
    man_id: me.id, body: body.slice(0, 20000), key_insight: String(form.get("key_insight") ?? "").slice(0, 500) || null,
    meeting_id: (form.get("meeting_id") as string) || null, shared_with_mentors: form.get("shared") === "on",
  });
  revalidatePath("/app/journal");
  return error ? { error: error.message } : { ok: "Saved." };
}
export async function toggleJournalShare(id: string, shared: boolean): Promise<S> {
  const supabase = await supabaseServer();
  await supabase.from("journal_entries").update({ shared_with_mentors: shared }).eq("id", id);
  revalidatePath("/app/journal");
  return { ok: "Updated." };
}
export async function deleteJournal(id: string): Promise<S> {
  const supabase = await supabaseServer();
  await supabase.from("journal_entries").delete().eq("id", id);
  revalidatePath("/app/journal");
  return { ok: "Deleted." };
}

export async function saveFishing(slot: number, _: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const name = String(form.get("name") ?? "").trim();
  const supabase = await supabaseServer();
  const ws = weekStart(me.timezone);
  if (!name) {
    await supabase.from("fishing_contacts").delete().match({ man_id: me.id, week_start: ws, slot });
  } else {
    const { error } = await supabase.from("fishing_contacts").upsert({
      man_id: me.id, week_start: ws, slot, name: name.slice(0, 80),
      method: String(form.get("method") ?? "").slice(0, 40) || null, note: String(form.get("note") ?? "").slice(0, 500) || null,
    }, { onConflict: "man_id,week_start,slot" });
    if (error) return { error: error.message };
  }
  revalidatePath("/app", "layout");
  return { ok: "Saved." };
}

// ───────────────────────── panic ─────────────────────────
export async function panic(): Promise<{ error?: string; contacts?: { first_name: string; phone: string | null; signal: string | null }[] }> {
  const r = await callRpc("trigger_panic");
  if (!r.ok) return { error: r.error };
  const ids = (r.data?.events?.[0]?.recipients as string[]) ?? [];
  const supabase = await supabaseServer();
  const { data } = ids.length
    ? await supabase.from("member_contacts").select("first_name, phone, signal").in("id", ids)
    : { data: [] };
  return { contacts: data ?? [] };
}

// ───────────────────────── matching ─────────────────────────
export async function requestMatch(_: S, form: FormData): Promise<S> {
  const type = form.get("type") === "ap" ? "ap" : "sponsor";
  return done(await callRpc("create_match_request", {
    p_type: type, p_timezone: String(form.get("timezone") ?? ""), p_best_times: String(form.get("best_times") ?? "").slice(0, 300),
    p_contact_pref: String(form.get("contact_pref") ?? "").slice(0, 100), p_notes: String(form.get("notes") ?? "").slice(0, 2000),
  }), "Posted to the Sponsor Board. You'll get an email when someone offers.");
}
export async function closeRequest(id: string): Promise<S> { return done(await callRpc("close_match_request", { p_request: id }), "Closed."); }
export async function offerMatch(id: string): Promise<S> { return done(await callRpc("offer_match", { p_request: id }), "Offer sent."); }
export async function acceptOffer(id: string): Promise<S> { return done(await callRpc("accept_offer", { p_offer: id }), "Accepted."); }
export async function endRelationship(id: string): Promise<S> { return done(await callRpc("end_relationship", { p_rel: id }), "Ended."); }

// ───────────────────────── profile & privacy ─────────────────────────
const ProfileForm = z.object({
  first_name: z.string().trim().min(1).max(40),
  display_name: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(30).optional(),
  signal: z.string().trim().max(60).optional(),
  timezone: z.string().trim().max(60),
  city: z.string().trim().max(60).optional(),
  country: z.string().trim().max(60).optional(),
  home_group: z.string().trim().max(80).optional(),
  service_position: z.string().trim().max(120).optional(),
});
export async function saveProfile(_: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const p = ProfileForm.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: p.error.issues[0].message };
  const clean = Object.fromEntries(Object.entries(p.data).map(([k, v]) => [k, v === "" ? null : v]));
  const supabase = await supabaseServer();
  const { error } = await supabase.from("profiles").update(clean).eq("id", me.id);
  revalidatePath("/app", "layout");
  return error ? { error: error.message } : { ok: "Saved." };
}

export async function saveSharing(_: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("contact_sharing").update({
    share_phone: form.get("share_phone") === "on", share_signal: form.get("share_signal") === "on",
    share_city: form.get("share_city") === "on", directory_opt_in: form.get("directory_opt_in") === "on",
    panic_recipients: form.getAll("panic").map(String).filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 20),
  }).eq("profile_id", me.id);
  revalidatePath("/app/profile");
  return error ? { error: error.message } : { ok: "Saved." };
}

export async function saveEmailPrefs(_: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const keys = String(form.get("keys") ?? "").split(",").filter(Boolean);
  const prefs = Object.fromEntries(keys.map((k) => [k, form.get(`pref:${k}`) === "on"]));
  const supabase = await supabaseServer();
  const { error } = await supabase.from("profiles").update({ email_prefs: prefs }).eq("id", me.id);
  return error ? { error: error.message } : { ok: "Saved." };
}

export async function setSobrietyDate(_: S, form: FormData): Promise<S> {
  return done(await callRpc("set_sobriety_date", { p_date: String(form.get("date") ?? "") }), "Day count updated. Keep coming back.");
}

export async function deleteAccount(_: S, form: FormData): Promise<S> {
  if (String(form.get("confirm")) !== "DELETE") return { error: "Type DELETE to confirm." };
  const r = await callRpc("delete_my_account");
  if (!r.ok) return { error: r.error };
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
