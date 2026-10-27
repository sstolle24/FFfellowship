"use client";
import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { recordReflectionFile, saveVideo } from "@/app/app/actions";
import { FormMessage, Submit } from "@/components/forms";
import { Button, Notice } from "@/components/ui";
import { uploadOwnFile } from "@/lib/supabase/browser";
import { TURN_IN_MAX_BYTES, turnInType } from "@/lib/mime";

/**
 * His notes and "watched" check for one video. Key 1 videos also need a
 * one-page reflection (typed, or uploaded) before they count as done; it is
 * shared with his AP and goes to his leader.
 */
export function VideoCheck({ videoId, manId, watched, notes, reflection, reflectionFile, reflectionUrl, needsReflection }: {
  videoId: string; manId: string; watched: boolean; notes: string; reflection: string;
  reflectionFile: string | null; reflectionUrl: string | null; needsReflection: boolean;
}) {
  const [state, run] = useActionState(saveVideo.bind(null, videoId), undefined);
  return (
    <div className="mt-3 space-y-3">
      <form action={run} className="space-y-2">
        <textarea name="notes" defaultValue={notes} placeholder="Your notes" aria-label="Your notes" className="field min-h-20 text-sm" maxLength={10000} />
        {needsReflection && (
          <div>
            <label className="lbl" htmlFor={`refl-${videoId}`}>One-page reflection (shared with your AP and your leader)</label>
            <textarea id={`refl-${videoId}`} name="reflection" defaultValue={reflection} className="field min-h-36 text-sm" maxLength={20000}
              placeholder="What did God show you in this video? What will you do about it?" />
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="watched" defaultChecked={watched} className="accent-gold" />
            I watched it{needsReflection ? " and wrote my reflection" : ""}
          </label>
          <Submit variant="ghost" className="px-3 py-1">Save</Submit>
        </div>
        <FormMessage state={state} />
      </form>
      {needsReflection && (
        <ReflectionUpload videoId={videoId} manId={manId} current={reflectionFile} currentUrl={reflectionUrl} />
      )}
    </div>
  );
}

/** Optional file version of the reflection: {man}/{video}/{n}/{file} in his private folder. */
function ReflectionUpload({ videoId, manId, current, currentUrl }: { videoId: string; manId: string; current: string | null; currentUrl: string | null }) {
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
      const n = (Number(current?.split("/")[2]) || 0) + 1;
      const path = `${manId}/${videoId}/${n}/${f.name.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
      await uploadOwnFile(path, f, contentType);
      const r = await recordReflectionFile(videoId, path);
      if (r?.error) throw new Error(r.error);
      setMsg({ ok: "Reflection uploaded." });
      if (input.current) input.current.value = "";
      router.refresh();
    } catch (e) {
      setMsg({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 border-t border-line/60 pt-2">
      <label className="lbl" htmlFor={`rfile-${videoId}`}>Or upload your reflection (optional)</label>
      {current && (
        <p className="text-xs text-muted">On file: {currentUrl
          ? <a href={currentUrl} className="text-gold underline" rel="noopener noreferrer">{current.split("/").pop()}</a>
          : current.split("/").pop()}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input id={`rfile-${videoId}`} ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp,.doc,.docx,.txt,.rtf,.odt" className="text-sm" />
        <Button type="button" variant="ghost" onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload"}</Button>
      </div>
      {msg.error && <Notice tone="danger">{msg.error}</Notice>}
      {msg.ok && <Notice>{msg.ok}</Notice>}
    </div>
  );
}
