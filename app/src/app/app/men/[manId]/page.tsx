import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireActive, isLeader } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/program";
import { daysLabel } from "@/lib/time";
import { initialerNames } from "@/lib/names";
import { ProgramView } from "@/components/ProgramView";
import { SectionTitle } from "@/components/ui";
import type { Profile } from "@/lib/types";

export const metadata = { title: "His program" };

/** An AP/sponsor's read-only view of one of his men. RLS returns nothing for anyone else. */
export default async function ManProgram({ params }: { params: Promise<{ manId: string }> }) {
  const { manId } = await params;
  const me = await requireActive();
  if (manId === me.id) redirect("/app/program");
  if (isLeader(me)) redirect(`/leader/men/${manId}`);
  const db = await supabaseServer();
  const { data: man } = await db.from("my_men").select("*").eq("id", manId).maybeSingle();
  if (!man) notFound();
  const program = await loadProgram(db, manId);
  const names = await initialerNames(db, program);
  return (
    <div className="max-w-4xl">
      <Link href="/app/sponsor-desk" className="text-sm text-muted hover:text-gold">← Sponsor Desk</Link>
      <SectionTitle sub={daysLabel(man.day_count)}>{man.display_name || man.first_name}&apos;s program</SectionTitle>
      <ProgramView man={man as unknown as Profile} program={program} names={names} self={false} />
    </div>
  );
}
