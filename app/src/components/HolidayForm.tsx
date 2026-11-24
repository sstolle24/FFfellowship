"use client";
import { useActionState } from "react";
import { setHoliday } from "@/app/leader/actions";
import { FormMessage, Submit } from "@/components/forms";
import type { Holiday } from "@/lib/holiday";

/** Admin: the home page holiday banner (0030). */
export function HolidayForm({ h, items, showing }: { h: Holiday | null; items: { id: string; title: string }[]; showing: boolean }) {
  const [state, run] = useActionState(setHoliday, undefined);
  return (
    <form action={run} className="grid gap-3 sm:grid-cols-2">
      <p className="text-sm text-muted sm:col-span-2">
        Shown on the home page: {showing ? <strong className="text-ink">yes, right now</strong> : "not right now"}.
        Automatic runs Nov 20 – Jan 6.
      </p>
      <div>
        <label className="lbl" htmlFor="hol-mode">Holiday banner</label>
        <select id="hol-mode" name="mode" defaultValue={h?.mode ?? "auto"} className="field">
          <option value="auto">Automatic (Nov 20 – Jan 6)</option>
          <option value="on">On now</option>
          <option value="off">Off</option>
        </select>
      </div>
      <div>
        <label className="lbl" htmlFor="hol-feat">Featured item (video or picture)</label>
        <select id="hol-feat" name="featured" defaultValue={h?.featured_event ?? ""} className="field">
          <option value="">None</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="lbl" htmlFor="hol-head">Headline</label>
        <input id="hol-head" name="headline" maxLength={120} defaultValue={h?.headline ?? ""} className="field" placeholder="Merry Christmas from Finally Free" />
      </div>
      <div className="sm:col-span-2">
        <label className="lbl" htmlFor="hol-msg">Message</label>
        <textarea id="hol-msg" name="message" maxLength={600} defaultValue={h?.message ?? ""} className="field min-h-20" />
      </div>
      <p className="text-xs text-muted sm:col-span-2">To feature Santa&apos;s video: post a public item below (e.g. &quot;A message from Santa&quot;), add the video to it, then pick it here.</p>
      <div className="sm:col-span-2"><Submit>Save holiday banner</Submit></div>
      <div className="sm:col-span-2"><FormMessage state={state} /></div>
    </form>
  );
}
