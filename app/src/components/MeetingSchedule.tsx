"use client";
import { useEffect, useMemo, useState } from "react";
import { DAYS, localSlot } from "@/lib/time";
import { Badge } from "@/components/ui";

type Row = { id: string; name: string; day_of_week: number; start_time_utc: string; tagline: string | null; beginner: boolean;
  temp_closed?: boolean; closed_note?: string | null };

/** Public weekly schedule in the visitor's own timezone. No links, ever. */
export function MeetingSchedule({ meetings }: { meetings: Row[] }) {
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);
  const rows = useMemo(
    () => meetings.map((m) => ({ ...m, slot: localSlot(m.day_of_week, m.start_time_utc.slice(0, 5), tz) }))
      .sort((a, b) => a.slot.dayIndex - b.slot.dayIndex || a.slot.at.getUTCHours() * 60 + a.slot.at.getUTCMinutes() - (b.slot.at.getUTCHours() * 60 + b.slot.at.getUTCMinutes())),
    [meetings, tz],
  );
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">Times shown in your timezone ({tz}).</p>
      {DAYS.map((d, i) => {
        const day = rows.filter((r) => r.slot.dayIndex === i);
        if (!day.length) return null;
        return (
          <div key={d}>
            <h2 className="mb-2 text-lg text-gold">{d}</h2>
            <div className="divide-y divide-line rounded-xl border border-line bg-panel">
              {day.map((m) => (
                <div key={m.id} className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 p-4 ${m.temp_closed ? "opacity-70" : ""}`}>
                  <span className={`w-36 shrink-0 font-semibold ${m.temp_closed ? "line-through decoration-1" : ""}`}>{m.slot.time}</span>
                  <span className="display text-ink">{m.name}</span>
                  {m.temp_closed && <Badge tone="orange">Temporarily closed</Badge>}
                  {m.beginner && !m.temp_closed && <Badge tone="gold">Beginner friendly</Badge>}
                  {m.temp_closed && m.closed_note && <span className="basis-full text-sm text-orange sm:ml-40">{m.closed_note}</span>}
                  {m.tagline && <span className="basis-full text-sm text-muted sm:ml-40">{m.tagline}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
