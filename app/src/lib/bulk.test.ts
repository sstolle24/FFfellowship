import { describe, expect, it } from "vitest";
import { mergeBulkEvents } from "./bulk";

describe("bulk sign-off emails", () => {
  it("one email per man and kind, listing the items; other events once", () => {
    const ev = [
      { type: "approved", man_id: "m", step: "Pray", item: 1, step_id: "a" },
      { type: "module_unlocked", man_id: "m", module: "key_3_part_1" },
      { type: "approved", man_id: "m", step: "Clear home", item: 3, step_id: "b" },
      { type: "approved", man_id: "m", step: "Contacts", item: 5, step_id: "c" },
      { type: "module_unlocked", man_id: "m", module: "key_3_part_1" },
      { type: "ap_overridden", man_id: "m", step: "Pray", item: 1, leader_id: "L", reason: "AP away" },
    ];
    expect(mergeBulkEvents(ev)).toEqual([
      { type: "approved", man_id: "m", step: "items #1, #3 and #5" },
      { type: "module_unlocked", man_id: "m", module: "key_3_part_1" },
      { type: "ap_overridden", man_id: "m", step: "Pray", item: 1, leader_id: "L", reason: "AP away" },
    ]);
  });
});
