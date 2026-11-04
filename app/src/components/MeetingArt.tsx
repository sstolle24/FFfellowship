import Image from "next/image";

/** A meeting's image: a thumbnail that opens the full picture. */
export function MeetingArt({ url, name, size = "sm" }: { url: string; name: string; size?: "sm" | "md" | "lg" }) {
  // md: a full-width banner on phones, a thumbnail beside the text from sm up.
  const cls = { sm: "h-14 w-14", md: "aspect-video w-full sm:aspect-square sm:h-28 sm:w-28", lg: "h-40 w-auto max-w-full" }[size];
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={`block shrink-0 ${size === "md" ? "basis-full sm:basis-auto" : ""}`} aria-label={`${name} — open image`}>
      <Image src={url} alt="" width={size === "sm" ? 112 : 640} height={size === "sm" ? 112 : 360} unoptimized
        className={`${cls} rounded-lg border border-line object-cover`} />
    </a>
  );
}
