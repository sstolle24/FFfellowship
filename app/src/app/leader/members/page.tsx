import Link from "next/link";
import { requireLeader } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { fmtDate } from "@/lib/time";
import { ROLE_LABEL, STAGE_LABEL, type Profile, type Role } from "@/lib/types";
import { ActionForm, Submit } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { approveMember, denyMember, setRole } from "../actions";

export const metadata = { title: "Members & Roles" };

export default async function Members() {
  const me = await requireLeader();
  const db = await supabaseServer();
  const [{ data: all }, { data: intakes }] = await Promise.all([
    db.from("profiles").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
    db.from("profile_intake").select("*"),
  ]);
  const people = (all as Profile[]) ?? [];
  const pending = people.filter((p) => p.status === "pending");
  const leaders = people.filter((p) => ["leader", "admin"].includes(p.role) && p.status === "active");
  const admin = me.role === "admin";

  return (
    <div className="space-y-8">
      <SectionTitle sub={admin ? "Approve sign-ups and manage roles." : "Approve sign-ups. Only an admin can change roles."}>Members &amp; Roles</SectionTitle>

      <section>
        <h2 className="mb-2 text-lg text-gold">Waiting for approval ({pending.length})</h2>
        {pending.length ? <div className="grid gap-3 lg:grid-cols-2">{pending.map((p) => (
          <Card key={p.id} className="space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="display text-base">{p.first_name}</span>
              <span className="text-muted">{p.email} · {p.city ? `${p.city}, ` : ""}{p.country ?? ""} · {p.timezone}</span>
              <span className="ml-auto text-xs text-muted">Signed up {fmtDate(p.created_at)}</span>
            </div>
            <p className="whitespace-pre-line text-muted">{intakes?.find((i) => i.profile_id === p.id)?.intake_reason || "No intake reason given."}</p>
            <p className="text-xs text-muted">Heard about us: {p.heard_about || "—"}</p>
            <ActionForm action={approveMember.bind(null, p.id)} className="flex flex-wrap items-end gap-2">
              <div>
                <label className="lbl" htmlFor={`l-${p.id}`}>Primary leader</label>
                <select id={`l-${p.id}`} name="leader" defaultValue={me.id} className="field">
                  {leaders.map((l) => <option key={l.id} value={l.id}>{l.first_name}</option>)}
                </select>
              </div>
              <Submit>Approve</Submit>
            </ActionForm>
            <details className="border-t border-line/60 pt-2">
              <summary className="cursor-pointer text-sm text-muted hover:text-danger">Deny this sign-up</summary>
              <ActionForm action={denyMember.bind(null, p.id)} className="mt-2 space-y-2">
                <label className="lbl" htmlFor={`d-${p.id}`}>Reason (optional, leaders only)</label>
                <input id={`d-${p.id}`} name="reason" className="field" maxLength={500} placeholder="e.g. spam sign-up, not a man, duplicate account" />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="notify" className="accent-gold" /> Email him a short note that he wasn&apos;t approved
                </label>
                <Submit variant="danger" confirm={`Deny ${p.first_name}'s sign-up? His account is closed and removed.`}>Deny</Submit>
              </ActionForm>
            </details>
          </Card>
        ))}</div> : <Empty>No one waiting.</Empty>}
      </section>

      <section>
        <h2 className="mb-2 text-lg text-gold">Everyone</h2>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-navy-2 text-left text-xs uppercase tracking-wider text-muted">
              <tr><th className="p-2">Name</th><th className="p-2">Status</th><th className="p-2">Stage</th><th className="p-2">Role</th></tr>
            </thead>
            <tbody>
              {people.filter((p) => p.status !== "pending").map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="p-2"><Link href={`/leader/men/${p.id}`} className="hover:text-gold">{p.display_name || p.first_name}</Link></td>
                  <td className="p-2"><Badge tone={p.status === "active" ? "ok" : "muted"}>{p.status}</Badge></td>
                  <td className="p-2 text-muted">{STAGE_LABEL[p.stage]}</td>
                  <td className="p-2">
                    {admin ? (
                      <ActionForm action={setRole.bind(null, p.id)} className="flex items-center gap-2">
                        <select name="role" defaultValue={p.role} className="field max-w-40 py-1">
                          {(["newcomer", "ap_sponsor", "leader", "admin"] as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                        </select>
                        <Submit variant="ghost" className="px-2 py-1">Save</Submit>
                      </ActionForm>
                    ) : ROLE_LABEL[p.role]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
