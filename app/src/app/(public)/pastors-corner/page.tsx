import { ProsePage } from "@/components/Prose";

export const metadata = { title: "Pastor's Corner" };

// TODO(Steven): replace with the pastor's current message.
export default function PastorsCorner() {
  return (
    <ProsePage title="Pastor's Corner" sub="A word of encouragement for the men of the Fellowship.">
      <blockquote className="border-l-2 border-gold pl-4 italic text-muted">
        &ldquo;Seek ye first the Kingdom of God and his righteousness, and all these things shall be added unto you.&rdquo;
        — Matthew 6:33
      </blockquote>
      <p>
        Freedom starts with priority. Every man who has walked out of this addiction did it by putting God and his
        recovery first — before work, before comfort, before pride. Today, choose that again.
      </p>
    </ProsePage>
  );
}
