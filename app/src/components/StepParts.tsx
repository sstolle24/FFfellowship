import Link from "next/link";
import type { StepView } from "@/lib/program";
import { fmtDate } from "@/lib/time";
import { Badge } from "@/components/ui";

const STATUS: Record<string, [string, "muted" | "gold" | "orange" | "ok" | "danger"]> = {
  locked: ["Locked", "muted"],
  open: ["Open", "gold"],
  self_initialed: ["Waiting on AP", "gold"],
  ap_initialed: ["Waiting on leader", "gold"],
  leader_initialed: ["Signed off", "ok"],
  returned: ["Returned", "danger"],
};

export function StatusBadge({ step }: { step: StepView }) {
  const s = step.progress?.status ?? "locked";
  let [label, tone] = STATUS[s];
  if (step.gate_type === "self" && s === "self_initialed") [label, tone] = ["Done", "ok"];
  if (step.gate_type === "self_ap" && s === "ap_initialed") [label, tone] = ["Done", "ok"];
  if (step.gate_type === "leader" && s === "self_initialed") [label, tone] = ["Submitted — leader review", "gold"];
  return <Badge tone={tone}>{label}</Badge>;
}

/** The paper form's three initial lines: his, his AP's, a leader's. */
export function InitialBoxes({ step, names }: { step: StepView; names: Record<string, string> }) {
  const p = step.progress;
  const cols: [string, string | null | undefined, string | null | undefined][] = [["You", p?.self_initialed_at, null]];
  if (step.gate_type === "self_ap" || step.gate_type === "triple") cols.push(["AP", p?.ap_initialed_at, p?.ap_initial_by]);
  if (step.gate_type === "triple" || step.gate_type === "leader") cols.push(["Leader", p?.leader_initialed_at, p?.leader_initial_by]);
  return (
    <div className="flex gap-1.5">
      {cols.map(([label, at, by]) => (
        <div key={label} title={at ? `${label}: ${by ? names[by] ?? "" : ""} ${fmtDate(at)}` : `${label}: not yet`}
          className={`flex h-9 w-14 flex-col items-center justify-center rounded border text-[10px] leading-tight ${at ? "border-ok/70 bg-ok/10 text-ok" : "border-line text-muted"}`}>
          <span className="uppercase tracking-wider">{label}</span>
          <span className="font-semibold">{at ? (by ? initials(names[by]) : "✓") : "—"}</span>
        </div>
      ))}
    </div>
  );
}
const initials = (n?: string) => (n ? n.slice(0, 2).toUpperCase() : "✓");

export function StepRow({ step, names, href, due, lockedNote }: {
  step: StepView; names: Record<string, string>; href?: string; due?: string | null; lockedNote?: string;
}) {
  const locked = !step.progress || step.progress.status === "locked" || !!lockedNote;
  const body = (
    <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${step.turn_in ? "border-orange/50" : "border-line"} ${locked ? "opacity-50" : "hover:border-gold"}`}>
      {step.item_number && <span className="display w-8 text-center text-lg text-gold">{step.item_number}</span>}
      <div className="min-w-0 flex-1">
        <div className="text-ink">{step.title}</div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {lockedNote ? <><Badge tone="muted">Locked</Badge><span className="text-xs text-muted">{lockedNote}</span></> : <StatusBadge step={step} />}
          {step.turn_in && <Badge tone="orange">Turn in</Badge>}
          {step.helper?.background === true && !lockedNote && <Badge tone="muted">Runs in the background</Badge>}
          {due && <Badge tone="muted">Due {fmtDate(due)}</Badge>}
          {step.progress?.read_to_group && <Badge tone="ok">Read to group</Badge>}
        </div>
      </div>
      <InitialBoxes step={step} names={names} />
    </div>
  );
  return href && !locked ? <Link href={href} className="block">{body}</Link> : body;
}
