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
