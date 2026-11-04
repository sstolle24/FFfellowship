import { describe, it, expect } from "vitest";
import { localSlot, meetingSlot, nextOccurrence, daysBetween, addDays, zonedTime } from "./time";

describe("time", () => {
  it("shows a Monday 00:00 UTC meeting as Sunday evening in Chicago", () => {
    const s = localSlot(1, "00:00", "America/Chicago");
    expect(s.weekday).toBe("Sunday");
    expect(s.time).toMatch(/^(6|7):00 PM C[DS]T$/);
  });
  it("shows the same meeting as Monday morning in Singapore", () => {
    const s = localSlot(1, "00:00", "Asia/Singapore");
    expect(s.weekday).toBe("Monday");
    expect(s.time).toMatch(/^8:00 AM/);
  });
  it("next occurrence is on the right UTC weekday", () => {
    const d = nextOccurrence(4, "13:30", new Date("2026-10-11T12:00:00Z"));
    expect(d.toISOString()).toBe("2026-10-15T13:30:00.000Z");
  });
  it("date math", () => {
    expect(daysBetween("2026-09-01", "2026-10-11")).toBe(40);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("0017: a 5 pm Pacific meeting stays 5 pm Pacific across the clock change", () => {
    const m = { local_day: 0, local_time: "17:00:00", timezone: "America/Los_Angeles" };
    const oct = meetingSlot(m, "America/Los_Angeles", new Date("2026-10-21T12:00:00Z"));
    expect([oct.weekday, oct.time, oct.localDate]).toEqual(["Sunday", "5:00 PM PDT", "2026-10-25"]);
    const nov = meetingSlot(m, "America/Los_Angeles", new Date("2026-11-04T12:00:00Z"));
    expect([nov.weekday, nov.time, nov.localDate]).toEqual(["Sunday", "5:00 PM PST", "2026-11-08"]);
    expect(meetingSlot(m, "America/New_York", new Date("2026-11-04T12:00:00Z")).time).toBe("8:00 PM EST");
    expect(meetingSlot(m, "America/New_York", new Date("2026-10-07T12:00:00Z")).time).toBe("8:00 PM EDT");
    expect(meetingSlot(m, "Asia/Singapore", new Date("2026-11-04T12:00:00Z"))).toMatchObject({ weekday: "Monday", time: "9:00 AM GMT+8" });
  });
  it("0017: meetings in the next 90 minutes still count as this week's", () => {
    const m = { local_day: 3, local_time: "17:00", timezone: "America/Los_Angeles" }; // Wednesday
    expect(meetingSlot(m, "America/Los_Angeles", new Date("2026-11-05T02:00:00Z")).localDate).toBe("2026-11-04"); // 6 pm Wed: just started
    expect(meetingSlot(m, "America/Los_Angeles", new Date("2026-11-05T04:00:00Z")).localDate).toBe("2026-11-11"); // 8 pm Wed: next week
  });
  it("0017: wall-clock to instant on both sides of a DST change", () => {
    expect(zonedTime("2026-11-01", "17:00", "America/Los_Angeles").toISOString()).toBe("2026-11-02T01:00:00.000Z");
    expect(zonedTime("2026-10-31", "17:00", "America/Los_Angeles").toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(zonedTime("2027-03-14", "17:00", "America/Los_Angeles").toISOString()).toBe("2027-03-15T00:00:00.000Z");
  });
});
