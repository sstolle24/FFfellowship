"use client";
import { useState } from "react";

/** Copies a value (e.g. a recording passcode) to the clipboard. */
export function CopyButton({ value, label = "Copy passcode" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copy this:", value);
        }
      }}
      className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-gold">
      {done ? "Copied ✓" : label}
    </button>
  );
}
