import { splitScripture } from "@/lib/kjv";
import { VerseRef } from "@/components/VerseRef";

/** Text with its scripture references made tappable (KJV). */
export function Scripture({ text, above }: { text: string; above?: boolean }) {
  return <>{splitScripture(text).map((p, i) => (typeof p === "string" ? p : <VerseRef key={i} label={p.label} refName={p.ref} text={p.text} above={above} />))}</>;
}
