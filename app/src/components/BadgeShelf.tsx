import Link from "next/link";
import type { Program } from "@/lib/program";
import { programBadges, stageBadge, tagProgress, timeClean, timeCoins } from "@/lib/badges";
import { daysBetween, fmtDate, todayIn } from "@/lib/time";
import { Badge, Card } from "@/components/ui";
import { ProgramBadges, TimeCoins } from "@/components/Badges";

/** His badges: the 3 Keys, Certified, Ministry — and time clean with sobriety key tags. */
export function BadgeShelf({ program, stage, sobrietyStart, timezone, self }: {
  program: Program; stage: string; sobrietyStart: string | null; timezone: string; self: boolean;
}) {
  const today = todayIn(timezone);
  const badges = programBadges({
    key1Done: program.byKey.key_1.done, key2Done: program.byKey.key_2.done,
    key3Done: program.byKey.key_3_part_1.done && program.byKey.key_3_part_2.done, milestones: program.milestones,
  });
  const clean = timeClean(sobrietyStart, today);
  const coins = timeCoins(sobrietyStart, today);
  const next = coins.find((c) => !c.earned);
  return (
    <Card className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg text-gold">{self ? "Your badges" : "Badges"}</h2>
        <Badge tone="gold">{stageBadge(stage)}</Badge>
      </div>
      <ProgramBadges badges={badges} />
      <div className="space-y-3 border-t border-line/60 pt-4">
        <h3 className="text-gold">Time clean</h3>
        {clean ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="display text-4xl text-ink">{clean.days}</span>
              <span className="text-ink">day{clean.days === 1 ? "" : "s"} · {clean.words}</span>
            </p>
            {next && (
              <p className="text-sm text-muted">
                Next: <strong className="text-ink">{next.label}</strong> on {fmtDate(next.on)} — {daysBetween(today, next.on)} day{daysBetween(today, next.on) === 1 ? "" : "s"} to go.
              </p>
            )}
            <TimeCoins coins={coins} progress={tagProgress(coins, today)} />
          </>
        ) : (
          <p className="text-sm text-muted">
            {self ? <>No sobriety date yet. <Link href="/app/profile#sobriety" className="text-gold underline">Add it in Profile</Link> to start your key tags.</> : "No sobriety date set."}
          </p>
        )}
      </div>
    </Card>
  );
}
