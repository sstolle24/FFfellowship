import Link from "next/link";
import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { relDays } from "@/lib/time";
import { STAGE_LABEL, type Stage } from "@/lib/types";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";

export const metadata = { title: "Sponsor Desk" };

/** Every man this AP/sponsor walks with: progress, inactivity, and his AP sign-off queue. */
export default async function SponsorDesk() {
  await requireActive();
  const db = await supabaseServer();
  const { data: men } = await db.from("my_men").select("*").order("first_name");
  const ids = (men ?? []).map((m) => m.id);
  const none = ["00000000-0000-0000-0000-000000000000"];
  const [{ data: prog }, { data: steps }] = await Promise.all([
    db.from("step_progress").select("id, man_id, step_id, status, self_initialed_at").in("man_id", ids.length ? ids : none),
    db.from("program_steps").select("id, title, item_number, gate_type, module_id, program_modules(key)"),
  ]);
  const stepBy = new Map((steps ?? []).map((s) => [s.id, s]));
  const queue = (prog ?? []).filter((p) => {
    const s = stepBy.get(p.step_id);
    return p.status === "self_initialed" && s && ["self_ap", "triple"].includes(s.gate_type);
  }).sort((a, b) => (a.self_initialed_at ?? "").localeCompare(b.self_initialed_at ?? ""));
  const name = (id: string) => men?.find((m) => m.id === id)?.first_name ?? "";
  const k2 = (id: string) => (prog ?? []).filter((p) => p.man_id === id && p.status === "leader_initialed"
    && (stepBy.get(p.step_id)?.program_modules as unknown as { key: string } | null)?.key === "key_2").length;

  return (
    <div className="max-w-4xl space-y-8">
      <SectionTitle sub="Your men, their progress, and the items waiting on your AP initials.">Sponsor Desk</SectionTitle>

      <section>
        <h2 className="mb-3 text-lg text-gold">Waiting on your initials ({queue.length})</h2>
        {queue.length ? (
          <div className="space-y-2">
            {queue.map((p) => {
              const s = stepBy.get(p.step_id)!;
              return (
                <Link key={p.id} href={`/app/step/${p.id}`} className="block">
                  <Card className="flex flex-wrap items-center gap-3 p-3 hover:border-gold">
                    <span className="display">{name(p.man_id)}</span>
                    <span className="flex-1">{s.item_number ? `#${s.item_number} ` : ""}{s.title}</span>
                    <span className="text-xs text-muted">{relDays(p.self_initialed_at)}d ago</span>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : <Empty>Nothing waiting. Call your men anyway.</Empty>}
      </section>

      <section>
        <h2 className="mb-3 text-lg text-gold">Your men</h2>
        {men?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {men.map((m) => {
              const quiet = relDays(m.last_active_at) ?? 0;
              return (
                <Card key={m.id} id={m.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="display text-lg">{m.display_name || m.first_name}</span>
                    {(m.my_roles ?? "").split(",").map((r: string) => <Badge key={r} tone="gold">{r === "ap" ? "AP" : r.replace("_", " ")}</Badge>)}
                    {quiet >= 3 && <Badge tone={quiet >= 7 ? "danger" : "orange"}>Quiet {quiet} days</Badge>}
                  </div>
                  <p className="text-sm text-muted">{m.day_count ?? "?"} days · {STAGE_LABEL[m.stage as Stage]} · Key 2: {k2(m.id)}/21</p>
                  <Link href={`/app/men/${m.id}`} className="text-sm text-gold underline">Open his program</Link>
                </Card>
              );
            })}
          </div>
        ) : <Empty>You&apos;re not anyone&apos;s AP or sponsor yet. Check the <Link href="/app/sponsor" className="text-gold underline">Sponsor Board</Link>.</Empty>}
      </section>
    </div>
  );
}
