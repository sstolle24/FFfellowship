"use client";
import { useActionState, useState } from "react";
import { logIn, sendMagicLink } from "../auth-actions";
import { FormMessage, Submit } from "@/components/forms";

export function LoginForms({ next }: { next: string }) {
  const [mode, setMode] = useState<"password" | "link">("password");
  const [pwState, pw] = useActionState(logIn, undefined);
  const [lnState, ln] = useActionState(sendMagicLink, undefined);
  return mode === "password" ? (
    <form action={pw} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div><label className="lbl" htmlFor="email">Email</label><input className="field" id="email" name="email" type="email" required autoComplete="email" /></div>
      <div><label className="lbl" htmlFor="password">Password</label><input className="field" id="password" name="password" type="password" required autoComplete="current-password" /></div>
      <FormMessage state={pwState} />
      <Submit className="w-full py-3">Log in</Submit>
      <button type="button" onClick={() => setMode("link")} className="w-full text-sm text-muted hover:text-gold">
        Forgot password? Email me a sign-in link
      </button>
    </form>
  ) : (
    <form action={ln} className="space-y-4">
      <div><label className="lbl" htmlFor="email2">Email</label><input className="field" id="email2" name="email" type="email" required autoComplete="email" /></div>
      <FormMessage state={lnState} />
      <Submit className="w-full py-3">Send sign-in link</Submit>
      <button type="button" onClick={() => setMode("password")} className="w-full text-sm text-muted hover:text-gold">Use my password</button>
    </form>
  );
}
