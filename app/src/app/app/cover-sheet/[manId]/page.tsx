import { notFound } from "next/navigation";
import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { loadProgram } from "@/lib/program";
import { initialerNames, namesFor } from "@/lib/names";
import { fmtDate } from "@/lib/time";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Detox-21 cover sheet" };

export default async function CoverSheet({ params }: { params: Promise<{ manId: string }> }) {
  const { manId } = await params;
  await requireActive();
  const db = await supabaseServer();
  const program = await loadProgram(db, manId);
  const k2 = program.byKey.key_2;
  if (!k2 || !k2.steps.some((s) => s.progress)) notFound(); // RLS: not his, not his AP/sponsor, not a leader
  const names = await initialerNames(db, program);
  const man = (await namesFor(db, [manId]))[manId] ?? "";
  const { data: rel } = await db.from("relationships").select("mentor_id, mentee_id, type").eq("status", "active").eq("type", "ap")
    .or(`mentee_id.eq.${manId},mentor_id.eq.${manId}`);
  const apId = rel?.[0] ? (rel[0].mentee_id === manId ? rel[0].mentor_id : rel[0].mentee_id) : null;
  const ap = apId ? (await namesFor(db, [apId]))[apId] : "";
  const cell = (at: string | null | undefined, by?: string | null) =>
    at ? `${by ? names[by] ?? "" : "✓"} ${fmtDate(at)}` : "";

  return (
    <div className="print-card mx-auto max-w-4xl rounded-xl border border-line bg-panel p-6 text-sm">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <h1 className="text-center text-xl text-gold">Finally Free&apos;s &ldquo;Virtual Detox&rdquo; Program — &ldquo;The 21&rdquo;</h1>
      <p className="text-center text-muted">Cover sheet · Key #2</p>
      <div className="my-4 flex flex-wrap justify-between gap-2">
        <span>Name: <strong>{man}</strong></span>
        <span>AP: <strong>{ap || "—"}</strong></span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <th className="py-2 pr-2">#</th><th className="pr-2">Item</th><th className="pr-2">Self</th><th className="pr-2">AP</th><th>Leader</th>
          </tr>
        </thead>
        <tbody>
          {k2.steps.map((s) => (
            <tr key={s.id} className="border-b border-line/60 align-top">
              <td className="py-1.5 pr-2 font-semibold">{s.item_number}</td>
              <td className="pr-2">{s.title}{s.turn_in && <span className="ml-1 text-orange">(turn in{s.submissions.length ? " ✓" : ""})</span>}{s.progress?.read_to_group && <span className="ml-1 text-ok">(read to group)</span>}</td>
              <td className="pr-2">{cell(s.progress?.self_initialed_at)}</td>
              <td className="pr-2">{cell(s.progress?.ap_initialed_at, s.progress?.ap_initial_by)}</td>
              <td>{cell(s.progress?.leader_initialed_at, s.progress?.leader_initial_by)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-8 grid grid-cols-2 gap-8">
        <div className="border-t border-line pt-1 text-xs text-muted">Signature</div>
        <div className="border-t border-line pt-1 text-xs text-muted">Date completed</div>
      </div>
    </div>
  );
}
