import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { CommunityEvent } from "@/lib/community";
import { SectionTitle } from "@/components/ui";
import { EventList } from "@/components/EventList";
import { eventVideoLinks } from "@/lib/event-video";

export const metadata = { title: "What's Happening" };

export default async function Community() {
  await requireUser();
  const db = await supabaseServer();
  const { data } = await db.from("community_events").select("*");
  const videoUrls = await eventVideoLinks(db, (data as CommunityEvent[]) ?? []);
  return (
    <div className="space-y-6">
      <SectionTitle sub="Events, prayer and service across the Fellowship.">What&apos;s Happening</SectionTitle>
      <EventList events={(data as CommunityEvent[]) ?? []} videoUrls={videoUrls} />
    </div>
  );
}
