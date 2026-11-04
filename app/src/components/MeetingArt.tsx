import Image from "next/image";

/** A meeting's image: a thumbnail that opens the full picture. */
export function MeetingArt({ url, name, size = "sm" }: { url: string; name: string; size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "h-14 w-14", md: "h-24 w-24 sm:h-28 sm:w-28", lg: "h-40 w-auto max-w-full" }[size];
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block shrink-0" aria-label={`${name} — open image`}>
      <Image src={url} alt="" width={size === "lg" ? 480 : 224} height={size === "lg" ? 320 : 224} unoptimized
        className={`${cls} rounded-lg border border-line object-cover`} />
    </a>
  );
}
