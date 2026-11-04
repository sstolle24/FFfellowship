import { describe, expect, it } from "vitest";
import { splitScripture } from "./kjv";

describe("tap-to-read scripture (KJV)", () => {
  it("finds the program's references, including the 'Mathew' spelling", () => {
    const p = splitScripture("pray for others that offend us. (Mathew 5:44, Luke 6:28). when you");
    expect(p.filter((x) => typeof x !== "string").map((x) => (x as { ref: string }).ref)).toEqual(["Matthew 5:44", "Luke 6:28"]);
    expect(p.map((x) => (typeof x === "string" ? x : x.label)).join("")).toBe("pray for others that offend us. (Mathew 5:44, Luke 6:28). when you");
  });
  it("reads 1 John 4:18 as 1 John, not John 4:18", () => {
    const p = splitScripture("PERFECT LOVE casts out fear, 1 John 4:18. If we");
    expect(p).toEqual(["PERFECT LOVE casts out fear, ", expect.objectContaining({ ref: "1 John 4:18", label: "1 John 4:18" }), ". If we"]);
  });
  it("verse ranges and plain text", () => {
    expect((splitScripture("Lamentations 3:22–23")[0] as { ref: string }).ref).toBe("Lamentations 3:22-23");
    expect(splitScripture("No verses here. Call 555-1212 at 5:30.")).toEqual(["No verses here. Call 555-1212 at 5:30."]);
    expect(splitScripture("Unknown ref John 3:16 stays plain")).toEqual(["Unknown ref John 3:16 stays plain"]);
  });
});
