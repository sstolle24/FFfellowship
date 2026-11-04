/** Public URL of a meeting's image (the meeting-art bucket is public). */
export function meetingArtUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/meeting-art/${path.split("/").map(encodeURIComponent).join("/")}`;
}
