/** Badge shelf: the 3 Keys, Certified, Ministry, and time-clean coins (pure; no server code). */
import { addDays, daysBetween } from "./time";

export type ProgramBadge = { id: "key1" | "key2" | "key3" | "certified" | "ministry"; label: string; earned: boolean; hint: string };
export type TimeCoin = { id: string; label: string; short: string; on: string; earned: boolean };

type Progress = {
  key1Done: boolean; key2Done: boolean; key3Done: boolean;
  milestones: { type: string }[];
};

export function programBadges(p: Progress): ProgramBadge[] {
  const has = (t: string) => p.milestones.some((m) => m.type === t);
  const key3 = p.key3Done || has("keys_complete");
  return [
    { id: "key1", label: "Key 1", earned: p.key1Done, hint: "The 3 videos and the Fishing worksheet" },
    { id: "key2", label: "Key 2", earned: p.key2Done || has("detox21_certified"), hint: "The 21 — Detox-21 certified" },
    { id: "key3", label: "Key 3", earned: key3, hint: "Bill's story, both parts" },
    { id: "certified", label: "Certified", earned: has("fellowship_certified"), hint: "Fellowship certified" },
    { id: "ministry", label: "Ministry", earned: has("ministry_eligible"), hint: "Sponsored a man to certification" },
  ];
}

/** Where he is, in plain words: Newcomer, In Detox, Finishing the Keys, Certified, In Ministry. */
export function stageBadge(stage: string): string {
  return ({ module_0: "Newcomer", key_1: "Newcomer", key_2: "In Detox", key_3: "Finishing the 3 Keys",
    certification_review: "Finishing the 3 Keys", certified: "Certified", ministry_eligible: "In Ministry" } as Record<string, string>)[stage] ?? "Newcomer";
}

function addMonths(iso: string, n: number): string {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1 + n, d = +iso.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // Jan 31 + 1 month → Feb 28/29
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}

/** Recovery-chip coins: 30, 60, 90 days, 6 and 9 months, then every year (through 5, or the next one ahead). */
export function timeCoins(start: string | null, today: string): TimeCoin[] {
  if (!start) return [];
  const coins: TimeCoin[] = [
    { id: "d30", label: "30 days", short: "30", on: addDays(start, 30), earned: false },
    { id: "d60", label: "60 days", short: "60", on: addDays(start, 60), earned: false },
    { id: "d90", label: "90 days", short: "90", on: addDays(start, 90), earned: false },
    { id: "m6", label: "6 months", short: "6", on: addMonths(start, 6), earned: false },
    { id: "m9", label: "9 months", short: "9", on: addMonths(start, 9), earned: false },
  ];
  let y = 1;
  while (addMonths(start, 12 * y) <= today) y++;
  for (let n = 1; n <= Math.max(5, y); n++) coins.push({ id: `y${n}`, label: `${n} year${n > 1 ? "s" : ""}`, short: String(n), on: addMonths(start, 12 * n), earned: false });
  return coins.map((c) => ({ ...c, earned: c.on <= today }));
}

/** "4 months, 21 days" / "2 years, 3 months" — the length of time clean in words. */
export function timeClean(start: string | null, today: string): { days: number; words: string } | null {
  if (!start || start > today) return null;
  const days = daysBetween(start, today);
  let months = 0;
  while (addMonths(start, months + 1) <= today) months++;
  const years = Math.floor(months / 12), mo = months % 12, d = daysBetween(addMonths(start, months), today);
  const part = (n: number, w: string) => (n ? `${n} ${w}${n === 1 ? "" : "s"}` : "");
  const words = [part(years, "year"), part(mo, "month"), years ? "" : part(d, "day")].filter(Boolean).join(", ") || "Today is day one";
  return { days, words };
}
