import { describe, it, expect } from "vitest";
import { localSlot, nextOccurrence, daysBetween, addDays } from "./time";

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
});
