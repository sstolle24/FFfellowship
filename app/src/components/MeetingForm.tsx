"use client";
import { useActionState } from "react";
import { saveMeeting } from "@/app/leader/actions";
import { FormMessage, Submit } from "@/components/forms";
import { DAYS } from "@/lib/time";
import type { Meeting } from "@/lib/types";

const TZS = Intl.supportedValuesOf("timeZone");

/** Times are the meeting's own (e.g. 5:00 PM Pacific), kept across daylight saving; members see them in their zone. */
export function MeetingForm({ tz, meeting }: { tz: string; meeting?: Meeting }) {
  const [state, run] = useActionState(saveMeeting.bind(null, meeting?.id ?? null), undefined);
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2"><label className="lbl">Name</label><input name="name" required defaultValue={meeting?.name} className="field" maxLength={80} /></div>
      <div>
        <label className="lbl">Day</label>
        <select name="local_day" defaultValue={meeting?.local_day ?? 0} className="field">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
      </div>
      <div><label className="lbl">Start time</label><input name="local_time" type="time" required defaultValue={meeting?.local_time?.slice(0, 5)} className="field" /></div>
      <div className="sm:col-span-2">
        <label className="lbl">Time zone of the meeting</label>
        <select name="timezone" defaultValue={meeting?.timezone ?? tz} className="field">{TZS.map((t) => <option key={t}>{t}</option>)}</select>
        <p className="mt-1 text-xs text-muted">It stays at this local time all year (daylight saving included). Members see it in their own time zone.</p>
      </div>
      <div className="sm:col-span-2"><label className="lbl">Tagline</label><input name="tagline" defaultValue={meeting?.tagline ?? ""} className="field" maxLength={200} /></div>
      <div className="sm:col-span-2"><label className="lbl">Zoom link (members only)</label><input name="zoom_url" type="url" defaultValue={meeting?.zoom_url ?? ""} className="field" /></div>
      <div><label className="lbl">Meeting ID</label><input name="zoom_id" defaultValue={meeting?.zoom_id ?? ""} className="field" maxLength={40} /></div>
      <div><label className="lbl">Passcode</label><input name="zoom_password" defaultValue={meeting?.zoom_password ?? ""} className="field" maxLength={60} autoComplete="off" /></div>
      <div><label className="lbl">Secretary (first name)</label><input name="secretary_first_name" defaultValue={meeting?.secretary_first_name ?? ""} className="field" maxLength={40} /></div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="beginner" defaultChecked={meeting?.beginner} className="accent-gold" /> Beginner</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={meeting?.active ?? true} className="accent-gold" /> Active</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="temp_closed" defaultChecked={meeting?.temp_closed} className="accent-gold" /> Temporarily closed</label>
      </div>
      <div className="sm:col-span-2">
        <label className="lbl">Closed note (optional)</label>
        <input name="closed_note" defaultValue={meeting?.closed_note ?? ""} className="field" maxLength={120} placeholder="e.g. Back in January" />
      </div>
      <p className="text-xs text-muted sm:col-span-2">
        Temporarily closed keeps the meeting on the schedule, marked closed, with no Join button. Untick Active to take it off the schedule entirely.
      </p>
      <div className="sm:col-span-2"><Submit>{meeting ? "Save changes" : "Add meeting"}</Submit></div>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
    </form>
  );
}
