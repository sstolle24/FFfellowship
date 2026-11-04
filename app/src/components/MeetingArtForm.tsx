"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { meetingArtTicket, setMeetingArt } from "@/app/leader/actions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { meetingArtUrl } from "@/lib/meeting-art";
import { Button, Notice } from "@/components/ui";
import { MeetingArt } from "@/components/MeetingArt";

const MAX = 5 * 1024 * 1024;

/** Leader: upload, replace or remove a meeting's image. */
export function MeetingArtForm({ meetingId, name, artPath }: { meetingId: string; name: string; artPath: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const router = useRouter();

  async function upload() {
    const f = input.current?.files?.[0];
    if (!f) return setMsg({ error: "Choose an image first." });
    if (f.size > MAX) return setMsg({ error: "That image is over 5 MB." });
    setBusy(true); setMsg({});
    try {
      const t = await meetingArtTicket(meetingId, f.name);
      if (!t.token || !t.path) throw new Error(t.error ?? "Upload failed.");
      const { error } = await supabaseBrowser().storage.from("meeting-art").uploadToSignedUrl(t.path, t.token, f, { contentType: t.type });
      if (error) throw new Error(error.message);
      const r = await setMeetingArt(meetingId, t.path);
      if (r?.error) throw new Error(r.error);
      setMsg({ ok: "Image saved." });
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm(`Remove the image for ${name}?`)) return;
    setBusy(true);
    const r = await setMeetingArt(meetingId, null);
    setBusy(false);
    setMsg(r ?? {});
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <p className="lbl">Meeting image (shown on the schedule)</p>
      {artPath && <MeetingArt url={meetingArtUrl(artPath)!} name={name} size="lg" />}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp" className="text-sm" aria-label={`Image for ${name}`} />
        <Button type="button" variant="ghost" onClick={upload} disabled={busy}>{busy ? "Working…" : artPath ? "Replace image" : "Upload image"}</Button>
        {artPath && <Button type="button" variant="quiet" onClick={remove} disabled={busy}>Remove</Button>}
      </div>
      <p className="text-xs text-muted">JPG, PNG or WebP, up to 5 MB. Anyone can see it, like the schedule — no Zoom details in the image.</p>
      {msg.error && <Notice tone="danger">{msg.error}</Notice>}
      {msg.ok && <Notice>{msg.ok}</Notice>}
    </div>
  );
}
