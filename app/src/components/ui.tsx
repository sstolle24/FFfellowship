import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The Finally Free logo (gold FF with the cross), self-hosted under /brand.
 * `size` is the rendered height in px; width follows the logo's proportions.
 * `glow` is kept for API compatibility; the Alpine Sky theme renders no halo.
 */
export function Logo({ size = 40, glow = false, priority = false }: { size?: number; glow?: boolean; priority?: boolean }) {
  return (
    <picture className="inline-block shrink-0">
      <source type="image/webp" srcSet="/brand/ff-logo.webp 1x, /brand/ff-logo@2x.webp 2x" />
      <img src="/brand/ff-logo.png" srcSet="/brand/ff-logo.png 1x, /brand/ff-logo@2x.png 2x" alt="Finally Free"
        style={{ height: size, width: "auto" }} className={glow ? "logo-glow" : "logo-shadow"}
        loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : undefined} />
    </picture>
  );
}

export function Card({ className = "", ...p }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-panel p-5 ${className}`} {...p} />;
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl text-gold md:text-3xl">{children}</h1>
      <div className="rule mt-2 w-40" />
      {sub && <p className="mt-3 text-muted">{sub}</p>}
    </div>
  );
}

const btn = {
  gold: "bg-gold text-navy hover:bg-gold-hi",
  ghost: "border border-line text-ink hover:border-gold hover:text-gold",
  danger: "bg-danger text-white hover:opacity-90",
  quiet: "text-muted hover:text-gold",
};
export function Button({ variant = "gold", className = "", ...p }: ComponentProps<"button"> & { variant?: keyof typeof btn }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${btn[variant]} ${className}`}
      {...p}
    />
  );
}
export function LinkButton({ variant = "gold", className = "", ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${btn[variant]} ${className}`}
      {...p}
    />
  );
}

export function Badge({ tone = "muted", children }: { tone?: "muted" | "gold" | "orange" | "ok" | "danger"; children: ReactNode }) {
  const t = {
    muted: "border-line text-muted",
    gold: "border-gold/50 text-gold",
    orange: "border-orange/60 text-orange",
    ok: "border-ok/60 text-ok",
    danger: "border-danger/60 text-danger",
  }[tone];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${t}`}>{children}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs uppercase tracking-widest text-muted">{label}</span>
      <span className="display text-3xl text-gold">{value}</span>
      {hint && <span className="text-sm text-muted">{hint}</span>}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line p-4 text-sm italic text-muted">{children}</p>;
}

export function Notice({ tone = "gold", children, className = "" }: { tone?: "gold" | "orange" | "danger"; children: ReactNode; className?: string }) {
  const t = { gold: "border-gold/40 bg-gold/5", orange: "border-orange/50 bg-orange/10", danger: "border-danger/50 bg-danger/10" }[tone];
  return <div className={`rounded-lg border p-4 text-sm ${t} ${className}`}>{children}</div>;
}
