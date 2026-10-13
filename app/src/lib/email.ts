import "server-only";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { supabaseService } from "@/lib/supabase/server";
import { emailLogMeta } from "@/lib/email-meta";

/**
 * Templates. Subjects never contain meeting links, IDs or passwords. Meeting
 * links appear only in emails to active members (account_approved), and only
 * as a link to the member Meetings page — not the Zoom URL itself.
 */
type Vars = Record<string, string | number | undefined>;
type Tpl = { subject: (v: Vars) => string; body: (v: Vars) => string; pref?: string };

const app = (p: string) => `${env.siteUrl}${p}`;

export const TEMPLATES = {
  welcome: {
    subject: () => "Welcome to Finally Free Fellowship",
    body: (v) => `Welcome, ${v.first}.\n\nWe got your sign-up. A leader will review it shortly and you'll get an email when you're approved.\n\nIn the meantime you can sign in to see the meeting schedule: ${app("/app/meetings")}\n\nMeeting links appear there once a leader approves your account.\n\nIf you're struggling right now, don't wait: ${app("/get-help")}`,
  },
  new_signup: {
    subject: (v) => `New sign-up: ${v.first}`,
    body: (v) => `${v.first} just signed up and is waiting for approval.\n\nReview: ${app("/leader/members")}`,
  },
  account_approved: {
    subject: () => "You're approved — welcome to the Fellowship",
    body: (v) => `${v.first}, your account is approved.\n\nYour program starts with Module 0: ${app("/app/program")}\nMeeting links are in the member area: ${app("/app/meetings")}`,
  },
  turn_in_submitted: {
    subject: (v) => `Turn-in from ${v.man}: ${v.step}`,
    body: (v) => `${v.man} turned in work for ${v.step}.\n\n${app(`/leader/men/${v.man_id}`)}`,
  },
  ap_signoff_needed: {
    subject: (v) => `${v.man} needs your AP initials`,
    body: (v) => `${v.man} initialed "${v.step}" and it's waiting for your initials.\n\n${app("/app/sponsor-desk")}`,
  },
  leader_review_needed: {
    subject: (v) => `Ready for leader review: ${v.man} — ${v.step}`,
    body: (v) => `${v.man}'s "${v.step}" is ready for leader initials.\n\n${app("/leader/review")}`,
  },
  approved: {
    subject: (v) => `Approved: ${v.step}`,
    body: (v) => `Good work, ${v.first}. "${v.step}" has been signed off.\n\n${app("/app/program")}`,
    pref: "progress",
  },
  returned: {
    subject: (v) => `Returned with a note: ${v.step}`,
    body: (v) => `${v.first}, "${v.step}" was returned with this note:\n\n"${v.note}"\n\nRevise it and initial again: ${app("/app/program")}`,
  },
  module_unlocked: {
    subject: (v) => `Unlocked: ${v.title}`,
    body: (v) => `${v.first}, ${v.title} is open.${v.module === "key_3_part_1" ? "\n\nYou have 1 Key left before certification." : ""}\n\n${app("/app/program")}`,
    pref: "progress",
  },
  match_requested: {
    subject: (v) => `${v.man} is looking for ${v.kind === "ap" ? "an accountability partner" : "a sponsor"}`,
    body: () => `A brother has posted on the Sponsor Board.\n\n${app("/app/sponsor")}`,
    pref: "sponsor_board",
  },
  match_open_7d: {
    subject: (v) => `${v.man}'s ${v.kind} request has been open 7 days`,
    body: () => `This request still needs a match.\n\n${app("/leader/matching")}`,
  },
  offer_received: {
    subject: (v) => `${v.mentor} offered to be your ${v.kind === "ap" ? "AP" : "sponsor"}`,
    body: (v) => `${v.first}, ${v.mentor} offered to walk with you. Accept it here: ${app("/app/sponsor")}`,
  },
  match_needs_leader: {
    subject: (v) => `Confirm sponsor match: ${v.mentor} → ${v.man}`,
    body: () => `A sponsor match is waiting for a leader's confirmation.\n\n${app("/leader/matching")}`,
  },
  match_confirmed: {
    subject: (v) => `Match confirmed: ${v.mentor} & ${v.man}`,
    body: (v) => `${v.mentor} is now ${v.man}'s ${v.kind === "ap" ? "accountability partner" : "sponsor"}. Reach out today.\n\n${app("/app/brothers")}`,
  },
  inactive_3d: {
    subject: (v) => `${v.first}, we haven't seen you in a few days`,
    body: (v) => `${v.first}, it's been 3 days since you checked in. Make a call, hit a meeting, and log it.\n\n${app("/app")}`,
    pref: "inactivity",
  },
  inactive_3d_mentor: {
    subject: (v) => `Check on ${v.man} — 3 days quiet`,
    body: (v) => `${v.man} hasn't been active for 3 days. Give him a call.`,
    pref: "inactivity",
  },
  inactive_7d_leader: {
    subject: (v) => `${v.man} has been inactive 7 days`,
    body: (v) => `${app(`/leader/men/${v.man_id}`)}`,
  },
  day75_no_sponsor: {
    subject: (v) => `${v.man} is at day 75 with no sponsor`,
    body: (v) => `Key 2 #18 is due at 90 days. ${app(`/leader/men/${v.man_id}`)}`,
  },
  sobriety_milestone: {
    subject: (v) => `${v.days} days, ${v.first}!`,
    body: (v) => `${v.first}, today is ${v.days} days. Thank God and tell your brothers.`,
    pref: "milestones",
  },
  ninety_complete: {
    subject: () => "90 in 90 — done",
    body: (v) => `${v.first}, you've logged 90 meetings. That is a foundation.`,
    pref: "milestones",
  },
  detox21_certified: {
    subject: () => "Detox-21 certified",
    body: (v) => `${v.first}, all 21 are signed off. Key 3 is open — you have 1 Key left before certification.\n\n${app("/app/program")}`,
  },
  keys_complete: {
    subject: () => "All 3 Keys complete",
    body: (v) => `${v.first}, your packet is ready for certification review.\n\n${app("/app/program")}`,
  },
  fellowship_certified: {
    subject: () => "Fellowship certified",
    body: (v) => `${v.first}, you are Finally Free Fellowship certified. Now go certify another.`,
  },
  certified_another: {
    subject: () => "You certified another brother",
    body: (v) => `${v.first}, a man you sponsored is now certified.`,
  },
  ministry_eligible: {
    subject: () => "You're ministry eligible",
    body: (v) => `${v.first}, you've been certified and you've certified another. A leader will reach out about ministry.`,
  },
  panic_alert: {
    subject: (v) => `URGENT: ${v.man} needs a call now`,
    body: (v) => `${v.man} just pressed the Panic Button. Call or Signal him right now.${v.phone ? `\n\nPhone: ${v.phone}` : ""}`,
  },
  weekly_member_summary: {
    subject: () => "Your week in the Fellowship",
    body: (v) => `${v.first}, this week:\n\nDay count: ${v.days}\nMeetings logged: ${v.meetings}\n90 in 90: ${v.ninety}/90\nFishing: ${v.fishing}/3\nNext step: ${v.next}\n\n${app("/app")}`,
    pref: "weekly_summary",
  },
  weekly_leader_digest: {
    subject: () => "Leader digest",
    body: (v) => `Pending sign-ups: ${v.pending}\nWaiting for leader review: ${v.review}\nOpen match requests: ${v.matches}\nInactive 7+ days: ${v.inactive}\nPanic alerts this week: ${v.panic}\n\n${app("/leader")}`,
    pref: "weekly_digest",
  },
} satisfies Record<string, Tpl>;

