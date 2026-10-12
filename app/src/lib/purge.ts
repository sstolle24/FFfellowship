import type { SupabaseClient } from "@supabase/supabase-js";

/** Tables holding a man's own records, removed when his deleted account is purged. */
export const PURGE_TABLES = [
  "submissions", "worksheet_answers", "journal_entries", "video_progress", "meeting_logs",
  "fishing_contacts", "panic_events", "match_requests",
] as const;

/**
 * Permanently removes a deleted account's data (service client only):
 * stored files, his own records, contact fields on the profile, and finally
 * the auth user itself (which cascades the profile row).
 * Returns the number of files removed.
 */
export async function purgeDeletedAccount(db: SupabaseClient, id: string): Promise<number> {
  const { data: files } = await db.from("submissions").select("file_path").eq("man_id", id).not("file_path", "is", null);
  const paths = (files ?? []).map((f) => f.file_path as string);
  if (paths.length) {
    const { error } = await db.storage.from("submissions").remove(paths);
    if (error) throw new Error(`purge ${id}: storage: ${error.message}`);
  }
  for (const t of PURGE_TABLES) {
    const { error } = await db.from(t).delete().eq(t === "match_requests" ? "requester_id" : "man_id", id);
    if (error) throw new Error(`purge ${id}: ${t}: ${error.message}`);
  }
  const { error: pe } = await db.from("profiles").update({ phone: null, signal: null, city: null, email: null }).eq("id", id);
  if (pe) throw new Error(`purge ${id}: profile: ${pe.message}`);
  const { error: ae } = await db.auth.admin.deleteUser(id);
  if (ae) throw new Error(`purge ${id}: auth user: ${ae.message}`);
  return paths.length;
}
