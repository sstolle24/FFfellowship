import { describe, expect, it } from "vitest";
import { holidayOn, inHolidaySeason } from "./holiday";

describe("holiday season", () => {
  it("auto runs Nov 20 – Jan 6 Pacific", () => {
    expect(inHolidaySeason(new Date("2026-11-19T12:00:00-08:00"))).toBe(false);
    expect(inHolidaySeason(new Date("2026-11-20T00:30:00-08:00"))).toBe(true);
    expect(inHolidaySeason(new Date("2026-12-25T12:00:00-08:00"))).toBe(true);
    expect(inHolidaySeason(new Date("2027-01-06T23:00:00-08:00"))).toBe(true);
    expect(inHolidaySeason(new Date("2027-01-07T01:00:00-08:00"))).toBe(false);
    // 7 pm Nov 19 Pacific is already Nov 20 in UTC: still not the season.
    expect(inHolidaySeason(new Date("2026-11-20T03:00:00Z"))).toBe(false);
  });
  it("on/off override the dates", () => {
    const july = new Date("2026-07-04T12:00:00-07:00");
    expect(holidayOn({ mode: "on" }, july)).toBe(true);
    expect(holidayOn({ mode: "off" }, new Date("2026-12-25T12:00:00-08:00"))).toBe(false);
    expect(holidayOn(null)).toBe(false);
  });
});