export type TemplateName = keyof typeof TEMPLATES;

/** Optional emails a man can switch off in Profile & Privacy. Everything else always sends. */
export const OPTIONAL_PREFS: Record<string, string> = {
  progress: "Approvals and newly unlocked modules",
  milestones: "Sobriety and 90-in-90 milestones",
  inactivity: "Inactivity nudges",
  weekly_summary: "Sunday weekly summary",
  sponsor_board: "New Sponsor Board requests (AP/sponsors)",
  weekly_digest: "Monday leader digest (leaders)",
};

function html(text: string) {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const linked = esc.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#2f5d8a">$1</a>');
  return `<div style="background:#0b1426;padding:24px;font-family:Georgia,serif;color:#e8e4da">
<img src="${env.siteUrl}/brand/ff-logo.png" alt="Finally Free" height="48" style="display:block;height:48px;width:auto;margin-bottom:16px;border:0">
<div style="white-space:pre-wrap;line-height:1.6">${linked}</div>
<div style="margin-top:24px;font-size:12px;color:#9aa3b5">Finally Free Fellowship · <a href="${env.siteUrl}/app/profile" style="color:#9aa3b5">email settings</a></div></div>`;
}

/**
 * Sends one templated email to a profile, honouring his email preferences,
 * and records it in email_log. `dedupeKey` prevents repeats (e.g. one
 * inactivity nudge per quiet streak).
 */
export async function sendTemplate(
  toId: string,
  template: TemplateName,
  vars: Vars = {},
  opts: { dedupeKey?: string; stepId?: string } = {},
) {
  const db = supabaseService();
  const { data: p } = await db.from("profiles").select("email, first_name, email_prefs, deleted_at, status").eq("id", toId).single();
  if (!p || p.deleted_at || !p.email) return false;
  const tpl: Tpl = TEMPLATES[template];
  if (tpl.pref && p.email_prefs?.[tpl.pref] === false) return false;

  if (opts.dedupeKey) {
    const { count } = await db.from("email_log").select("id", { count: "exact", head: true })
      .eq("to_id", toId).eq("template", template).eq("meta->>dedupe", opts.dedupeKey);
    if (count) return false;
  }

  const v = { first: p.first_name, ...vars };
  const subject = tpl.subject(v);
  const text = tpl.body(v);
  const key = env.resendKey();
  if (key) {
    const { error } = await new Resend(key).emails.send({ from: env.emailFrom(), to: p.email, subject, text, html: html(text) });
    if (error) {
      console.error("email failed", template, error.message);
      return false;
    }
  } else {
    console.info(`[email:dev] → ${p.email} | ${subject}`);
  }
  await db.from("email_log").insert({ to_id: toId, template, meta: emailLogMeta(template, opts) });
  return true;
}
