import Image from "next/image";
import { ProsePage } from "@/components/Prose";
import { Card } from "@/components/ui";
import { KeyMeaning } from "@/components/KeyMeaning";
import { KEY_INFO, PROGRAM_PROMISE, type KeyInfo } from "@/lib/keys";

export const metadata = { title: "How the Program Works" };

const STEPS: [string, string, KeyInfo | null][] = [
  ["Module 0 — Welcome", "Sign up, get approved by a leader, and commit to the program. You can start attending meetings right away.", null],
  ["Key 1 — The 3 Videos", "Watch the three foundation videos and write a one-page reflection on each (you share it with your accountability partner (AP) and it goes to your leader). Then complete the Fishing worksheet and go over your notes and worksheet with your AP.", KEY_INFO.key_1],
  ["Key 2 — \"The 21\"", "Finally Free's virtual detox: 21 concrete actions — prayer, clearing your home, accountability software, disclosure, Steps 1–3, 90 meetings in 90 days, service, an AP, a sponsor, and more. Each item is initialed three times: by you, by your AP, and by a leader. Orange items are turned in.", KEY_INFO.key_2],
  ["Key 3 — Bill's Story", "Watch the movie \"My Name Is Bill W.\" and answer the timestamped questionnaire in two parts (minutes 1–59, then 59 to the end).", KEY_INFO.key_3],
  ["Certification", "Your Key 1 worksheet, Key 2 cover sheet and turn-ins, and Key 3 answers are assembled into a packet for leader review. Then you're Fellowship certified — and when a man you sponsor gets certified, you're ministry eligible.", null],
];

export default function HowItWorks() {
  return (
    <ProsePage title="How the Program Works" sub={'Finally Free\'s "3 Keys to Freedom."'}>
      <p className="text-lg text-ink">{PROGRAM_PROMISE}</p>
      <a href="/brand/3-keys-to-freedom.webp" target="_blank" rel="noopener noreferrer" className="block !no-underline" aria-label="Finally Free's 3 Keys to Freedom — open full size">
        <Image src="/brand/3-keys-to-freedom.webp" width={1280} height={960} priority sizes="(min-width: 768px) 720px, 100vw"
          className="h-auto w-full rounded-xl border border-line shadow-sm"
          alt="Finally Free's 3 Keys to Freedom. Key 1: watch 3 Zoom videos and do the worksheet — in the Kingdom, real repentance. Key 2: complete the 21 detox worksheets — putting on the full armour. Key 3: watch Bill's movie and do the questionnaire — preparing for the harvest. The program gets you sober now, can be done in as little as 2–4 weeks, and works with Conquerors and all 12-step programs." />
      </a>
      <div className="space-y-4">
        {STEPS.map(([t, d, info], i) => (
          <Card key={t} className="flex gap-4">
            <span className="display text-2xl text-gold">{i}</span>
            <div className="min-w-0">
              <h2 className="!mt-0 text-lg">{t}</h2>
              {info && <KeyMeaning info={info} className="mt-2" />}
              <p className="mt-1 text-muted">{d}</p>
            </div>
          </Card>
        ))}
      </div>
      <p>
        The keys go in order. Key 1&apos;s videos come one at a time; Key 2&apos;s 21 items all open together, and your
        AP reviews them with you at #20. Key 3 opens once you&apos;ve done your part of 16 of the 21. Every step happens in community — daily meetings, daily contact with your AP, and
        brothers a phone call away.
      </p>
    </ProsePage>
  );
}
