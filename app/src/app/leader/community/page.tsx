import { requireLeader } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { eventWhen, KIND_LABEL, type CommunityEvent } from "@/lib/community";
import { ActionButton } from "@/components/forms";
import { Badge, Card, Empty, SectionTitle } from "@/components/ui";
import { EventForm } from "@/components/EventForm";
import { deleteEvent } from "../actions";

export const metadata = { title: "What's Happening" };

export default async function CommunityAdmin() {
  const me = await requireLeader();
  const { data } = await (await supabaseServer()).from("community_events").select("*").order("starts_at", { ascending: false, nullsFirst: true });
  const events = (data as CommunityEvent[]) ?? [];
  return (
    <div className="space-y-6">
      <SectionTitle sub="Events, prayer and service. Members see everything; the public site shows items not marked members-only.">What&apos;s Happening</SectionTitle>
      <Card>
        <h2 className="mb-3 text-lg text-gold">Post something</h2>
        <EventForm tz={me.timezone} />
      </Card>
      {events.length ? events.map((e) => (
        <Card key={e.id}>
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-3">
              <Badge tone={e.kind === "prayer" ? "ok" : e.kind === "service" ? "orange" : "gold"}>{KIND_LABEL[e.kind]}</Badge>
              <span className="display min-w-0 flex-1 break-words text-ink">{e.title}</span>
              <span className="text-xs text-muted">{eventWhen(e) ?? "No date"}{e.members_only ? " · members only" : ""}</span>
            </summary>
            <div className="mt-4 space-y-3">
              <EventForm tz={me.timezone} event={e} />
              <ActionButton variant="danger" run={deleteEvent.bind(null, e.id)} confirm={`Remove "${e.title}"?`}>Remove</ActionButton>
            </div>
          </details>
        </Card>
      )) : <Empty>Nothing posted yet.</Empty>}
    </div>
  );
}
