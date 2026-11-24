/** Holiday season banner (0030): pure helpers, no server code. */
export type Holiday = { mode: "auto" | "on" | "off"; headline: string | null; message: string | null; featured_event: string | null };

/** Auto season: Nov 20 – Jan 6, by the date in Pacific time. */
export function inHolidaySeason(now = new Date()): boolean {
  const [m, d] = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" })
    .format(now).split("/").map(Number);
  return (m === 11 && d >= 20) || m === 12 || (m === 1 && d <= 6);
}

export function holidayOn(h: Pick<Holiday, "mode"> | null, now = new Date()): boolean {
  if (!h || h.mode === "off") return false;
  return h.mode === "on" || inHolidaySeason(now);
}
