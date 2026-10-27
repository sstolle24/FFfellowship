import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { MeetingSchedule } from "@/components/MeetingSchedule";
import { Notice, SectionTitle } from "@/components/ui";

export const metadata = { title: "Meetings" };

export default async function Meetings() {
  const supabase = await supabaseServer();
  // Public view only: name, day, time, tagline, beginner, closed status. No links, IDs or passwords.
  const { data } = await supabase.from("meetings_public").select("id, name, day_of_week, start_time_utc, tagline, beginner, temp_closed, closed_note");
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <SectionTitle sub="Online meetings every day of the week. Newcomers welcome.">Meetings</SectionTitle>
      <div className="mb-8">
        <Notice>
          Meeting links are for members. <Link href="/login" className="text-gold underline">Log in</Link> or{" "}
          <Link href="/get-started" className="text-gold underline">sign up</Link> to get them.
        </Notice>
      </div>
      <MeetingSchedule meetings={data ?? []} />
    </div>
  );
}
