import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CommunityEvent } from "@/lib/community";

/**
 * Short-lived links (3 hours) to uploaded What's Happening videos, made with the
 * viewer's own session: storage only signs a video he's allowed to see.
 */
export async function eventVideoLinks(db: SupabaseClient, events: CommunityEvent[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(events.filter((e) => e.video_path).map(async (e) => {
    const { data } = await db.storage.from("community-video").createSignedUrl(e.video_path!, 3 * 3600);
    if (data?.signedUrl) out[e.id] = data.signedUrl;
  }));
  return out;
}
