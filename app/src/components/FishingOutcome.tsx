"use client";
import { useActionState } from "react";
import { saveFishingOutcome } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";

/** After he reaches out: how it went, and whether he reached him. */
export function FishingOutcome({ weekStart, slot, name, outcome, reached }: {
  weekStart: string; slot: number; name: string; outcome: string | null; reached: boolean;
}) {
  const [state, run] = useActionState(saveFishingOutcome.bind(null, weekStart, slot), undefined);
  return (
    <form action={run} className="grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
      <input name="outcome" defaultValue={outcome ?? ""} maxLength={500} className="field"
        placeholder={`How did it go with ${name}?`} aria-label={`How did it go with ${name}?`} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reached" defaultChecked={reached} className="accent-gold" /> Reached him</label>
      <Submit variant="ghost">Save</Submit>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}
