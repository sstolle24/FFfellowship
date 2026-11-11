"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { eventVideoTicket, setEventVideo } from "@/app/leader/actions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Notice } from "@/components/ui";

/** Leader: upload, replace or remove the video on a What's Happening item. */
export function EventVideoForm({ eventId, title, videoPath, membersOnly }: { eventId: string; title: string; videoPath: string | null; membersOnly: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const router = useRouter();

  async function upload() {
    const f = input.current?.files?.[0];
    if (!f) return setMsg({ error: "Choose a video first." });
    if (!membersOnly && !window.confirm(`"${title}" is public. Anyone on the website will be able to watch this video. Continue?`)) return;
    setBusy(true); setMsg({});
    try {
      const t = await eventVideoTicket(eventId, f.name);
      if (!t.token || !t.path) throw new Error(t.error ?? "Upload failed.");
      const { error } = await supabaseBrowser().storage.from("community-video").uploadToSignedUrl(t.path, t.token, f, { contentType: t.type });
      if (error) {
        throw new Error(/size|large|exceed|413/i.test(error.message)
          ? "That video is too big for your storage plan (50 MB on Supabase's free plan). Shorten it, or put it on YouTube or Vimeo and paste the link instead."
          : error.message);
      }
      const r = await setEventVideo(eventId, t.path);
      if (r?.error) throw new Error(r.error);
      setMsg({ ok: "Video saved." });
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm(`Remove the video from "${title}"?`)) return;
    setBusy(true);
    setMsg((await setEventVideo(eventId, null)) ?? {});
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <p className="lbl">Upload a video (MP4, MOV or WebM)</p>
      {videoPath && <p className="text-sm text-muted">On file: {videoPath.split("/").pop()}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm" className="text-sm" aria-label={`Video for ${title}`} />
        <Button type="button" variant="ghost" onClick={upload} disabled={busy}>{busy ? "Uploading…" : videoPath ? "Replace video" : "Upload video"}</Button>
        {videoPath && <Button type="button" variant="quiet" onClick={remove} disabled={busy}>Remove</Button>}
      </div>
      <p className="text-xs text-muted">Large videos can take a few minutes — keep this page open. Supabase&apos;s free plan takes files up to 50 MB; for longer videos use a YouTube or Vimeo link.</p>
      {msg.error && <Notice tone="danger">{msg.error}</Notice>}
      {msg.ok && <Notice>{msg.ok}</Notice>}
    </div>
  );
}
