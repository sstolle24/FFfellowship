/** Badge shelf: the 3 Keys, Certified, Ministry, and time-clean coins (pure; no server code). */
import { addDays, daysBetween } from "./time";

export type ProgramBadge = { id: "key1" | "key2" | "key3" | "certified" | "ministry"; label: string; earned: boolean; hint: string };
export type TimeCoin = { id: string; label: string; short: string; on: string; earned: boolean; color: TagColor };

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

/** Key-tag colors (classic recovery key tags). */
export type TagColor = "white" | "gold" | "orange" | "green" | "red" | "blue" | "yellow" | "glow" | "gray" | "black";

/**
 * Sobriety key tags: Just For Today, 1 and 2 weeks, 21/30/60/90 days, 6 and 9
 * months, 1 year, 18 months, then every year (through 3, or the next one ahead).
 */
export function timeCoins(start: string | null, today: string): TimeCoin[] {
  if (!start) return [];
  const t = (id: string, label: string, short: string, on: string, color: TagColor) => ({ id, label, short, on, color, earned: false });
  const coins: TimeCoin[] = [
    t("jft", "Just For Today", "JFT", start, "white"),
    t("w1", "1 week", "1 Week", addDays(start, 7), "gold"),
    t("w2", "2 weeks", "2 Weeks", addDays(start, 14), "gold"),
    t("d21", "21 days", "21 Days", addDays(start, 21), "orange"),
    t("d30", "30 days", "30 Days", addDays(start, 30), "orange"),
    t("d60", "60 days", "60 Days", addDays(start, 60), "green"),
    t("d90", "90 days", "90 Days", addDays(start, 90), "red"),
    t("m6", "6 months", "6 Months", addMonths(start, 6), "blue"),
    t("m9", "9 months", "9 Months", addMonths(start, 9), "yellow"),
    t("y1", "1 year", "1 Year", addMonths(start, 12), "glow"),
    t("m18", "18 months", "18 Months", addMonths(start, 18), "gray"),
  ];
  let y = 2;
  while (addMonths(start, 12 * y) <= today) y++;
  for (let n = 2; n <= Math.max(3, y); n++) coins.push(t(`y${n}`, `${n} years`, `${n} Years`, addMonths(start, 12 * n), "black"));
  return coins.map((c) => ({ ...c, earned: c.on <= today }));
}

/** How far along he is toward a tag (0–1), from the tag before it. */
export function tagProgress(coins: TimeCoin[], today: string): { id: string; pct: number } | null {
  const i = coins.findIndex((c) => !c.earned);
  if (i < 1) return null;
  const from = coins[i - 1].on, to = coins[i].on;
  return { id: coins[i].id, pct: Math.max(0, Math.min(1, daysBetween(from, today) / Math.max(1, daysBetween(from, to)))) };
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
