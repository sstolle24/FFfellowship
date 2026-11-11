import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import type { CommunityEvent } from "@/lib/community";
import { SectionTitle } from "@/components/ui";
import { EventList } from "@/components/EventList";
import { eventVideoLinks } from "@/lib/event-video";

export const metadata = { title: "What's Happening" };

export default async function WhatsHappening() {
  // Public items only (members-only ones are filtered by RLS for visitors).
  const db = await supabaseServer();
  const { data } = await db.from("community_events").select("*");
  const videoUrls = await eventVideoLinks(db, (data as CommunityEvent[]) ?? []);
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-12">
      <SectionTitle sub="Events, prayer and service across the Fellowship. Newcomers welcome.">What&apos;s Happening</SectionTitle>
      <EventList events={(data as CommunityEvent[]) ?? []} videoUrls={videoUrls} />
      <p className="text-sm text-muted">Members see more inside the app. <Link href="/meetings" className="text-gold underline">See the meeting schedule</Link>.</p>
    </div>
  );
}
