import "server-only";
import { supabaseService } from "@/lib/supabase/server";
import { sendTemplate, type TemplateName } from "@/lib/email";
import type { RpcEvent } from "@/lib/types";

/** Who to notify, resolved with the service client (no user session involved). */
async function mentorsOf(man: string): Promise<string[]> {
  const db = supabaseService();
  const { data } = await db.from("relationships").select("mentor_id, mentee_id, type, mutual")
    .eq("status", "active").or(`mentee_id.eq.${man},and(mentor_id.eq.${man},mutual.eq.true)`);
  return [...new Set((data ?? []).map((r) => (r.mentee_id === man ? r.mentor_id : r.mentee_id)))];
}
async function sponsorsOf(man: string): Promise<string[]> {
  const db = supabaseService();
  const { data } = await db.from("relationships").select("mentor_id")
    .eq("status", "active").eq("mentee_id", man).in("type", ["sponsor", "temp_sponsor"]);
  return (data ?? []).map((r) => r.mentor_id);
}
async function leadersFor(man?: string): Promise<string[]> {
  const db = supabaseService();
  if (man) {
    const { data } = await db.from("profiles").select("primary_leader_id").eq("id", man).single();
    if (data?.primary_leader_id) return [data.primary_leader_id];
  }
  const { data } = await db.from("profiles").select("id").in("role", ["leader", "admin"]).eq("status", "active");
  return (data ?? []).map((r) => r.id);
}
async function nameOf(id?: unknown): Promise<string> {
  if (typeof id !== "string") return "";
  const { data } = await supabaseService().from("profiles").select("first_name").eq("id", id).single();
  return data?.first_name ?? "";
}

/**
 * Turns the events returned by a gate RPC into emails. Failures are logged,
 * never thrown — an email outage must not undo an approval.
 */
export async function dispatchEvents(events: RpcEvent[] | undefined) {
  if (!events?.length) return;
  for (const e of events) {
    try {
      await handle(e);
    } catch (err) {
      console.error("event dispatch failed", e.type, err);
    }
  }
}

async function handle(e: RpcEvent) {
  const man = e.man_id as string | undefined;
  const send = (to: string[], t: TemplateName, v: Record<string, string | number | undefined> = {}) =>
    Promise.all(to.filter((id) => id && id !== e.actor).map((id) =>
      sendTemplate(id, t, v, { stepId: typeof e.step_id === "string" ? e.step_id : undefined })));
  const manName = await nameOf(man);
  const step = e.item ? `#${e.item} ${e.step}` : (e.step as string | undefined);

  switch (e.type) {
    case "account_approved":
      return send([man!], "account_approved");
    case "turn_in_submitted":
      return send([...(await leadersFor(man)), ...(await sponsorsOf(man!))], "turn_in_submitted", { man: manName, step, man_id: man });
    case "ap_signoff_needed": {
      let to = await mentorsOf(man!);
      if (!to.length) to = await leadersFor(man); // Key 1 fallback: primary leader confirms
      return send(to, "ap_signoff_needed", { man: manName, step });
    }
    case "ap_overridden":
      return send(await mentorsOf(man!), "ap_overridden", { man: manName, leader: await nameOf(e.leader_id), step, reason: e.reason as string });
    case "leader_review_needed":
      return send(await leadersFor(man), "leader_review_needed", { man: manName, step });
    case "approved":
      return send([man!], "approved", { step });
    case "returned":
      return send([man!], "returned", { step, note: e.note as string });
    case "module_unlocked":
      return send([man!], "module_unlocked", { title: e.title as string, module: e.module as string });
    case "match_requested": {
      const { data } = await supabaseService().from("profiles").select("id")
        .in("role", ["ap_sponsor", "leader", "admin"]).eq("status", "active");
      return send((data ?? []).map((r) => r.id).filter((id) => id !== man), "match_requested", { man: manName, kind: e.kind as string });
    }
    case "offer_received":
      return send([man!], "offer_received", { mentor: await nameOf(e.offerer_id), kind: e.kind as string });
    case "match_needs_leader":
      return send(await leadersFor(), "match_needs_leader", { man: manName, mentor: await nameOf(e.mentor_id) });
    case "match_confirmed":
      return send([man!, e.mentor_id as string], "match_confirmed", { man: manName, mentor: await nameOf(e.mentor_id), kind: e.kind as string });
    case "milestone": {
      const m = e.milestone as string;
      if (["detox21_certified", "keys_complete", "fellowship_certified", "certified_another", "ministry_eligible"].includes(m)) {
        await send([man!], m as TemplateName);
        if (m === "keys_complete") await send(await leadersFor(man), "leader_review_needed", { man: manName, step: "Certification packet" });
      }
      return;
    }
    case "outside_sponsor_submitted":
      return send(await leadersFor(man), "outside_sponsor_submitted", { man: manName, man_id: man });
    case "outside_sponsor_reviewed":
      return send([man!], "outside_sponsor_reviewed", { approved: e.approved ? "yes" : "no" });
    case "panic": {
      const { data } = await supabaseService().from("profiles").select("phone, contact_sharing(share_phone)").eq("id", man!).single();
      const cs = data?.contact_sharing as unknown as { share_phone: boolean } | null;
      const phone = cs?.share_phone ? data?.phone ?? undefined : undefined;
      return send((e.recipients as string[]) ?? [], "panic_alert", { man: manName, phone });
    }
  }
}
