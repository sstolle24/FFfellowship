import { describe, expect, it } from "vitest";
import { programBadges, stageBadge, timeClean, timeCoins } from "./badges";

describe("badges", () => {
  it("program badges from his progress and milestones", () => {
    const b = programBadges({ key1Done: true, key2Done: false, key3Done: false, milestones: [{ type: "detox21_certified" }] });
    expect(b.map((x) => [x.id, x.earned])).toEqual([["key1", true], ["key2", true], ["key3", false], ["certified", false], ["ministry", false]]);
    const all = programBadges({ key1Done: true, key2Done: true, key3Done: false,
      milestones: [{ type: "keys_complete" }, { type: "fellowship_certified" }, { type: "ministry_eligible" }] });
    expect(all.every((x) => x.earned)).toBe(true);
  });
  it("stage words", () => {
    expect(stageBadge("key_1")).toBe("Newcomer");
    expect(stageBadge("key_2")).toBe("In Detox");
    expect(stageBadge("certified")).toBe("Certified");
    expect(stageBadge("ministry_eligible")).toBe("In Ministry");
  });
  it("time coins: 30/60/90 days, 6/9 months, then years (next ones ahead shown)", () => {
    const c = timeCoins("2025-01-31", "2026-11-06");
    expect(c.filter((x) => x.earned).map((x) => x.label)).toEqual(["30 days", "60 days", "90 days", "6 months", "9 months", "1 year"]);
    expect(c.find((x) => x.id === "m6")!.on).toBe("2025-07-31");
    expect(c.find((x) => x.id === "y2")).toMatchObject({ on: "2027-01-31", earned: false });
    expect(c.map((x) => x.id).slice(-1)[0]).toBe("y5");
    expect(timeCoins("2019-03-01", "2026-11-06").slice(-2).map((x) => [x.label, x.earned])).toEqual([["7 years", true], ["8 years", false]]);
    expect(timeCoins(null, "2026-11-06")).toEqual([]);
  });
  it("time clean in words", () => {
    expect(timeClean("2026-06-15", "2026-11-06")).toEqual({ days: 144, words: "4 months, 22 days" });
    expect(timeClean("2024-08-06", "2026-11-06")?.words).toBe("2 years, 3 months");
    expect(timeClean("2026-11-06", "2026-11-06")?.words).toBe("Today is day one");
    expect(timeClean("2026-12-01", "2026-11-06")).toBeNull();
  });
});
