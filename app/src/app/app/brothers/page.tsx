import Link from "next/link";
import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { daysLabel, fmtDate } from "@/lib/time";
import { STAGE_LABEL, type Stage } from "@/lib/types";
import { ActionButton } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { endRelationship } from "../actions";

export const metadata = { title: "My Brothers" };

const LABEL = { ap: "Accountability partner", sponsor: "Sponsor", temp_sponsor: "Temporary sponsor" } as const;

export default async function Brothers() {
  const me = await requireActive();
  const db = await supabaseServer();
  const { data: rels } = await db.from("relationships").select("*").in("status", ["active", "accepted"]).order("started_at");
  const others = (rels ?? []).map((r) => ({ r, other: r.mentor_id === me.id ? r.mentee_id : r.mentor_id }));
  const ids = others.map((o) => o.other);
  const [{ data: cards }, { data: contacts }] = await Promise.all([
    db.from("member_cards").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    db.from("member_contacts").select("*").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <SectionTitle sub="The men you walk with. Talk to your AP every day.">My Brothers</SectionTitle>
      {others.length ? others.map(({ r, other }) => {
        const c = cards?.find((x) => x.id === other);
        const k = contacts?.find((x) => x.id === other);
        const role = r.type === "ap" ? LABEL.ap : r.mentor_id === me.id ? `You are his ${LABEL[r.type as keyof typeof LABEL].toLowerCase()}` : `Your ${LABEL[r.type as keyof typeof LABEL].toLowerCase()}`;
        return (
          <Card key={r.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="display text-lg text-ink">{c?.display_name || c?.first_name || "Brother"}</span>
              <Badge tone="gold">{role}</Badge>
              {r.status === "accepted" && <Badge>Waiting on leader confirmation</Badge>}
            </div>
            {c && <p className="text-sm text-muted">{daysLabel(c.day_count)} · {STAGE_LABEL[c.stage as Stage]}{c.home_group ? ` · ${c.home_group}` : ""} · since {fmtDate(r.started_at ?? r.created_at)}</p>}
            <div className="flex flex-wrap gap-4 text-sm">
              {k?.phone && <a className="text-gold underline" href={`tel:${k.phone.replace(/[^\d+]/g, "")}`}>Call {k.phone}</a>}
              {k?.signal && <span>Signal: {k.signal}</span>}
              {!k?.phone && !k?.signal && <span className="text-muted">He hasn&apos;t shared a phone number in the app — ask him at a meeting.</span>}
            </div>
            <div className="flex gap-3 pt-1">
              {r.mentor_id === me.id && r.type !== "ap" && r.status === "active" && (
                <Link href={`/app/sponsor-desk#${other}`} className="text-sm text-gold underline">His progress</Link>
              )}
              {r.status === "active" && (
                <span className="ml-auto"><ActionButton variant="quiet" run={endRelationship.bind(null, r.id)}
                  confirm="End this relationship? He'll lose access to your program (and you to his) immediately.">End</ActionButton></span>
              )}
            </div>
          </Card>
        );
      }) : <Empty>No AP or sponsor yet. <Link href="/app/sponsor" className="text-gold underline">Find one</Link>.</Empty>}
      <p className="text-xs text-muted">In-app messaging is planned for a later version.</p>
    </div>
  );
}
