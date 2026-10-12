"use client";
import { useActionState } from "react";
import { saveVideoLink } from "@/app/leader/actions";
import { FormMessage, Submit } from "@/components/forms";

/** Leader form for one program video's link and passcode. */
export function VideoLinkForm({ videoId, url, passcode }: { videoId: string; url: string; passcode: string }) {
  const [state, run] = useActionState(saveVideoLink.bind(null, videoId), undefined);
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
      <div>
        <label className="lbl" htmlFor={`url-${videoId}`}>Link (Zoom recording or Vimeo)</label>
        <input id={`url-${videoId}`} name="url" type="url" defaultValue={url} placeholder="https://…" className="field" autoComplete="off" />
      </div>
      <div>
        <label className="lbl" htmlFor={`pc-${videoId}`}>Passcode (optional)</label>
        <input id={`pc-${videoId}`} name="passcode" defaultValue={passcode} className="field font-mono" maxLength={100} autoComplete="off" />
      </div>
      <Submit variant="ghost">Save</Submit>
      <div className="sm:col-span-3"><FormMessage state={state} /></div>
    </form>
  );
}
