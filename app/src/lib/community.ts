/** "What's Happening": shared types, date text and calendar links (pure, no server code). */
import { safeTz } from "./time";

export type CommunityEvent = {
  id: string; kind: "event" | "prayer" | "service"; title: string; body: string | null;
  starts_at: string | null; ends_at: string | null; timezone: string; location: string | null; link: string | null;
  members_only: boolean; created_at: string;
};

export const KIND_LABEL: Record<CommunityEvent["kind"], string> = { event: "Event", prayer: "Prayer", service: "Service" };

/** "Sat, Nov 15 · 6:00 PM – 8:00 PM PST", in the item's own time zone. */
export function eventWhen(e: Pick<CommunityEvent, "starts_at" | "ends_at" | "timezone">): string | null {
  if (!e.starts_at) return null;
  const tz = safeTz(e.timezone);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(new Date(e.starts_at));
  const t = (iso: string, zone: boolean) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", ...(zone ? { timeZoneName: "short" } : {}) }).format(new Date(iso));
  return `${day} · ${e.ends_at ? `${t(e.starts_at, false)} – ${t(e.ends_at, true)}` : t(e.starts_at, true)}`;
}

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const end = (e: Pick<CommunityEvent, "starts_at" | "ends_at">) => e.ends_at ?? new Date(new Date(e.starts_at!).getTime() + 3_600_000).toISOString();
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** An .ics file for one dated item (iPhone, Outlook, most calendars). */
export function eventIcs(e: CommunityEvent, siteUrl: string): string {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Finally Free Fellowship//What's Happening//EN", "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT", `UID:${e.id}@finallyfree`, `DTSTAMP:${stamp(e.created_at)}`,
    `DTSTART:${stamp(e.starts_at!)}`, `DTEND:${stamp(end(e))}`, `SUMMARY:${icsText(e.title)}`,
    ...(e.body || e.link ? [`DESCRIPTION:${icsText([e.body, e.link].filter(Boolean).join("\n\n"))}`] : []),
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    `URL:${siteUrl}/whats-happening`, "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}

/** "Add to Google Calendar" link for one dated item. */
export function googleCalendarUrl(e: CommunityEvent): string {
  const q = new URLSearchParams({
    action: "TEMPLATE", text: e.title, dates: `${stamp(e.starts_at!)}/${stamp(end(e))}`,
    details: [e.body, e.link].filter(Boolean).join("\n\n"), location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
