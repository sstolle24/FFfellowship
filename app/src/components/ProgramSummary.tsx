import type { Program } from "@/lib/program";
import { dueDate, nextStep, selfDone, stepDone } from "@/lib/program";
import { daysBetween, fmtDate, todayIn } from "@/lib/time";
import { STAGE_LABEL, type Profile } from "@/lib/types";
import { Badge, Card, LinkButton } from "@/components/ui";

/**
 * Right-hand summary for My Program (xl screens): overall progress, current key,
 * next step, and the background items with their timers.
 */
export function ProgramSummary({ man, program, ninety }: { man: Profile; program: Program; ninety: number }) {
  const steps = program.modules.flatMap((m) => m.steps);
  const done = steps.filter((s) => stepDone(s.progress?.status, s.gate_type)).length;
  const pct = steps.length ? Math.round((done / steps.length) * 100) : 0;
  const next = nextStep(program);
  const today = todayIn(man.timezone);
  const background = program.modules.flatMap((m) => m.steps.filter((s) => s.helper?.background === true && !s.lockNote));

  const timer = (s: (typeof steps)[number]): string => {
    const st = s.progress?.status;
    if (stepDone(st, s.gate_type)) return "Signed off";
    if (selfDone(st)) return "Waiting on sign-offs";
    if (s.item_number === 10) return `${ninety}/90 meetings logged`;
    if (s.item_number === 2 && s.progress?.updated_at) {
      const d = Math.min(30, daysBetween(s.progress.updated_at.slice(0, 10), today) + 1);
      return `Day ${d} of 30`;
    }
    const due = dueDate(man.program_start_date, s.due_day);
    if (due) {
      const left = daysBetween(today, due);
      return left >= 0 ? `Due ${fmtDate(due)} · ${left} day${left === 1 ? "" : "s"} left` : `Was due ${fmtDate(due)}`;
    }
    return "In progress";
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted">Overall progress</div>
        <div className="flex items-baseline justify-between">
          <span className="display text-3xl text-gold">{pct}%</span>
          <span className="text-sm text-muted">{done}/{steps.length} items signed off</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Program progress">
          <div className="h-full rounded-full bg-gold" style={{ width: `${pct}%` }} />
        </div>
        <div className="text-sm"><span className="text-muted">Current key: </span><span className="text-ink">{STAGE_LABEL[man.stage]}</span></div>
      </Card>

      <Card className="space-y-3">
        <div className="text-xs uppercase tracking-widest text-muted">Your next step</div>
        <div className="display text-ink">{next.label}</div>
        <LinkButton href={next.href}>Go</LinkButton>
      </Card>

      {background.length > 0 && (
        <Card className="space-y-3">
          <div className="text-xs uppercase tracking-widest text-muted">Running in the background</div>
          <ul className="space-y-2 text-sm">
            {background.map((s) => (
              <li key={s.id} className="flex flex-col gap-0.5">
                <span className="text-ink">{s.item_number ? `#${s.item_number} ` : ""}{s.title}</span>
                <span><Badge tone={stepDone(s.progress?.status, s.gate_type) ? "ok" : "muted"}>{timer(s)}</Badge></span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
