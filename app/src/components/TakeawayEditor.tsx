"use client";
import { useActionState } from "react";
import { saveTakeaway } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";

/** Add or change the takeaway for one logged meeting, right in the 90 in 90 log. */
export function TakeawayEditor({ logId, insight, body, shared }: {
  logId: string; insight: string | null; body: string | null; shared: boolean;
}) {
  const [state, run] = useActionState(saveTakeaway.bind(null, logId), undefined);
  const has = !!(insight || body);
  const notes = body && body !== insight ? body : "";
  return (
    <details className="no-print mt-1">
      <summary className="cursor-pointer text-xs text-gold">{has ? "Edit takeaway" : "Add a takeaway"}</summary>
      <form action={run} className="mt-2 grid gap-2">
        <input name="key_insight" defaultValue={insight ?? ""} maxLength={500} className="field" placeholder="Key takeaway" aria-label="Key takeaway" />
        <textarea name="takeaway" defaultValue={notes} maxLength={20000} className="field min-h-20" placeholder="Notes: what did you hear? What will you do with it?" aria-label="Notes" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shared" defaultChecked={shared} className="accent-gold" /> Share with my AP / sponsor</label>
          <Submit variant="ghost">Save takeaway</Submit>
        </div>
        {has && <p className="text-xs text-muted">Clear both boxes and save to remove it.</p>}
        <FormMessage state={state} />
      </form>
    </details>
  );
}
