"use client";
import { useActionState } from "react";
import { saveEvent } from "@/app/leader/actions";
import { FormMessage, Submit } from "@/components/forms";
import type { CommunityEvent } from "@/lib/community";

const TZS = Intl.supportedValuesOf("timeZone");
const local = (iso: string | null, tz: string, part: "date" | "time") => {
  if (!iso) return "";
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, ...(part === "date" ? { year: "numeric", month: "2-digit", day: "2-digit" } : { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }) });
  return f.format(new Date(iso));
};

/** Leader: post or edit an event, prayer item or service opportunity. */
export function EventForm({ tz, event }: { tz: string; event?: CommunityEvent }) {
  const [state, run] = useActionState(saveEvent.bind(null, event?.id ?? null), undefined);
  const zone = event?.timezone ?? tz;
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-2" key={event ? undefined : state?.ok}>
      <div>
        <label className="lbl">Type</label>
        <select name="kind" defaultValue={event?.kind ?? "event"} className="field">
          <option value="event">Event</option><option value="prayer">Prayer</option><option value="service">Service</option>
        </select>
      </div>
      <div><label className="lbl">Title</label><input name="title" required maxLength={120} defaultValue={event?.title} className="field" /></div>
      <div className="sm:col-span-2"><label className="lbl">Details (optional)</label>
        <textarea name="body" maxLength={2000} defaultValue={event?.body ?? ""} className="field min-h-20" /></div>
      <div><label className="lbl">Date (optional — leave empty for prayer or ongoing)</label><input name="date" type="date" defaultValue={local(event?.starts_at ?? null, zone, "date")} className="field field-control" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="lbl">Starts</label><input name="start" type="time" defaultValue={local(event?.starts_at ?? null, zone, "time")} className="field field-control" /></div>
        <div><label className="lbl">Ends</label><input name="end" type="time" defaultValue={local(event?.ends_at ?? null, zone, "time")} className="field field-control" /></div>
      </div>
      <div><label className="lbl">Time zone</label>
        <select name="timezone" defaultValue={zone} className="field">{TZS.map((t) => <option key={t}>{t}</option>)}</select></div>
      <div><label className="lbl">Where (optional)</label><input name="location" maxLength={200} defaultValue={event?.location ?? ""} className="field" placeholder="e.g. Zoom, or the church address" /></div>
      <div className="sm:col-span-2"><label className="lbl">Link (optional)</label><input name="link" type="url" maxLength={500} defaultValue={event?.link ?? ""} className="field" placeholder="https://" /></div>
      <div className="sm:col-span-2">
        <label className="lbl">Video link (optional — YouTube or Vimeo)</label>
        <input name="video_url" type="url" maxLength={300} defaultValue={event?.video_url ?? ""} className="field" placeholder="https://youtu.be/… or https://vimeo.com/…" />
        <p className="mt-1 text-xs text-muted">To upload a video file instead, post the item first, then use &ldquo;Upload a video&rdquo; on it below.</p>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="members_only" defaultChecked={event?.members_only} className="accent-gold" /> Members only (not on the public site)</label>
      <p className="rounded-lg border border-amber-500/60 bg-amber-50 p-2 text-xs text-amber-950 sm:col-span-2">
        ⚠ Meeting videos: our meetings are anonymous. Only post a video if everyone shown or heard agreed, and keep it <strong>Members only</strong> unless it&apos;s meant for the public.
      </p>
      <div className="sm:col-span-2"><Submit>{event ? "Save changes" : "Post it"}</Submit></div>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
    </form>
  );
}
