import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import type { CommunityEvent } from "@/lib/community";
import { SectionTitle } from "@/components/ui";
import { EventList } from "@/components/EventList";

export const metadata = { title: "What's Happening" };

export default async function Community() {
  await requireUser();
  const { data } = await (await supabaseServer()).from("community_events").select("*");
  return (
    <div className="space-y-6">
      <SectionTitle sub="Events, prayer and service across the Fellowship.">What&apos;s Happening</SectionTitle>
      <EventList events={(data as CommunityEvent[]) ?? []} />
    </div>
  );
}
