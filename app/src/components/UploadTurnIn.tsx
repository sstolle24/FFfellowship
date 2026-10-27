"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadOwnFile } from "@/lib/supabase/browser";
import { nextVersion, recordUpload } from "@/app/app/actions";
import { Button, Notice } from "@/components/ui";
import { TURN_IN_MAX_BYTES, turnInType } from "@/lib/mime";


/** Uploads straight into the man's own private folder: {man}/{step}/{version}/{file}. */
export function UploadTurnIn({ spId, stepId, manId }: { spId: string; stepId: string; manId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const router = useRouter();

  async function upload() {
    const f = input.current?.files?.[0];
    if (!f) return setMsg({ error: "Choose a file first." });
    if (f.size > TURN_IN_MAX_BYTES) return setMsg({ error: "That file is over 20 MB." });
    const contentType = turnInType(f.name);
    if (!contentType) return setMsg({ error: "Use a PDF, photo, Word or text file." });
    setBusy(true);
    setMsg({});
    try {
      const v = await nextVersion(spId);
      const safe = f.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      const path = `${manId}/${stepId}/${v}/${safe}`;
      await uploadOwnFile(path, f, contentType);
      const r = await recordUpload(spId, path, "");
      if (r?.error) throw new Error(r.error);
      setMsg({ ok: "Uploaded." });
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="lbl" htmlFor={`file-${spId}`}>Upload a file (PDF, photo of your paper, Word)</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id={`file-${spId}`} ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx,.txt,.rtf,.odt" className="text-sm" />
        <Button type="button" variant="ghost" onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button>
      </div>
      {msg.error && <Notice tone="danger">{msg.error}</Notice>}
      {msg.ok && <Notice>{msg.ok}</Notice>}
    </div>
  );
}
