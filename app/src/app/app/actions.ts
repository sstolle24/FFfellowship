"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { callRpc } from "@/lib/rpc";
import { getMe } from "@/lib/auth";
import { weekStart } from "@/lib/time";

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
export async function setReadToGroup(spId: string, value: boolean): Promise<S> {
  return done(await callRpc("set_read_to_group", { p_sp: spId, p_value: value }));
}

/** Typed turn-in (no file). */
export async function submitText(spId: string, _: S, form: FormData): Promise<S> {
  const body = String(form.get("body") ?? "").trim();
  if (!body) return { error: "Write something to turn in." };
  return done(await callRpc("add_submission", { p_sp: spId, p_body: body, p_file_path: null }), "Turned in.");
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
  notes: z.string().trim().max(2000).optional(),
});
export async function addMeetingLog(_: S, form: FormData): Promise<S> {
  const me = await getMe();
  if (!me) return { error: "Sign in first." };
  const p = Log.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Check the date and meeting." };
  if (!p.data.meeting_id && !p.data.other_name) return { error: "Pick a Finally Free meeting or name the SA meeting." };
  const supabase = await supabaseServer();
  const { error } = await supabase.from("meeting_logs").insert({
    man_id: me.id, date: p.data.date, meeting_id: p.data.meeting_id || null,
    other_name: p.data.other_name || null, location: p.data.location || null, notes: p.data.notes || null,
    counts_90: form.get("counts_90") === "on",
  });
  revalidatePath("/app", "layout");
  return error ? { error: error.message } : { ok: "Logged." };
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
