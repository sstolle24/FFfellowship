import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/program";
import { initialerNames } from "@/lib/names";
import { ProgramView } from "@/components/ProgramView";
import { ProgramSummary } from "@/components/ProgramSummary";
import { ninetyCount, ninetyStart } from "@/lib/ninety";
import { SectionTitle } from "@/components/ui";

export const metadata = { title: "My Program" };

export default async function MyProgram() {
  const me = await requireActive();
  const supabase = await supabaseServer();
  const program = await loadProgram(supabase, me.id, { links: true });
  const names = await initialerNames(supabase, program);
  const [{ data: closing }, { data: logs }] = await Promise.all([
    supabase.from("app_settings").select("value").eq("key", "key2_closing").maybeSingle(),
    supabase.from("meeting_logs").select("date").eq("man_id", me.id).eq("counts_90", true),
  ]);
  const ninety = ninetyCount(logs ?? [], ninetyStart(me));
  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-8">
      <div className="min-w-0">
        <SectionTitle sub="Module 0 → Key 1 → Key 2 “The 21” → Key 3 → Certification. Tap an item to work on it.">
          My Program
        </SectionTitle>
        <ProgramView man={me} program={program} names={names} self key2Closing={closing?.value as string | undefined} />
      </div>
      {/* xl only — smaller screens keep the single column they have today. */}
      <aside className="hidden xl:sticky xl:top-8 xl:block" aria-label="Program summary">
        <ProgramSummary man={me} program={program} ninety={ninety} />
      </aside>
    </div>
  );
}
