"use client";
import { useState, useTransition } from "react";
import { adminResetLink, adminSetEmail } from "@/app/leader/actions";
import { ActionForm, Submit } from "@/components/forms";
import { Button, Card, Notice } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";

/** Admin only: change the email he signs in with, or get him a password reset link. */
export function AdminAccountCard({ manId, email, first }: { manId: string; email: string | null; first: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<{ ok?: string; error?: string; link?: string }>({});
  const reset = (how: "emailed" | "copied") => start(async () => {
    setRes({});
    setRes(await adminResetLink(manId, how));
  });
  return (
    <Card className="space-y-4 text-sm">
      <h2 className="text-gold">Sign-in (admin)</h2>
      <ActionForm action={adminSetEmail.bind(null, manId)} className="space-y-2">
        <label className="lbl" htmlFor="admin-email">Sign-in email</label>
        <div className="flex flex-wrap gap-2">
          <input id="admin-email" name="email" type="email" required defaultValue={email ?? ""} className="field min-w-0 flex-1" autoComplete="off" />
          <Submit variant="ghost" confirm={`Change ${first}'s sign-in email? He'll use the new one to log in, and both addresses get a notice.`}>Change email</Submit>
        </div>
      </ActionForm>
      <div className="space-y-2 border-t border-line/60 pt-3">
        <p className="lbl">Password reset</p>
        <p className="text-xs text-muted">Sends {first} a link to set a new password. It works once and expires in 1 hour.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" disabled={pending} onClick={() => reset("emailed")}>Email him a reset link</Button>
          <Button type="button" variant="quiet" disabled={pending} onClick={() => reset("copied")}>Get a link to text him</Button>
        </div>
        {pending && <p className="text-xs text-muted">Working…</p>}
        {res.error && <Notice tone="danger">{res.error}</Notice>}
        {res.ok && <Notice>{res.ok}</Notice>}
        {res.link && (
          <div className="space-y-2">
            <input readOnly value={res.link} aria-label="Reset link" className="field font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <CopyButton value={res.link} label="Copy link" />
          </div>
        )}
      </div>
    </Card>
  );
}
