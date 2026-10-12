"use client";
import { useActionState } from "react";
import { saveFishing } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";

type C = { name: string; method: string | null; note: string | null } | null;

export function FishingSlot({ slot, current }: { slot: number; current: C }) {
  const [state, run] = useActionState(saveFishing.bind(null, slot), undefined);
  return (
    <form action={run} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[2rem_1fr_9rem_1fr_auto] sm:items-center">
      <span className={`display text-xl ${current ? "text-gold" : "text-muted"}`}>{slot}</span>
      <input name="name" defaultValue={current?.name ?? ""} placeholder="Who did you reach out to?" className="field" maxLength={80} />
      <select name="method" defaultValue={current?.method ?? ""} className="field">
        <option value="">How?</option><option>Call</option><option>Text</option><option>Signal</option><option>In person</option><option>Meeting</option>
      </select>
      <input name="note" defaultValue={current?.note ?? ""} placeholder="Note" className="field" maxLength={500} />
      <Submit variant="ghost">Save</Submit>
      <div className="sm:col-span-5"><FormMessage state={state} /></div>
    </form>
  );
}
