import type { KeyInfo } from "@/lib/keys";

/** A key's meaning from the "3 Keys to Freedom" graphic: what you do, in the Kingdom, simple application. */
export function KeyMeaning({ info, className = "" }: { info: KeyInfo; className?: string }) {
  return (
    <dl className={`mb-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr] ${className}`}>
      <dt className="text-muted">What you do</dt><dd className="text-ink">{info.what}</dd>
      <dt className="text-muted">In the Kingdom</dt><dd className="text-gold">{info.kingdom}</dd>
      <dt className="text-muted">Simple application</dt><dd className="text-ink">{info.application}</dd>
    </dl>
  );
}
