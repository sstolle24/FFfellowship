"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { eventImageTicket, setEventImage } from "@/app/leader/actions";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { Button, Notice } from "@/components/ui";

/** Leader: upload, replace or remove the picture on a What's Happening item (0029). */
export function EventImageForm({ eventId, title, imagePath, membersOnly }: { eventId: string; title: string; imagePath: string | null; membersOnly: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const router = useRouter();

  async function upload() {
    const f = input.current?.files?.[0];
    if (!f) return setMsg({ error: "Choose a picture first." });
    if (f.size > 10 * 1024 * 1024) return setMsg({ error: "That picture is over 10 MB. Use a smaller one." });
    if (!membersOnly && !window.confirm(`"${title}" is public. Anyone on the website will see this picture. Continue?`)) return;
    setBusy(true); setMsg({});
    try {
      const t = await eventImageTicket(eventId, f.name);
      if (!t.token || !t.path) throw new Error(t.error ?? "Upload failed.");
      const { error } = await supabaseBrowser().storage.from("community-image").uploadToSignedUrl(t.path, t.token, f, { contentType: t.type });
      if (error) throw new Error(error.message);
      const r = await setEventImage(eventId, t.path);
      if (r?.error) throw new Error(r.error);
      setMsg({ ok: "Picture saved." });
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!window.confirm(`Remove the picture from "${title}"?`)) return;
    setBusy(true);
    setMsg((await setEventImage(eventId, null)) ?? {});
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <p className="lbl">Upload a picture (JPG, PNG, WebP or GIF, up to 10 MB)</p>
      {imagePath && <p className="text-sm text-muted">On file: {imagePath.split("/").pop()}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif" className="text-sm" aria-label={`Picture for ${title}`} />
        <Button type="button" variant="ghost" onClick={upload} disabled={busy}>{busy ? "Uploading…" : imagePath ? "Replace picture" : "Upload picture"}</Button>
        {imagePath && <Button type="button" variant="quiet" onClick={remove} disabled={busy}>Remove</Button>}
      </div>
      {msg.error && <Notice tone="danger">{msg.error}</Notice>}
      {msg.ok && <Notice>{msg.ok}</Notice>}
    </div>
  );
}
