import Link from "next/link";
import { ProsePage } from "@/components/Prose";
import { Card } from "@/components/ui";
import { env } from "@/lib/env";

export const metadata = { title: "Get Help Now" };

export default function GetHelp() {
  return (
    <ProsePage title="Get Help Now" sub="If you're in danger or thinking about ending your life, get help right now.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-danger/60">
          <h2 className="!mt-0 text-lg">Emergency</h2>
          <p className="text-muted">If you or someone else is in immediate danger, call <strong className="text-ink">911</strong> (US) or your local emergency number.</p>
        </Card>
        <Card className="border-danger/60">
          <h2 className="!mt-0 text-lg">988 Suicide &amp; Crisis Lifeline</h2>
          <p className="text-muted">Call or text <strong className="text-ink">988</strong> in the US, any time. Outside the US, find a line at <a href="https://findahelpline.com" rel="noopener noreferrer" target="_blank">findahelpline.com</a>.</p>
        </Card>
      </div>
      <h2>Fighting an urge right now?</h2>
      <ul>
        <li>Get up and leave the room you&apos;re in. Go where people are.</li>
        <li>Call a brother. Members: hit the Panic Button on your dashboard — it alerts your AP, sponsor and leader at once.</li>
        <li>Jump into the next meeting. They run every day — <Link href="/meetings">see the schedule</Link>.</li>
        <li>Pray: ask God for just this one day.</li>
      </ul>
      <h2>New here?</h2>
      <p>
        <Link href="/get-started">Sign up</Link> and a leader will welcome you. You can attend meetings while you wait.
        {env.contactEmail && <> Questions? Email <a href={`mailto:${env.contactEmail}`}>{env.contactEmail}</a>.</>}
      </p>
    </ProsePage>
  );
}
