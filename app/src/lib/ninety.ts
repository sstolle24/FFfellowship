/** 90 in 90 rules, shared by the dashboard, My Program, the 90 in 90 page, leader views and jobs. */

/** A meeting logged more than this many days after it happened shows as "added later". */
export const LATE_AFTER_DAYS = 3;

type WithStart = { ninety_start_date?: string | null; program_start_date?: string | null };
type Log = { date: string; counts_90?: boolean | null; created_at?: string | null };

/** His own 90-in-90 start date if he set one (e.g. his paper log began before he joined), else his program start. */
export function ninetyStart(p: WithStart): string | null {
  return p.ninety_start_date ?? p.program_start_date ?? null;
}

/** Meetings that count: marked as FF/SA and on or after his start date. */
export function countedLogs<T extends Log>(logs: T[], start: string | null): T[] {
  return logs.filter((l) => l.counts_90 !== false && (!start || l.date >= start));
}

export function ninetyCount(logs: Log[], start: string | null): number {
  return Math.min(90, countedLogs(logs, start).length);
}

/** Logged well after the meeting date (back-filled from a paper sheet, say). Shown to him, his AP and leaders. */
export function addedLater(l: Log): boolean {
  if (!l.created_at) return false;
  const logged = Date.UTC(+l.created_at.slice(0, 4), +l.created_at.slice(5, 7) - 1, +l.created_at.slice(8, 10));
  const met = Date.UTC(+l.date.slice(0, 4), +l.date.slice(5, 7) - 1, +l.date.slice(8, 10));
  return (logged - met) / 86_400_000 > LATE_AFTER_DAYS;
}
