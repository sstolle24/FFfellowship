"use client";
import { useState, useTransition } from "react";
import { panic } from "@/app/app/actions";
import { Card } from "@/components/ui";

type Contact = { first_name: string; phone: string | null; signal: string | null };

export function PanicButton({ signalUrl }: { signalUrl: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error?: string; contacts?: Contact[] } | null>(null);

  return (
    <Card className="flex flex-col justify-between border-danger/60 bg-danger/10">
      {!result ? (
        <>
          <span className="text-xs uppercase tracking-widest text-danger">In trouble right now?</span>
          <button
            disabled={pending}
            onClick={() => {
              if (!window.confirm("Send an urgent alert to your AP, sponsor, leader and chosen brothers?")) return;
              start(async () => setResult(await panic()));
            }}
            className="mt-2 rounded-lg bg-danger px-4 py-3 text-lg font-bold text-white shadow-lg hover:brightness-110 disabled:opacity-60"
          >
            {pending ? "Sending…" : "PANIC BUTTON"}
          </button>
        </>
      ) : (
        <div className="space-y-2 text-sm">
          {result.error ? (
            <p className="text-danger">{result.error}</p>
          ) : (
            <p className="font-semibold text-ink">Your brothers have been alerted. Call one now:</p>
          )}
          <ul className="space-y-1">
            {(result.contacts ?? []).map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span>{c.first_name}</span>
                {c.phone && <a className="text-gold underline" href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>Call</a>}
              </li>
            ))}
          </ul>
          {signalUrl && <a className="inline-block text-gold underline" href={signalUrl} target="_blank" rel="noopener noreferrer">Open the FF Signal group</a>}
          <p className="text-muted">Leave the room. Go where people are. Pray for just this one day.</p>
        </div>
      )}
    </Card>
  );
}
