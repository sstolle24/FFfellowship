import { describe, expect, it } from "vitest";
import { eventIcs, eventWhen, googleCalendarUrl, type CommunityEvent } from "./community";

const e: CommunityEvent = {
  id: "e1", kind: "event", title: "Men's retreat, day 1", body: "Bring a Bible; dinner provided", starts_at: "2026-11-15T02:00:00Z",
  ends_at: "2026-11-15T04:00:00Z", timezone: "America/Los_Angeles", location: "Church hall", link: null, members_only: false,
  created_at: "2026-11-04T10:00:00Z",
};

describe("What's Happening dates and calendar links", () => {
  it("shows the time in the item's own zone", () => {
    expect(eventWhen(e)).toBe("Sat, Nov 14 · 6:00 PM – 8:00 PM PST");
    expect(eventWhen({ ...e, ends_at: null })).toBe("Sat, Nov 14 · 6:00 PM PST");
    expect(eventWhen({ ...e, starts_at: null, ends_at: null })).toBeNull();
  });
  it("makes a valid .ics with escaped text", () => {
    const ics = eventIcs(e, "https://example.org");
    expect(ics).toContain("DTSTART:20261115T020000Z\r\nDTEND:20261115T040000Z");
    expect(ics).toContain("SUMMARY:Men's retreat\\, day 1");
    expect(ics).toContain("DESCRIPTION:Bring a Bible\; dinner provided");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(eventIcs({ ...e, ends_at: null }, "x")).toContain("DTEND:20261115T030000Z"); // 1 hour by default
  });
  it("makes a Google Calendar link", () => {
    expect(googleCalendarUrl(e)).toContain("dates=20261115T020000Z%2F20261115T040000Z");
  });
});
