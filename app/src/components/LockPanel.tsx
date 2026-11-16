"use client";
import { useActionState } from "react";
import { suspendMember, unlockMember } from "@/app/leader/actions";
import { ActionButton, FormMessage, Submit } from "@/components/forms";
import { Card } from "@/components/ui";

/** Leader view of a locked man (0028): unlock him, or suspend him for 6 months. */
export function LockPanel({ manId, first, reason, lockedAt, suspendedUntil, requestedAt }: {
  manId: string; first: string; reason: string | null | undefined; lockedAt: string; suspendedUntil: string | null | undefined; requestedAt: string | null | undefined;
}) {
  const [state, run] = useActionState(suspendMember.bind(null, manId), undefined);
  const d = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const suspended = reason === "suspended";
  const over = suspendedUntil ? suspendedUntil <= new Date().toISOString().slice(0, 10) : false;
  return (
    <Card className="space-y-3 border-amber-500/70 text-sm">
      <h2 className="text-lg text-gold">{suspended ? "Suspended" : "Account locked"}</h2>
      <p>
        {suspended
          ? <>{first} is suspended until <strong>{d(suspendedUntil!)}</strong>{over ? " — the suspension is over; unlock him when he's ready." : "."}</>
          : <>{first} was locked on {d(lockedAt)} after 14 days without activity. Talk with him, then unlock him or, depending on the reason, suspend him for 6 months.</>}
      </p>
      {requestedAt && <p className="text-muted">He asked to be unlocked on {d(requestedAt)}.</p>}
      <ActionButton run={unlockMember.bind(null, manId)}
        confirm={suspended && !over ? `End ${first}'s suspension early and unlock him?` : `Unlock ${first}? His 14-day clock starts over.`}>
        {suspended && !over ? "End suspension and unlock" : "Unlock account"}
      </ActionButton>
      {!suspended && (
        <form action={run} className="space-y-2 border-t border-line pt-3">
          <label className="lbl" htmlFor="suspend-reason">Reason for a 6-month suspension (leaders only)</label>
          <textarea id="suspend-reason" name="reason" required maxLength={1000} className="field min-h-16" />
          <Submit variant="danger" confirm={`Suspend ${first} from the program for 6 months? He stays locked until a leader unlocks him.`}>Suspend 6 months</Submit>
          <FormMessage state={state} />
        </form>
      )}
    </Card>
  );
}
