import Link from "next/link";
import type { Program } from "@/lib/program";
import { dueDate } from "@/lib/program";
import type { Profile } from "@/lib/types";
import { StepRow } from "@/components/StepParts";
import { Badge, Card, Notice } from "@/components/ui";
import { VideoCheck } from "@/components/VideoCheck";
import { CopyButton } from "@/components/CopyButton";
import { KeyMeaning } from "@/components/KeyMeaning";
import { keyInfoFor } from "@/lib/keys";

/** The whole program for one man. `self` shows his own video check-offs; others see read-only status. */
export function ProgramView({ man, program, names, self, key2Closing }: {
  man: Profile; program: Program; names: Record<string, string>; self: boolean; key2Closing?: string;
}) {
  const href = (id?: string) => (id ? `/app/step/${id}` : undefined);
  return (
    <div className="space-y-8">
      {program.modules.map((m) => {
        const k2done = m.key === "key_2" && m.done;
        return (
          <section key={m.id} id={m.key} className="scroll-mt-6">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-xl text-gold">{m.title}</h2>
              {m.done ? <Badge tone="ok">Complete</Badge> : m.unlocked ? <Badge tone="gold">Open</Badge> : <Badge>Locked</Badge>}
            </div>
            {keyInfoFor(m.key) && <KeyMeaning info={keyInfoFor(m.key)!} />}
            {!m.unlocked ? (
              // Locked key: no instructions, videos or items — just what opens it.
              <p className="text-sm text-muted">{m.lockNote} It opens once every item there is signed off.</p>
            ) : (
              <div className="space-y-3">
                {m.description && m.key !== "key_3_part_2" && (
                  <details className="rounded-lg border border-line bg-panel p-3 text-sm">
                    <summary className="cursor-pointer text-muted">Read the instructions</summary>
                    <div className="mt-3 whitespace-pre-line leading-relaxed">{m.description}</div>
                  </details>
                )}

                {m.videos.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-3">
                    {m.videos.map((v) => v.lockNote ? (
                      <Card key={v.id} className="p-4 opacity-60">
                        <div className="flex items-center justify-between gap-2">
                          <span className="display text-ink">{v.title}</span>
                          <Badge>Locked</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted">{v.lockNote}</p>
                      </Card>
                    ) : (
                      <Card key={v.id} className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="display text-ink">{v.title}</span>
                          {v.watched_at && <Badge tone="ok">Watched</Badge>}
                        </div>
                        {self && (v.video_url ? (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <a href={v.video_url} target="_blank" rel="noopener noreferrer"
                              className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-navy hover:brightness-110">Watch</a>
                            {v.passcode && <CopyButton value={v.passcode} />}
                          </div>
                        ) : (
                          <p className="mt-2 text-xs text-muted">Link coming soon — ask your leader.</p>
                        ))}
                        {self && v.passcode && <p className="mt-1 text-xs text-muted">Passcode: <span className="select-all font-mono text-ink">{v.passcode}</span></p>}
                        {self ? (
                          <VideoCheck videoId={v.id} manId={man.id} watched={!!v.watched_at} notes={v.notes ?? ""}
                            reflection={v.reflection ?? ""} reflectionFile={v.reflection_file_path} reflectionUrl={v.reflection_url}
                            needsReflection={m.key === "key_1"} />
                        ) : (
                          <>
                            {v.notes && <p className="mt-2 whitespace-pre-line text-sm text-muted">{v.notes}</p>}
                            {m.key === "key_1" && (v.reflection || v.reflection_file_path ? (
                              <div className="mt-3 rounded-lg border border-line p-3 text-sm">
                                <div className="text-xs uppercase tracking-widest text-muted">Reflection</div>
                                {v.reflection && <p className="mt-1 whitespace-pre-line">{v.reflection}</p>}
                                {v.reflection_url && <a href={v.reflection_url} className="mt-1 inline-block text-gold underline" rel="noopener noreferrer">{v.reflection_file_path?.split("/").pop()}</a>}
                              </div>
                            ) : <p className="mt-2 text-xs italic text-muted">No reflection yet.</p>)}
                          </>
                        )}
                      </Card>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  {m.steps.map((s) => (
                    <StepRow key={s.id} step={s} names={names} href={s.lockNote ? undefined : href(s.progress?.id)}
                      due={dueDate(man.program_start_date, s.due_day)} lockedNote={s.lockNote ?? undefined} />
                  ))}
                </div>

                {m.key === "key_2" && (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Link href={`/app/cover-sheet/${man.id}`} className="text-gold underline">Printable cover sheet</Link>
                    {!k2done && m.steps.every((s) => s.progress?.status === "leader_initialed") && (
                      <Badge tone="gold">All 21 signed off — waiting on a leader to certify</Badge>
                    )}
                  </div>
                )}
                {k2done && key2Closing && <Notice>{key2Closing}</Notice>}
                {m.key === "certification" && (
                  <Link href={`/app/packet/${man.id}`} className="text-sm text-gold underline">View the assembled certification packet</Link>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
