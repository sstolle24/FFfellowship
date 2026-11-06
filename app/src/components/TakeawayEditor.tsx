"use client";
import { useActionState } from "react";
import { saveNote, saveTakeaway } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";

/**
 * Write or change a takeaway: for a logged meeting (logId), or a note not tied
 * to a meeting (entryId, or neither for a new note).
 */
export function TakeawayEditor({ logId, entryId, insight, body, shared, label, open = false, compact = true }: {
  logId?: string; entryId?: string; insight: string | null; body: string | null; shared: boolean;
  label?: string; open?: boolean; compact?: boolean;
}) {
  const action = logId ? saveTakeaway.bind(null, logId) : saveNote.bind(null, entryId ?? null);
  const [state, run] = useActionState(action, undefined);
  const has = !!(insight || body);
  const notes = body && body !== insight ? body : "";
  const isNew = !logId && !entryId;
  return (
    <details className="no-print mt-1" open={open}>
      <summary className={compact ? "cursor-pointer text-xs text-gold" : "cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-gold hover:border-gold"}>
        {label ?? (has ? "Edit takeaway" : "Add a takeaway")}
      </summary>
      <form action={run} className="mt-2 grid gap-2" key={isNew && state?.ok ? state.ok + Date.now() : undefined}>
        <input name="key_insight" defaultValue={insight ?? ""} maxLength={500} className="field" placeholder="Key takeaway (a short title)" aria-label="Key takeaway" />
        <textarea name="takeaway" defaultValue={notes} maxLength={20000} className="field min-h-28"
          placeholder={logId ? "Notes: what did you hear? What will you do with it?" : "What did you read or hear? What will you do with it?"} aria-label="Notes" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="shared" defaultChecked={shared} className="accent-gold" /> Share with my AP / sponsor</label>
          <Submit variant="ghost">{isNew ? "Add note" : "Save"}</Submit>
        </div>
        {has && <p className="text-xs text-muted">Clear both boxes and save to remove it.</p>}
        <FormMessage state={state} />
      </form>
    </details>
  );
}
