import type { ProgramBadge, TimeCoin } from "@/lib/badges";
import { fmtDate } from "@/lib/time";

/** Gold for earned badges; faint dashed outline for ones still ahead. */
function Gold({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fbe7a1" /><stop offset="0.45" stopColor="#e2b443" /><stop offset="1" stopColor="#a8761c" />
      </linearGradient>
    </defs>
  );
}
const paint = (earned: boolean, g: string) => earned
  ? { fill: `url(#${g})`, stroke: "#8a5f12", strokeWidth: 2 }
  : { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeDasharray: "4 3" };
const ink = (earned: boolean) => (earned ? "#5b3d06" : "currentColor");

function Key({ n, earned }: { n: string; earned: boolean }) {
  const g = "badge-gold-key", p = paint(earned, g);
  return (
    <svg viewBox="0 0 64 100" className="h-20 w-auto sm:h-28" aria-hidden="true">
      <Gold id={g} />
      <circle cx="32" cy="28" r="24" {...p} />
      <circle cx="32" cy="28" r="17" fill={earned ? "#fff6d6" : "none"} stroke={earned ? "#8a5f12" : "currentColor"} strokeWidth="1.5" opacity={earned ? 0.9 : 0.6} />
      <text x="32" y="37" textAnchor="middle" fontSize="26" fontWeight="800" fontFamily="Georgia, serif" fill={ink(earned)}>{n}</text>
      <rect x="28" y="52" width="8" height="44" rx="1" {...p} />
      <rect x="36" y="76" width="11" height="7" rx="1" {...p} />
      <rect x="36" y="87" width="8" height="7" rx="1" {...p} />
    </svg>
  );
}

function Trophy({ earned }: { earned: boolean }) {
  const g = "badge-gold-trophy", p = paint(earned, g);
  return (
    <svg viewBox="0 0 80 100" className="h-20 w-auto sm:h-28" aria-hidden="true">
      <Gold id={g} />
      <path d="M18 14 h44 v18 c0 16 -10 28 -22 28 c-12 0 -22 -12 -22 -28 z" {...p} />
      <path d="M18 20 h-10 c0 14 6 20 14 21 M62 20 h10 c0 14 -6 20 -14 21" fill="none" stroke={earned ? "#8a5f12" : "currentColor"} strokeWidth="3" strokeDasharray={earned ? undefined : "4 3"} />
      <path d="M34 60 h12 v12 h-12 z M24 72 h32 v8 h-32 z M18 82 h44 v10 h-44 z" {...p} />
      <path d="M40 22 l3.5 7 7.7 1.1 -5.6 5.4 1.3 7.7 -6.9 -3.6 -6.9 3.6 1.3 -7.7 -5.6 -5.4 7.7 -1.1 z" fill={earned ? "#fff6d6" : "none"} stroke={ink(earned)} strokeWidth="1.2" />
    </svg>
  );
}

function Medal({ earned }: { earned: boolean }) {
  const g = "badge-gold-medal", p = paint(earned, g);
  return (
    <svg viewBox="0 0 80 100" className="h-20 w-auto sm:h-28" aria-hidden="true">
      <Gold id={g} />
      <path d="M22 4 h14 l8 26 h-14 z M58 4 h-14 l-8 26 h14 z" fill={earned ? "#2f5d8a" : "none"} stroke={earned ? "#1d3d5e" : "currentColor"} strokeWidth="1.5" strokeDasharray={earned ? undefined : "4 3"} />
      <circle cx="40" cy="62" r="32" {...p} />
      <circle cx="40" cy="62" r="25" fill="none" stroke={earned ? "#8a5f12" : "currentColor"} strokeWidth="1.5" opacity="0.7" />
      <text x="40" y="76" textAnchor="middle" fontSize="38" fontWeight="900" fontFamily="Georgia, serif" fill={ink(earned)}>M</text>
    </svg>
  );
}

const ART: Record<ProgramBadge["id"], (earned: boolean) => React.ReactNode> = {
  key1: (e) => <Key n="1" earned={e} />, key2: (e) => <Key n="2" earned={e} />, key3: (e) => <Key n="3" earned={e} />,
  certified: (e) => <Trophy earned={e} />, ministry: (e) => <Medal earned={e} />,
};

export function ProgramBadges({ badges }: { badges: ProgramBadge[] }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5">
      {badges.map((b) => (
        <li key={b.id} className={`flex flex-col items-center text-center ${b.earned ? "text-gold" : "text-muted/50"}`} title={b.hint}>
          {ART[b.id](b.earned)}
          <span className={`mt-1 text-sm font-semibold ${b.earned ? "text-ink" : "text-muted"}`}>{b.label}</span>
          <span className="text-xs text-muted">{b.earned ? "Earned" : "Not yet"}</span>
          <span className="sr-only">{b.hint}</span>
        </li>
      ))}
    </ul>
  );
}

/** A recovery-chip style coin: 30 / 60 / 90 days, 6 / 9 months, years. */
function Coin({ c }: { c: TimeCoin }) {
  const g = "badge-gold-coin", p = paint(c.earned, g);
  const unit = c.id.startsWith("d") ? "DAYS" : c.id.startsWith("m") ? "MONTHS" : c.short === "1" ? "YEAR" : "YEARS";
  return (
    <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
      <Gold id={g} />
      <circle cx="32" cy="32" r="29" {...p} />
      <circle cx="32" cy="32" r="23" fill="none" stroke={c.earned ? "#8a5f12" : "currentColor"} strokeWidth="1.2" opacity="0.7" />
      <text x="32" y="36" textAnchor="middle" fontSize={c.short.length > 1 ? 19 : 22} fontWeight="800" fontFamily="Georgia, serif" fill={ink(c.earned)}>{c.short}</text>
      <text x="32" y="47" textAnchor="middle" fontSize="7" fontWeight="700" letterSpacing="1" fill={ink(c.earned)}>{unit}</text>
    </svg>
  );
}

export function TimeCoins({ coins }: { coins: TimeCoin[] }) {
  return (
    <ul className="flex flex-wrap gap-3">
      {coins.map((c) => (
        <li key={c.id} className={`flex w-16 flex-col items-center text-center ${c.earned ? "text-gold" : "text-muted/50"}`}>
          <Coin c={c} />
          <span className="mt-0.5 text-[11px] leading-tight text-muted">{c.earned ? c.label : fmtDate(c.on)}</span>
          <span className="sr-only">{c.earned ? `${c.label} earned` : `${c.label} on ${fmtDate(c.on)}`}</span>
        </li>
      ))}
    </ul>
  );
}
