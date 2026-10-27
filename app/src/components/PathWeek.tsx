import { addDays, fmtDate } from "@/lib/time";
import { ActionButton } from "@/components/forms";
import { Badge } from "@/components/ui";
import { FishingSlot } from "@/components/FishingSlot";
import { commitFishingWeek } from "@/app/app/actions";

type Contact = { slot: number; name: string; method: string | null; note: string | null };

/** "The Path": his 3 men for this week, and the commit that closes the section. */
export function PathWeek({ weekStart, contacts, committedAt }: { weekStart: string; contacts: Contact[]; committedAt: string | null }) {
  const named = [1, 2, 3].filter((s) => contacts.some((c) => c.slot === s && c.name.trim())).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Week of {fmtDate(weekStart)} – {fmtDate(addDays(weekStart, 6))}. A new week starts every Monday.</p>
      {[1, 2, 3].map((slot) => (
        <FishingSlot key={slot} slot={slot} committed={!!committedAt} current={contacts.find((c) => c.slot === slot) ?? null} />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {committedAt ? (
          <Badge tone="ok">Committed {fmtDate(committedAt)} — names locked for the week</Badge>
        ) : (
          <>
            <ActionButton run={commitFishingWeek} confirm="Commit these 3 men for the week? Their names lock until next Monday.">
              Commit my 3 for this week
            </ActionButton>
            <span className="text-sm text-muted">{named}/3 named — save each one, then commit.</span>
          </>
        )}
      </div>
    </div>
  );
}
