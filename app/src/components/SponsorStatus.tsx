import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { namesFor } from "@/lib/names";
import { ActionButton, ActionForm, Submit } from "@/components/forms";
import { Badge, Card } from "@/components/ui";
import { endOutsideSponsor, submitOutsideSponsor } from "@/app/app/actions";

/**
 * His sponsor (Key 2 #18): an FF sponsor, or one from outside Finally Free that
 * a leader approves as an exception. Shown on 90 in 90 and Find a Sponsor.
 */
export async function SponsorStatus({ manId }: { manId: string }) {
  const db = await supabaseServer();
  const [{ data: rels }, { data: outside }] = await Promise.all([
    db.from("relationships").select("mentor_id, type").eq("status", "active").eq("mentee_id", manId).in("type", ["sponsor", "temp_sponsor"]),
    db.from("outside_sponsors").select("*").eq("man_id", manId).in("status", ["pending", "approved", "declined"]).order("created_at", { ascending: false }),
  ]);
  const names = await namesFor(db, (rels ?? []).map((r) => r.mentor_id));
  const open = (outside ?? []).find((o) => o.status !== "declined");
  const declined = !open ? (outside ?? []).find((o) => o.status === "declined") : null;

  return (
    <Card className="space-y-3">
      <h2 className="text-lg text-gold">Sponsor</h2>
      {(rels ?? []).map((r) => (
        <p key={r.mentor_id} className="text-sm">{names[r.mentor_id] ?? "Your sponsor"} <Badge tone="ok">{r.type === "temp_sponsor" ? "Temporary sponsor" : "FF sponsor"}</Badge></p>
      ))}
      {open && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span>{open.name}{open.phone && <span className="text-muted"> · {open.phone}</span>}</span>
          {open.status === "approved"
            ? <Badge tone="ok">Outside FF · approved</Badge>
            : <Badge tone="gold">Outside FF · waiting for a leader</Badge>}
          <span className="ml-auto"><ActionButton variant="quiet" run={endOutsideSponsor.bind(null, open.id)} confirm="Remove this sponsor from your record?">Remove</ActionButton></span>
        </div>
      )}
      {declined && <p className="text-sm text-orange">A leader didn&apos;t approve {declined.name}{declined.review_note ? `: ${declined.review_note}` : "."}</p>}
      {!(rels ?? []).length && !open && (
        <p className="text-sm text-muted">
          Still looking? Key 2 #18 asks for a sponsor or temporary sponsor by day 90. <Link href="/app/sponsor" className="text-gold underline">Find one in the Fellowship</Link>.
        </p>
      )}
      {!open && (
        <details className="rounded-lg border border-line p-3 text-sm">
          <summary className="cursor-pointer text-muted">My sponsor isn&apos;t in Finally Free</summary>
          <ActionForm action={submitOutsideSponsor} resetOnOk className="mt-3 grid gap-3 sm:grid-cols-2">
            <div><label className="lbl" htmlFor="os-name">Sponsor&apos;s name</label><input id="os-name" name="name" required maxLength={80} className="field" /></div>
            <div><label className="lbl" htmlFor="os-phone">Phone (optional)</label><input id="os-phone" name="phone" maxLength={30} className="field" autoComplete="off" /></div>
            <div><label className="lbl" htmlFor="os-email">Email (optional)</label><input id="os-email" name="email" type="email" maxLength={120} className="field" autoComplete="off" /></div>
            <div><label className="lbl" htmlFor="os-notes">Program / how long (optional)</label><input id="os-notes" name="notes" maxLength={1000} className="field" placeholder="e.g. SA sponsor, 9 years sober" /></div>
            <p className="text-xs text-muted sm:col-span-2">Only you and leaders see these details. It counts once a leader approves it.</p>
            <div className="sm:col-span-2"><Submit variant="ghost">Send for approval</Submit></div>
          </ActionForm>
        </details>
      )}
    </Card>
  );
}
