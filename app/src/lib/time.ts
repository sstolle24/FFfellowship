/** Date/time helpers. Meetings are stored as (UTC weekday, UTC time) and always
 *  shown in the viewer's own timezone. */

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** YYYY-MM-DD for "now" in a timezone. */
export function todayIn(tz: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: safeTz(tz), year: "numeric", month: "2-digit", day: "2-digit" })
    .format(at);
}

export function safeTz(tz: string | null | undefined): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz ?? "UTC" });
    return tz ?? "UTC";
  } catch {
    return "UTC";
  }
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.UTC(+fromIso.slice(0, 4), +fromIso.slice(5, 7) - 1, +fromIso.slice(8, 10));
  const b = Date.UTC(+toIso.slice(0, 4), +toIso.slice(5, 7) - 1, +toIso.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
  return d.toISOString().slice(0, 10);
}

/** Day count of sobriety: start day = day 0, matching keychain conventions. */
export function dayCount(start: string | null, tz: string): number | null {
  if (!start) return null;
  return Math.max(0, daysBetween(start, todayIn(tz)));
}

/** "42 days", "1 day", or "No sobriety date set" — never "? days". */
export function daysLabel(n: number | null | undefined): string {
  if (n === null || n === undefined) return "No sobriety date set";
  return `${n} day${n === 1 ? "" : "s"}`;
}

/** Monday of the current week in his timezone (Fishing "Your 3 This Week"). */
export function weekStart(tz: string): string {
  const today = todayIn(tz);
  const dow = new Date(today + "T12:00:00Z").getUTCDay(); // 0 Sun
  return addDays(today, -((dow + 6) % 7));
}

/** The next occurrence (as a Date) of a weekly meeting given in UTC. */
export function nextOccurrence(dayUtc: number, timeUtc: string, from: Date = new Date()): Date {
  const [h, m] = timeUtc.split(":").map(Number);
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), h, m));
  let add = (dayUtc - d.getUTCDay() + 7) % 7;
  if (add === 0 && d.getTime() < from.getTime() - 90 * 60_000) add = 7; // keep "now-ish" meetings for 90 min
  d.setUTCDate(d.getUTCDate() + add);
  return d;
}

/** Weekday index (0 Sun) and "7:00 PM CDT" for a UTC weekly slot, in a timezone. */
export function localSlot(dayUtc: number, timeUtc: string, tz: string) {
  const at = nextOccurrence(dayUtc, timeUtc);
  const z = safeTz(tz);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: z, weekday: "long" }).format(at);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: z, hour: "numeric", minute: "2-digit", timeZoneName: "short" })
    .format(at);
  return { at, weekday, dayIndex: DAYS.indexOf(weekday), time, localDate: todayIn(z, at) };
}

export function fmtDate(iso: string | null | undefined, tz = "UTC"): string {
  if (!iso) return "";
  const d = iso.length === 10 ? new Date(iso + "T12:00:00Z") : new Date(iso);
  return new Intl.DateTimeFormat("en-US", { timeZone: iso.length === 10 ? "UTC" : safeTz(tz), month: "short", day: "numeric", year: "numeric" }).format(d);
}

export function fmtDateTime(iso: string | null | undefined, tz = "UTC"): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: safeTz(tz), month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
    .format(new Date(iso));
}

export function relDays(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
