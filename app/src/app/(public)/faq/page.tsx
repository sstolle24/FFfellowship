import { ProsePage } from "@/components/Prose";

export const metadata = { title: "FAQ" };

const FAQ: [string, string][] = [
  ["Who is this for?", "Men who want freedom from sexual addiction and are willing to follow a Christ-centered, peer-led program."],
  ["Does it cost anything?", "No. Meetings and the program are free. Some resources (books, accountability software) have small costs; we have group rates."],
  ["Is it confidential?", "Yes. What's said in meetings stays there. In this app, your work is visible only to you, your active AP or sponsor, and fellowship leaders. Nothing about you is public."],
  ["Do I have to be a Christian?", "We're openly Christ-centered. You're welcome wherever you are in your faith, as long as you're willing to walk the program."],
  ["What's an AP?", "Your accountability partner — a brother walking the program alongside you, talking daily, and initialing your items."],
  ["How fast can I finish The 21?", "Many men complete most of it within 3 days to a week. Some items, like your sponsor (#18), have their own deadlines."],
  ["What if I relapse?", "Tell your AP and keep coming. Reset your day count in your profile and get back to it. Honesty is the program."],
];

export default function Faq() {
  return (
    <ProsePage title="Frequently Asked Questions">
      {FAQ.map(([q, a]) => (
        <div key={q}>
          <h2 className="!mt-4 text-lg">{q}</h2>
          <p className="text-muted">{a}</p>
        </div>
      ))}
    </ProsePage>
  );
}
