import { notFound } from "next/navigation";
import Link from "next/link";
import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { loadProgram, type ModuleView } from "@/lib/program";
import { namesFor } from "@/lib/names";
import { fmtDate } from "@/lib/time";
import { PrintButton } from "@/components/PrintButton";
import { Badge } from "@/components/ui";

export const metadata = { title: "Certification packet" };

/** Auto-assembled: Key 1 worksheet, Key 2 cover sheet + orange turn-ins, Key 3 Parts 1 & 2. */
export default async function Packet({ params }: { params: Promise<{ manId: string }> }) {
  const { manId } = await params;
  await requireActive();
  const db = await supabaseServer();
  const program = await loadProgram(db, manId);
  if (!program.modules.some((m) => m.steps.some((s) => s.progress))) notFound();
  const man = (await namesFor(db, [manId]))[manId] ?? "";
  const k2 = program.byKey.key_2;

  const turnIns = await Promise.all(k2.steps.filter((s) => s.turn_in).map(async (s) => {
    const latest = s.submissions[s.submissions.length - 1];
    let url: string | null = null;
    if (latest?.file_path) url = (await db.storage.from("submissions").createSignedUrl(latest.file_path, 600, { download: true })).data?.signedUrl ?? null;
    return { s, latest, url };
  }));

  return (
    <div className="print-card mx-auto max-w-4xl space-y-8 rounded-xl border border-line bg-panel p-6">
      <div className="no-print flex justify-between">
        <Link href={`/app/cover-sheet/${manId}`} className="text-sm text-gold underline">Open cover sheet</Link>
        <PrintButton />
      </div>
      <header className="text-center">
        <h1 className="text-2xl text-gold">Certification Packet</h1>
        <p className="text-muted">{man} · 3 Keys to Freedom</p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {program.milestones.map((m) => <Badge key={m.type + m.awarded_at} tone="ok">{m.type.replace(/_/g, " ")} · {fmtDate(m.awarded_at)}</Badge>)}
        </div>
      </header>

      <Answers title="Key 1 — Permanent / Real Sobriety worksheet" mod={program.byKey.key_1} />

      <section>
        <h2 className="text-lg text-gold">Key 2 — The 21</h2>
        <p className="text-sm text-muted">
          {k2.steps.filter((s) => s.progress?.status === "leader_initialed").length}/21 leader-initialed ·{" "}
          {k2.done ? "Detox-21 certified" : "not yet certified"}
        </p>
        <h3 className="mt-4 text-orange">Orange turn-ins</h3>
        <ul className="mt-2 space-y-3">
          {turnIns.map(({ s, latest, url }) => (
            <li key={s.id} className="rounded-lg border border-line p-3 text-sm">
              <div className="font-semibold">#{s.item_number} {s.title}</div>
              {!latest && <p className="text-danger">Missing</p>}
              {url && <a href={url} target="_blank" rel="noopener noreferrer" className="text-gold underline">{latest!.file_path!.split("/").pop()}</a>}
              {latest?.body_text && <p className="mt-1 whitespace-pre-line">{latest.body_text}</p>}
            </li>
          ))}
        </ul>
      </section>

      <Answers title="Key 3 — Bill's Story, Part 1 (minutes 1–59)" mod={program.byKey.key_3_part_1} />
      <Answers title="Key 3 — Bill's Story, Part 2 (minute 59 to end)" mod={program.byKey.key_3_part_2} />
    </div>
  );
}

function Answers({ title, mod }: { title: string; mod: ModuleView }) {
  const uploads = mod.steps.flatMap((s) => s.submissions.filter((x) => x.file_path));
  return (
    <section>
      <h2 className="text-lg text-gold">{title}</h2>
      {uploads.length > 0 && <p className="text-sm text-muted">Paper worksheet uploaded ({uploads.length} version{uploads.length > 1 ? "s" : ""}) — see the item page.</p>}
      <ol className="mt-3 space-y-3 text-sm">
        {mod.questions.filter((q) => q.answer_slots > 0).map((q) => (
          <li key={q.id}>
            <p className="text-muted">{q.timestamp_label && <strong className="mr-1 text-gold">{q.timestamp_label}</strong>}{q.prompt}</p>
            <ul className="ml-4 mt-1 list-disc">
              {q.answers.filter(Boolean).map((a, i) => <li key={i} className="whitespace-pre-line">{a}</li>)}
              {!q.answers.some(Boolean) && <li className="italic text-muted">No answer</li>}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
