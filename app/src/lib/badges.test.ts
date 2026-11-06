import { describe, expect, it } from "vitest";
import { programBadges, stageBadge, tagProgress, timeClean, timeCoins } from "./badges";

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
  it("key tags: Just For Today through 18 months, then years (next one ahead shown)", () => {
    const c = timeCoins("2025-01-31", "2026-11-06");
    expect(c.filter((x) => x.earned).map((x) => x.label)).toEqual(
      ["Just For Today", "1 week", "2 weeks", "21 days", "30 days", "60 days", "90 days", "6 months", "9 months", "1 year", "18 months"]);
    expect(c.map((x) => x.color)).toEqual(["white", "gold", "gold", "orange", "orange", "green", "red", "blue", "yellow", "glow", "gray", "black", "black"]);
    expect(c.find((x) => x.id === "m6")!.on).toBe("2025-07-31");
    expect(c.find((x) => x.id === "y2")).toMatchObject({ on: "2027-01-31", earned: false });
    expect(c.at(-1)!.id).toBe("y3");
    expect(timeCoins("2019-03-01", "2026-11-06").slice(-2).map((x) => [x.label, x.earned])).toEqual([["7 years", true], ["8 years", false]]);
    expect(timeCoins("2026-11-06", "2026-11-06").filter((x) => x.earned).map((x) => x.id)).toEqual(["jft"]);
    expect(timeCoins(null, "2026-11-06")).toEqual([]);
  });
  it("progress toward the next tag", () => {
    const c = timeCoins("2026-10-01", "2026-11-06"); // 36 days: 30 earned, 60 next
    expect(tagProgress(c, "2026-11-06")).toEqual({ id: "d60", pct: 0.2 });
  });
  it("time clean in words", () => {
    expect(timeClean("2026-06-15", "2026-11-06")).toEqual({ days: 144, words: "4 months, 22 days" });
    expect(timeClean("2024-08-06", "2026-11-06")?.words).toBe("2 years, 3 months");
    expect(timeClean("2026-11-06", "2026-11-06")?.words).toBe("Today is day one");
    expect(timeClean("2026-12-01", "2026-11-06")).toBeNull();
  });
});
