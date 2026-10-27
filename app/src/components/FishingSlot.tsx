"use client";
import { useActionState } from "react";
import { saveFishing } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";

type C = { name: string; method: string | null; note: string | null } | null;

/** One of his 3 men for the week: who, how, and what he's going to do. Names lock once the week is committed. */
export function FishingSlot({ slot, current, committed = false }: { slot: number; current: C; committed?: boolean }) {
  const [state, run] = useActionState(saveFishing.bind(null, slot), undefined);
  return (
    <form action={run} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[2rem_1fr_9rem_1fr_auto] sm:items-center">
      <span className={`display text-xl ${current ? "text-gold" : "text-muted"}`}>{slot}</span>
      <input name="name" defaultValue={current?.name ?? ""} placeholder="Who are you going to reach out to?" aria-label={`Man ${slot}: who are you going to reach out to?`}
        className="field read-only:opacity-80" maxLength={80} readOnly={committed} />
      <select name="method" defaultValue={current?.method ?? ""} className="field" aria-label={`Man ${slot}: how?`}>
        <option value="">How?</option><option>Call</option><option>Text</option><option>Signal</option><option>In person</option><option>Meeting</option>
      </select>
      <input name="note" defaultValue={current?.note ?? ""} placeholder="What are you going to do?" aria-label={`Man ${slot}: what are you going to do?`} className="field" maxLength={500} />
      <Submit variant="ghost">Save</Submit>
      <div className="sm:col-span-5"><FormMessage state={state} /></div>
    </form>
  );
}
