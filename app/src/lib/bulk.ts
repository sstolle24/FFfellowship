import type { RpcEvent } from "@/lib/types";

/** Item-by-item emails a bulk sign-off would send; these are combined into one per man. */
const PER_ITEM = new Set(["approved", "ap_overridden", "leader_review_needed"]);

/**
 * Combines a bulk sign-off's events so each person gets one email, not one per
 * item: "Approved: items #3, #5 and #9". Other events (a key unlocking, a
 * milestone) pass through once each.
 */
export function mergeBulkEvents(events: RpcEvent[]): RpcEvent[] {
  const out: RpcEvent[] = [];
  const groups = new Map<string, RpcEvent[]>();
  const seen = new Set<string>();
  for (const e of events) {
    if (PER_ITEM.has(e.type)) {
      const k = `${e.type}:${e.man_id}`;
      if (!groups.has(k)) { groups.set(k, []); out.push({ type: `__group:${k}` }); }
      groups.get(k)!.push(e);
    } else {
      const k = JSON.stringify(e);
      if (!seen.has(k)) { seen.add(k); out.push(e); }
    }
  }
  return out.map((e) => {
    if (!e.type.startsWith("__group:")) return e;
    const g = groups.get(e.type.slice(8))!;
    if (g.length === 1) return g[0];
    const labels = g.map((x) => (x.item ? `#${x.item}` : String(x.step)));
    const list = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}` : labels[0];
    const first: RpcEvent = { ...g[0], step: `items ${list}` };
    delete first.item;
    delete first.step_id;
    return first;
  });
}
