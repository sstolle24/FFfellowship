import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/program";
import { initialerNames } from "@/lib/names";
import { ProgramView } from "@/components/ProgramView";
import { SectionTitle } from "@/components/ui";

export const metadata = { title: "My Program" };

export default async function MyProgram() {
  const me = await requireActive();
  const supabase = await supabaseServer();
  const program = await loadProgram(supabase, me.id, { links: true });
  const names = await initialerNames(supabase, program);
  const { data: closing } = await supabase.from("app_settings").select("value").eq("key", "key2_closing").maybeSingle();
  return (
    <div className="max-w-4xl">
      <SectionTitle sub="Module 0 → Key 1 → Key 2 “The 21” → Key 3 → Certification. Tap an item to work on it.">
        My Program
      </SectionTitle>
      <ProgramView man={me} program={program} names={names} self key2Closing={closing?.value as string | undefined} />
    </div>
  );
}
