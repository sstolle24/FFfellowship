/** URL of a meeting's image: one shipped with the site ("static/<name>.webp"), or an upload in the public meeting-art bucket. */
export function meetingArtUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("static/")) return `/meeting-art/${path.slice(7)}`;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/meeting-art/${path.split("/").map(encodeURIComponent).join("/")}`;
}
