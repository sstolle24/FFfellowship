import Link from "next/link";
import type { ModuleView } from "@/lib/program";
import { confirmKey1 } from "@/app/leader/actions";
import { ActionButton } from "@/components/forms";
import { Badge, Card } from "@/components/ui";
import { OverrideApForm } from "@/components/StepForms";

/**
 * Leader view of where a man stands in Key 1 and what opens Key 2: his 3 videos
 * (with reflections), the Fishing worksheet, and the go-over with his AP. With
 * no AP or sponsor, his leader does the go-over and confirms it here.
 */
export function Key1Panel({ first, key1, hasMentor, canConfirm }: {
  first: string; key1: ModuleView; hasMentor: boolean; canConfirm: boolean;
}) {
  const worksheet = key1.steps.find((s) => s.helper?.type === "worksheet");
  const goOver = key1.steps.find((s) => s.gate_type === "self_ap");
  const ws = worksheet?.progress?.status;
  const go = goOver?.progress?.status;
  const watched = key1.videos.filter((v) => v.watched_at).length;
  const wsDone = !!ws && ["self_initialed", "ap_initialed", "leader_initialed"].includes(ws);
  const rows: [string, boolean, string][] = [
    ...key1.videos.map((v): [string, boolean, string] => [v.title, !!v.watched_at, v.watched_at ? "Watched, reflection in" : "Not checked off yet"]),
    ["Fishing worksheet", wsDone, wsDone ? "Done" : ws === "open" || ws === "returned" ? "Not finished yet" : "Opens after the 3 videos"],
    [goOver?.title ?? "Go-over with AP", go === "ap_initialed", go === "ap_initialed" ? "Confirmed" : go === "self_initialed" ? `${first} initialed — needs confirmation` : `Waiting on ${first}'s initials`],
  ];
  const next = watched < key1.videos.length ? `${first} checks off the 3 videos (each with a reflection).`
    : !wsDone ? `${first} finishes the Fishing worksheet.`
    : go !== "self_initialed" ? `${first} goes over his video notes and worksheet with ${hasMentor ? "his AP" : "a leader (he has no AP)"}, then initials "${goOver?.title}".`
    : null;

  return (
    <Card className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-gold">Key 1 → Key 2</h2>
        {!hasMentor && <Badge tone="orange">No AP yet</Badge>}
      </div>
      <ul className="space-y-1">
        {rows.map(([label, ok, note]) => (
          <li key={label} className="flex flex-wrap gap-x-2">
            <span className={ok ? "text-ok" : "text-muted"}>{ok ? "✓" : "○"}</span>
            <span className="text-ink">{label}</span>
            <span className="text-muted">— {note}</span>
          </li>
        ))}
      </ul>
      {next && <p className="text-muted"><strong className="text-ink">Next:</strong> {next} Key 2 opens when {hasMentor ? "his AP" : "a leader"} confirms the go-over.</p>}
      {goOver?.progress && go === "self_initialed" && (canConfirm ? (
        <div className="space-y-1">
          <p className="text-muted">He has no AP or sponsor, so you confirm the go-over.</p>
          <ActionButton run={confirmKey1.bind(null, goOver.progress.id)} confirm={`Confirm you went over ${first}'s video notes and worksheet? This opens Key 2.`}>Confirm Key 1 — opens Key 2</ActionButton>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-muted">{hasMentor ? `Waiting on his AP. If they can't, you can sign for them:` : `His primary leader confirms this. Or sign it yourself as a leader override:`}</p>
          <OverrideApForm spId={goOver.progress.id} man={first} />
        </div>
      ))}
      {goOver?.progress && <Link href={`/app/step/${goOver.progress.id}`} className="inline-block text-xs text-muted hover:text-gold">Open the item →</Link>}
    </Card>
  );
}
