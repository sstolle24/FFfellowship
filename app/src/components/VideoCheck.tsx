"use client";
import { useActionState } from "react";
import { saveVideo } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";

export function VideoCheck({ videoId, watched, notes, checkable }: { videoId: string; watched: boolean; notes: string; checkable: boolean }) {
  const [state, run] = useActionState(saveVideo.bind(null, videoId), undefined);
  return (
    <form action={run} className="mt-3 space-y-2">
      <textarea name="notes" defaultValue={notes} placeholder="Your notes" className="field min-h-20 text-sm" maxLength={10000} />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="watched" defaultChecked={watched} className="accent-[#c9973a]" />
          {checkable ? "I watched it" : "Watched it"}
        </label>
        <Submit variant="ghost" className="px-3 py-1">Save</Submit>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
