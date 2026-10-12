import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Program } from "@/lib/program";

/** First names for everyone who initialed something in this program (via member_cards). */
export async function initialerNames(db: SupabaseClient, program: Program): Promise<Record<string, string>> {
  const ids = new Set<string>();
  for (const m of program.modules) for (const s of m.steps) {
    if (s.progress?.ap_initial_by) ids.add(s.progress.ap_initial_by);
    if (s.progress?.leader_initial_by) ids.add(s.progress.leader_initial_by);
    if (s.progress?.returned_by) ids.add(s.progress.returned_by);
  }
  return namesFor(db, [...ids]);
}

export async function namesFor(db: SupabaseClient, ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const { data } = await db.from("member_cards").select("id, first_name, display_name").in("id", ids);
  return Object.fromEntries((data ?? []).map((c) => [c.id, c.display_name || c.first_name]));
}
