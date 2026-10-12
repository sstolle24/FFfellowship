import { ProsePage } from "@/components/Prose";
import { Card } from "@/components/ui";

export const metadata = { title: "How the Program Works" };

const STEPS = [
  ["Module 0 — Welcome", "Sign up, get approved by a leader, and commit to the program. You can start attending meetings right away."],
  ["Key 1 — The 3 Videos", "Watch the three foundation videos, take notes, and complete the Permanent / Real Sobriety (\"Fishing\") worksheet. Then go over your notes and worksheet with your accountability partner (AP)."],
  ["Key 2 — \"The 21\"", "Finally Free's virtual detox: 21 concrete actions — prayer, clearing your home, accountability software, disclosure, Steps 1–3, 90 meetings in 90 days, service, an AP, a sponsor, and more. Each item is initialed three times: by you, by your AP, and by a leader. Orange items are turned in."],
  ["Key 3 — Bill's Story", "Watch the Bill W. movie and answer the timestamped questionnaire in two parts (minutes 1–59, then 59 to the end)."],
  ["Certification", "Your Key 1 worksheet, Key 2 cover sheet and turn-ins, and Key 3 answers are assembled into a packet for leader review. Then you're Fellowship certified — and when a man you sponsor gets certified, you're ministry eligible."],
];

export default function HowItWorks() {
  return (
    <ProsePage title="How the Program Works" sub={'Finally Free\'s "3 Keys to Freedom."'}>
      <div className="space-y-4">
        {STEPS.map(([t, d], i) => (
          <Card key={t} className="flex gap-4">
            <span className="display text-2xl text-gold">{i}</span>
            <div>
              <h2 className="!mt-0 text-lg">{t}</h2>
              <p className="mt-1 text-muted">{d}</p>
            </div>
          </Card>
        ))}
      </div>
      <p>
        Many men complete most of The 21 within a week. Every step happens in community — daily meetings, daily
        contact with your AP, and brothers a phone call away.
      </p>
    </ProsePage>
  );
}
