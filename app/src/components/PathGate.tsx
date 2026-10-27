import Link from "next/link";
import { PathWeek } from "@/components/PathWeek";
import { PanicButton } from "@/components/PanicButton";

type Contact = { slot: number; name: string; method: string | null; note: string | null };

/**
 * "The Path" (after Key 1): every week, before using the member area, he names
 * his 3 men and commits them. This box stays until he does. Help and the Panic
 * Button are always reachable from it.
 */
export function PathGate({ firstName, weekStart, contacts, signalUrl, logOut }: {
  firstName: string; weekStart: string; contacts: Contact[]; signalUrl: string; logOut: () => Promise<void>;
}) {
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="path-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-navy/95 px-4 py-8 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl space-y-5 rounded-2xl border border-gold/50 bg-panel p-5 shadow-2xl md:p-8">
        <div>
          <div className="display text-sm tracking-[0.3em] text-gold">The Path</div>
          <h1 id="path-title" className="mt-2 text-2xl text-ink md:text-3xl">{firstName}, who are your 3 this week?</h1>
        </div>
        <p className="max-w-prose text-ink">
          Stop. <strong>Pray, meditate and listen</strong> for 3 men God puts on your heart. Then name them below — who you&apos;re
          going to reach out to, how, and what you&apos;re going to do — and commit. Your account opens again as soon as you do.
        </p>
        <p className="max-w-prose text-sm text-muted">We go over these together for accountability at The Path on Monday night.</p>
        <PathWeek weekStart={weekStart} contacts={contacts} committedAt={null} />
        <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <PanicButton signalUrl={signalUrl} />
          <div className="flex gap-4 text-sm sm:flex-col sm:text-right">
            <Link href="/get-help" className="text-gold underline">Get help now</Link>
            <form action={logOut}><button className="text-muted hover:text-gold">Log out</button></form>
          </div>
        </div>
      </div>
    </div>
  );
}
