"use client";
import { useActionState, useTransition, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, Notice } from "@/components/ui";

export type FormState = { error?: string; ok?: string } | undefined;

export function Submit({ children, variant, className, confirm: msg }: {
  children: ReactNode; variant?: "gold" | "ghost" | "danger" | "quiet"; className?: string; confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} className={className} disabled={pending}
      onClick={(e) => { if (msg && !window.confirm(msg)) e.preventDefault(); }}>
      {pending ? "Working…" : children}
    </Button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error) return <Notice tone="danger">{state.error}</Notice>;
  if (state.ok) return <Notice>{state.ok}</Notice>;
  return null;
}

/** A form wired to a server action that returns {error|ok}. */
export function ActionForm({ action, children, className, resetOnOk }: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  children: ReactNode; className?: string; resetOnOk?: boolean;
}) {
  const [state, run] = useActionState(async (s: FormState, f: FormData) => {
    const r = await action(s, f);
    return r;
  }, undefined);
  return (
    <form action={run} className={className} key={resetOnOk && state?.ok ? JSON.stringify(state) : undefined}>
      {children}
      <div className="mt-3"><FormMessage state={state} /></div>
    </form>
  );
}

/** One-click button that calls a server action with fixed args (initial, approve, end…). */
export function ActionButton({ run, children, variant = "gold", confirm: msg, className }: {
  run: () => Promise<FormState>; children: ReactNode; variant?: "gold" | "ghost" | "danger" | "quiet"; confirm?: string; className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button type="button" variant={variant} disabled={pending} className={className}
      onClick={() => {
        if (msg && !window.confirm(msg)) return;
        start(async () => {
          const r = await run();
          if (r?.error) window.alert(r.error);
        });
      }}>
      {pending ? "…" : children}
    </Button>
  );
}
