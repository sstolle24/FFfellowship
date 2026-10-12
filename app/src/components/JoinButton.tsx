"use client";
import { useState } from "react";
import { joinMeeting } from "@/app/app/actions";
import { Button } from "@/components/ui";

/** Records the join server-side (Key 2 #4D), then opens the meeting. */
export function JoinButton({ meetingId }: { meetingId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy} onClick={async () => {
      setBusy(true);
      const win = window.open("about:blank", "_blank"); // open now so popup blockers allow it
      const r = await joinMeeting(meetingId);
      setBusy(false);
      if ("url" in r && r.url) {
        if (win) win.location.href = r.url; else window.location.href = r.url;
      } else {
        win?.close();
        window.alert(("error" in r && r.error) || "No link set for this meeting.");
      }
    }}>
      {busy ? "Opening…" : "Join"}
    </Button>
  );
}
