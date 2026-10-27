"use client";
import { createBrowserClient } from "@supabase/ssr";
import { uploadTicket } from "@/app/app/actions";

/** Browser client — used only for direct-to-storage uploads into the man's own
 *  folder (storage policies enforce that). Everything else goes through server actions. */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/** Uploads a file to {his id}/… in the submissions bucket with a one-time pass from the server. */
export async function uploadOwnFile(path: string, file: File, contentType: string) {
  const t = await uploadTicket(path);
  if (!t.token) throw new Error(t.error ?? "Upload failed.");
  const { error } = await supabaseBrowser().storage.from("submissions").uploadToSignedUrl(path, t.token, file, { contentType });
  if (error) throw new Error(error.message);
}
