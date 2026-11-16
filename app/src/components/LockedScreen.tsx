"use client";
import { useActionState } from "react";
import Link from "next/link";
import { requestUnlock } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";
import { Card } from "@/components/ui";

/** What a locked man sees instead of the member area (0028). */
export function LockedScreen({ first, suspendedUntil, requested }: { first: string; suspendedUntil: string | null; requested: boolean }) {
  const [state, run] = useActionState(requestUnlock, undefined);
  const until = suspendedUntil
    ? new Date(`${suspendedUntil}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    : null;
  return (
    <Card className="mx-auto max-w-xl space-y-4">
      <h1 className="display text-2xl text-gold">Your account is locked</h1>
      {until ? (
        <p>{first}, your place in the program is suspended until <strong>{until}</strong>. After that date, contact a leader to come back.</p>
      ) : (
        <p>{first}, your account was locked after 14 days without activity. Men working their keys need to stay active. Contact a leader to talk it through and get unlocked.</p>
      )}
      <p className="text-sm text-muted">Your program work is saved. Keep going to meetings in the meantime — the schedule is on the <Link href="/meetings" className="text-gold underline">Meetings page</Link>.</p>
      <form action={run} className="space-y-2 border-t border-line pt-4">
        <label className="lbl" htmlFor="unlock-msg">Message for the leaders (optional)</label>
        <textarea id="unlock-msg" name="message" maxLength={1000} className="field min-h-20"
          placeholder="What's been going on, and the best way to reach you" />
        <Submit>Ask a leader to unlock</Submit>
        {requested && !state && <p className="text-xs text-muted">You&apos;ve already asked. A leader will be in touch.</p>}
        <FormMessage state={state} />
      </form>
      <p className="text-sm">Struggling right now? <Link href="/get-help" className="text-gold underline">Get help</Link></p>
    </Card>
  );
}
