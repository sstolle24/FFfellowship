import { describe, expect, it } from "vitest";
import { placeFor } from "./places";

describe("Directory map: where a pin goes", () => {
  it("state in his country, from names, abbreviations and common spellings", () => {
    expect(placeFor("USA", "California")?.label).toBe("California, USA");
    expect(placeFor("U.S.", "CA")?.key).toBe("us-ca");
    expect(placeFor("United States", "calif.")?.key).toBe("us-ca");
    expect(placeFor("Canada", "ON")?.label).toBe("Ontario, Canada");
    expect(placeFor("Australia", "WA")?.label).toBe("Western Australia, Australia"); // not Washington
    expect(placeFor("", "Texas")?.label).toBe("Texas, USA"); // no country: US first
  });
  it("falls back to the country, and to null when nothing is recognized", () => {
    expect(placeFor("Singapore", "")?.label).toBe("Singapore");
    expect(placeFor("Philippines", "Cebu")?.label).toBe("Philippines");
    expect(placeFor("UK", "Scotland")?.label).toBe("Scotland, UK");
    expect(placeFor("Narnia", "")).toBeNull();
    expect(placeFor(null, null)).toBeNull();
  });
});
