import { describe, expect, it } from "vitest";
import { addedLater, countedLogs, ninetyCount, ninetyStart } from "./ninety";

describe("90 in 90 (Steven's feedback)", () => {
  it("counts from his own start date when he set one (paper log began before he joined)", () => {
    expect(ninetyStart({ ninety_start_date: "2026-10-01", program_start_date: "2026-10-14" })).toBe("2026-10-01");
    expect(ninetyStart({ ninety_start_date: null, program_start_date: "2026-10-14" })).toBe("2026-10-14");
    // 25 meetings Oct 1–25: before, only the ones on/after Oct 14 counted (12) — the bug Steven hit.
    const logs = Array.from({ length: 25 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, counts_90: true }));
    expect(ninetyCount(logs, "2026-10-14")).toBe(12);
    expect(ninetyCount(logs, ninetyStart({ ninety_start_date: "2026-10-01", program_start_date: "2026-10-14" }))).toBe(25);
  });

  it("only FF/SA meetings count, and never more than 90", () => {
    const logs = [{ date: "2026-10-02", counts_90: false }, { date: "2026-10-02", counts_90: true }];
    expect(countedLogs(logs, "2026-10-01")).toHaveLength(1);
    expect(ninetyCount(Array.from({ length: 120 }, () => ({ date: "2026-10-05", counts_90: true })), "2026-10-01")).toBe(90);
  });

  it("flags meetings logged more than 3 days after they happened", () => {
    expect(addedLater({ date: "2026-10-01", created_at: "2026-10-27T15:00:00Z" })).toBe(true);
    expect(addedLater({ date: "2026-10-24", created_at: "2026-10-27T15:00:00Z" })).toBe(false); // 3 days: fine
    expect(addedLater({ date: "2026-10-27", created_at: "2026-10-27T15:00:00Z" })).toBe(false);
    expect(addedLater({ date: "2026-10-01" })).toBe(false);
  });
});

describe("90 in 90 start date: plain-English limits (iPad showed 'Value must be ≥ 2026-07-29')", async () => {
  const { earliestNinetyStart, ninetyStartProblem } = await import("./ninety");
  it("allows anything from 90 days back through today", () => {
    expect(earliestNinetyStart("2026-10-27")).toBe("2026-07-29");
    expect(ninetyStartProblem("2026-10-01", "2026-10-27")).toBeNull(); // Steven's real start
    expect(ninetyStartProblem("2026-07-29", "2026-10-27")).toBeNull();
    expect(ninetyStartProblem("2026-10-27", "2026-10-27")).toBeNull();
  });
  it("explains a too-early date with a readable earliest date", () => {
    expect(ninetyStartProblem("2025-12-14", "2026-10-27")).toMatch(/at most 90 days back — the earliest you can pick is Jul 29, 2026/);
  });
  it("refuses future dates and junk", () => {
    expect(ninetyStartProblem("2026-10-28", "2026-10-27")).toMatch(/future/);
    expect(ninetyStartProblem("", "2026-10-27")).toMatch(/Pick the date/);
  });
});

describe("evening 90-in-90 reminder", async () => {
  const { ninetyReminderDue } = await import("./ninety");
  const man = { timezone: "America/Los_Angeles", ninety_start_date: "2026-10-20", program_start_date: "2026-10-01" };
  const at8pm = new Date("2026-11-05T04:00:00Z");   // Wed Nov 4, 8 pm PST
  it("goes out at 8 pm his time when he hasn't logged today", () => {
    expect(ninetyReminderDue(man, [{ date: "2026-11-03" }], at8pm)).toEqual({ day: 16, count: 1, today: "2026-11-04" });
  });
  it("not at other hours, or in another man's evening", () => {
    expect(ninetyReminderDue(man, [], new Date("2026-11-05T03:00:00Z"))).toBeNull(); // 7 pm
    expect(ninetyReminderDue({ ...man, timezone: "America/New_York" }, [], at8pm)).toBeNull(); // 11 pm there
  });
  it("not once he's logged today's meeting", () => {
    expect(ninetyReminderDue(man, [{ date: "2026-11-04" }], at8pm)).toBeNull();
  });
  it("only during his 90 days, and not once he has 90", () => {
    expect(ninetyReminderDue({ ...man, ninety_start_date: "2026-07-01" }, [], at8pm)).toBeNull();   // day 127
    expect(ninetyReminderDue({ ...man, ninety_start_date: "2026-11-05" }, [], at8pm)).toBeNull();   // starts tomorrow
    expect(ninetyReminderDue({ ...man, ninety_start_date: null, program_start_date: null }, [], at8pm)).toBeNull();
    const ninety = Array.from({ length: 90 }, (_, i) => ({ date: `2026-10-${String(20 + (i % 10)).padStart(2, "0")}` }));
    expect(ninetyReminderDue(man, ninety, at8pm)).toBeNull();
  });
  it("falls back to his program start date", () => {
    expect(ninetyReminderDue({ ...man, ninety_start_date: null }, [], at8pm)?.day).toBe(35);
  });
});
