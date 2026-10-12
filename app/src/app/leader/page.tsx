import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { dayCount, daysBetween, daysLabel, relDays, todayIn } from "@/lib/time";
import { STAGE_LABEL, type Profile, type Stage } from "@/lib/types";
import { Badge, SectionTitle } from "@/components/ui";

export const metadata = { title: "Pipeline" };
const STAGES: Stage[] = ["module_0", "key_1", "key_2", "key_3", "certification_review", "certified", "ministry_eligible"];

export default async function Pipeline() {
  const db = await supabaseServer();
  const [{ data: men }, { data: rels }, { count: pending }] = await Promise.all([
    db.from("profiles").select("*").eq("status", "active").is("deleted_at", null).order("first_name"),
    db.from("relationships").select("mentor_id, mentee_id, type, mutual").eq("status", "active"),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
  ]);
  const hasSponsor = (id: string) => (rels ?? []).some((r) => r.mentee_id === id && r.type !== "ap");
  const hasAp = (id: string) => (rels ?? []).some((r) => r.type === "ap" && (r.mentee_id === id || r.mentor_id === id));

  return (
    <div>
      <SectionTitle sub={pending ? <Link href="/leader/members" className="text-gold underline">{pending} sign-up{pending > 1 ? "s" : ""} waiting for approval →</Link> : "Every active man, by stage."}>
        Pipeline
      </SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {STAGES.map((st) => {
          const col = ((men as Profile[]) ?? []).filter((m) => m.stage === st);
          return (
            <section key={st} aria-labelledby={`stage-${st}`} className="min-w-0 rounded-xl border border-line bg-navy-2/60 p-3">
              <header className="mb-3 flex items-start justify-between gap-2 border-b border-line/60 pb-2">
                <h2 id={`stage-${st}`} className="text-base leading-snug text-gold">{STAGE_LABEL[st]}</h2>
                <Badge tone={col.length ? "gold" : "muted"}>{col.length}</Badge>
              </header>
              <div className="space-y-2">
                {!col.length && <p className="text-xs italic text-muted">Nobody here right now.</p>}
                {col.map((m) => {
                  const quiet = relDays(m.last_active_at) ?? 0;
                  const days = dayCount(m.sobriety_start_date, m.timezone);
                  return (
                    <Link key={m.id} href={`/leader/men/${m.id}`} className="block rounded-lg border border-line bg-panel p-3 text-sm hover:border-gold">
                      <div className="display text-ink">{m.display_name || m.first_name}</div>
                      <div className="mt-1 text-xs text-muted">{daysLabel(days)}{m.role !== "newcomer" ? ` · ${m.role.replace("_", "/")}` : ""}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {!hasAp(m.id) && <Badge tone="orange">No AP</Badge>}
                        {!hasSponsor(m.id) && m.program_start_date && daysBetween(m.program_start_date, todayIn(m.timezone)) >= 75 && <Badge tone="danger">No sponsor (day 75+)</Badge>}
                        {quiet >= 7 ? <Badge tone="danger">Quiet {quiet}d</Badge> : quiet >= 3 ? <Badge tone="orange">Quiet {quiet}d</Badge> : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
