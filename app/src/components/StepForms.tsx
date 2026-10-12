"use client";
import { useActionState } from "react";
import { returnStep, saveAnswers, submitText } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";
import { Badge, Card } from "@/components/ui";
import type { WorksheetQuestion } from "@/lib/types";

export function WorksheetForm({ questions, editable }: { questions: (WorksheetQuestion & { answers: string[] })[]; editable: boolean }) {
  const [state, run] = useActionState(saveAnswers, undefined);
  return (
    <form action={run} className="space-y-6">
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <div className="flex gap-2">
            {q.timestamp_label && <span className="shrink-0"><Badge tone="gold">{q.timestamp_label}</Badge></span>}
            <p className={q.answer_slots ? "text-ink" : "italic text-muted"}>{q.prompt}</p>
          </div>
          {Array.from({ length: q.answer_slots }, (_, i) => (
            <div key={i} className="flex gap-2">
              {q.answer_slots > 1 && <span className="w-5 pt-2 text-right text-sm text-muted">{i + 1}</span>}
              <textarea name={`a:${q.id}:${i + 1}`} defaultValue={q.answers[i] ?? ""} disabled={!editable}
                rows={q.answer_slots > 3 ? 1 : 2} maxLength={5000}
                className="field text-sm disabled:opacity-70" />
            </div>
          ))}
        </div>
      ))}
      {editable && (
        <div className="sticky bottom-3 flex items-center gap-3 rounded-lg border border-line bg-navy/95 p-3">
          <Submit>Save answers</Submit>
          <span className="text-xs text-muted">Save as you go. When every question is answered, initial below.</span>
        </div>
      )}
      <FormMessage state={state} />
    </form>
  );
}

export function TextTurnIn({ spId }: { spId: string }) {
  const [state, run] = useActionState(submitText.bind(null, spId), undefined);
  return (
    <form action={run} className="space-y-2">
      <label className="lbl" htmlFor="body">Type it here</label>
      <textarea id="body" name="body" className="field min-h-40" maxLength={50000} />
      <Submit variant="ghost">Turn in typed version</Submit>
      <FormMessage state={state} />
    </form>
  );
}

export function ReturnForm({ spId }: { spId: string }) {
  const [state, run] = useActionState(returnStep.bind(null, spId), undefined);
  return (
    <Card>
      <form action={run} className="space-y-2">
        <label className="lbl" htmlFor="note">Return with a note (required) — tell him exactly what to fix</label>
        <textarea id="note" name="note" required className="field min-h-24" maxLength={2000} />
        <Submit variant="danger" confirm="Return this item to him?">Return</Submit>
        <FormMessage state={state} />
      </form>
    </Card>
  );
}
