import { stageBadge } from "@/lib/badges";

const TONE: Record<string, string> = {
  "Newcomer": "border-line bg-navy-2 text-muted",
  "In Detox": "border-amber-500/60 bg-amber-50 text-amber-800",
  "Finishing the 3 Keys": "border-gold/50 bg-gold/5 text-gold",
  "Certified": "border-ok/60 bg-ok/10 text-ok",
  "In Ministry": "border-amber-600 bg-amber-400 text-amber-950",
};

/** His status beside his name: Newcomer, In Detox, Finishing the 3 Keys, Certified, In Ministry. */
export function StageTag({ stage }: { stage: string | null | undefined }) {
  const label = stageBadge(stage ?? "module_0");
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 align-middle font-sans text-[11px] font-semibold uppercase tracking-wide ${TONE[label]}`}>
      {label}
    </span>
  );
}
