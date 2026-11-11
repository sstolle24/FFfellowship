import { eventWhen, googleCalendarUrl, KIND_LABEL, type CommunityEvent } from "@/lib/community";
import { Badge, Card, Empty } from "@/components/ui";
import { videoEmbedUrl } from "@/lib/video";

/** Upcoming events and service (soonest first), then prayer (newest first). */
/** videoUrls: short-lived links to uploaded videos, made with the viewer's session (only items he can see). */
export function EventList({ events, videoUrls = {} }: { events: CommunityEvent[]; videoUrls?: Record<string, string> }) {
  const now = Date.now() - 3 * 3_600_000; // still listed for a few hours after it starts
  const hasVideo = (e: CommunityEvent) => !!(e.video_path || e.video_url);
  const videos = events.filter(hasVideo).sort((a, b) => (b.starts_at ?? b.created_at).localeCompare(a.starts_at ?? a.created_at));
  const upcoming = events.filter((e) => !hasVideo(e) && e.kind !== "prayer" && (!e.starts_at || new Date(e.ends_at ?? e.starts_at).getTime() >= now))
    .sort((a, b) => (a.starts_at ?? "9999").localeCompare(b.starts_at ?? "9999"));
  const prayer = events.filter((e) => !hasVideo(e) && e.kind === "prayer").sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg text-gold">Coming up</h2>
        {upcoming.length ? <div className="space-y-3">{upcoming.map((e) => <EventCard key={e.id} e={e} video={videoUrls[e.id]} />)}</div>
          : <Empty>Nothing on the calendar right now. Check back soon.</Empty>}
      </section>
      {videos.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg text-gold">Videos</h2>
          <div className="space-y-3">{videos.map((e) => <EventCard key={e.id} e={e} video={videoUrls[e.id]} />)}</div>
        </section>
      )}
      {prayer.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg text-gold">Prayer</h2>
          <div className="space-y-3">{prayer.map((e) => <EventCard key={e.id} e={e} video={videoUrls[e.id]} />)}</div>
        </section>
      )}
    </div>
  );
}

function EventCard({ e, video }: { e: CommunityEvent; video?: string }) {
  const when = eventWhen(e);
  const embed = videoEmbedUrl(e.video_url);
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={e.kind === "prayer" ? "ok" : e.kind === "service" ? "orange" : "gold"}>{KIND_LABEL[e.kind]}</Badge>
        {e.members_only && <Badge>Members</Badge>}
        <h3 className="display min-w-0 basis-full break-words text-lg text-ink sm:basis-auto">{e.title}</h3>
      </div>
      {(when || e.location) && <p className="text-sm font-semibold text-ink">{[when, e.location].filter(Boolean).join(" · ")}</p>}
      {e.body && <p className="whitespace-pre-line text-sm text-muted">{e.body}</p>}
      {video && (
        <video controls playsInline preload="metadata" src={video} className="aspect-video w-full rounded-lg border border-line bg-black">
          Your browser can&apos;t play this video.
        </video>
      )}
      {!video && embed && (
        <iframe src={embed} title={`Video: ${e.title}`} className="aspect-video w-full rounded-lg border border-line" loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        {e.link && <a href={e.link} target="_blank" rel="noopener noreferrer" className="text-gold underline">More info / join</a>}
        {e.starts_at && <a href={`/api/events/${e.id}/ics`} className="text-gold underline">Add to calendar</a>}
        {e.starts_at && <a href={googleCalendarUrl(e)} target="_blank" rel="noopener noreferrer" className="text-gold underline">Google Calendar</a>}
      </div>
    </Card>
  );
}
