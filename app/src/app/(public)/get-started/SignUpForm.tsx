"use client";
import { useActionState, useEffect, useState } from "react";
import { signUp } from "../auth-actions";
import { FormMessage, Submit } from "@/components/forms";
import { Turnstile } from "@/components/Turnstile";

export function SignUpForm({ siteKey }: { siteKey: string }) {
  const [state, run] = useActionState(signUp, undefined);
  const [tz, setTz] = useState("America/Chicago");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago"), []);
  if (state?.ok) return <FormMessage state={state} />;
  return (
    <form action={run} className="space-y-4">
      <input type="hidden" name="timezone" value={tz} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="lbl" htmlFor="first_name">First name</label><input className="field" id="first_name" name="first_name" required maxLength={40} autoComplete="given-name" /></div>
        <div><label className="lbl" htmlFor="email">Email</label><input className="field" id="email" name="email" type="email" required autoComplete="email" /></div>
        <div><label className="lbl" htmlFor="password">Password (10+ characters)</label><input className="field" id="password" name="password" type="password" minLength={10} required autoComplete="new-password" /></div>
        <div><label className="lbl" htmlFor="sobriety_start_date">Sobriety date (if you have one)</label><input className="field" id="sobriety_start_date" name="sobriety_start_date" type="date" /></div>
        <div><label className="lbl" htmlFor="city">City (optional)</label><input className="field" id="city" name="city" maxLength={60} /></div>
        <div><label className="lbl" htmlFor="country">Country</label><input className="field" id="country" name="country" maxLength={60} /></div>
      </div>
      <div><label className="lbl" htmlFor="heard_about">How did you hear about us?</label><input className="field" id="heard_about" name="heard_about" maxLength={200} /></div>
      <div>
        <label className="lbl" htmlFor="intake_reason">What brings you here? (Only leaders see this.)</label>
        <textarea className="field min-h-28" id="intake_reason" name="intake_reason" maxLength={2000} />
      </div>
      <Turnstile siteKey={siteKey} />
      <FormMessage state={state} />
      <Submit className="w-full py-3">Sign up</Submit>
      <p className="text-center text-xs text-muted">Your city is only ever shared with members if you turn that on later.</p>
    </form>
  );
}
