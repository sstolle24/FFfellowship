import { eventWhen, googleCalendarUrl, KIND_LABEL, type CommunityEvent } from "@/lib/community";
import { Badge, Card, Empty } from "@/components/ui";

/** Upcoming events and service (soonest first), then prayer (newest first). */
export function EventList({ events }: { events: CommunityEvent[] }) {
  const now = Date.now() - 3 * 3_600_000; // still listed for a few hours after it starts
  const upcoming = events.filter((e) => e.kind !== "prayer" && (!e.starts_at || new Date(e.ends_at ?? e.starts_at).getTime() >= now))
    .sort((a, b) => (a.starts_at ?? "9999").localeCompare(b.starts_at ?? "9999"));
  const prayer = events.filter((e) => e.kind === "prayer").sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg text-gold">Coming up</h2>
        {upcoming.length ? <div className="space-y-3">{upcoming.map((e) => <EventCard key={e.id} e={e} />)}</div>
          : <Empty>Nothing on the calendar right now. Check back soon.</Empty>}
      </section>
      {prayer.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg text-gold">Prayer</h2>
          <div className="space-y-3">{prayer.map((e) => <EventCard key={e.id} e={e} />)}</div>
        </section>
      )}
    </div>
  );
}

function EventCard({ e }: { e: CommunityEvent }) {
  const when = eventWhen(e);
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={e.kind === "prayer" ? "ok" : e.kind === "service" ? "orange" : "gold"}>{KIND_LABEL[e.kind]}</Badge>
        {e.members_only && <Badge>Members</Badge>}
        <h3 className="display min-w-0 basis-full break-words text-lg text-ink sm:basis-auto">{e.title}</h3>
      </div>
      {(when || e.location) && <p className="text-sm font-semibold text-ink">{[when, e.location].filter(Boolean).join(" · ")}</p>}
      {e.body && <p className="whitespace-pre-line text-sm text-muted">{e.body}</p>}
      <div className="flex flex-wrap gap-3 text-sm">
        {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-gold underline">More info / join</a>}
        {e.starts_at && <a href={`/api/events/${e.id}/ics`} className="text-gold underline">Add to calendar</a>}
        {e.starts_at && <a href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer" className="text-gold underline">Google Calendar</a>}
      </div>
    </Card>
  );
}
