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

/** Classic recovery key-tag colors: [top, base, edge, text]. */
const TAG: Record<TimeCoin["color"], [string, string, string, string]> = {
  white:  ["#ffffff", "#e9e7e0", "#c9c4b4", "#7a5410"],
  gold:   ["#f1cf74", "#c9962e", "#9b6d14", "#4a3005"],
  orange: ["#ff8a63", "#f2401c", "#c42d0f", "#ffe7a3"],
  green:  ["#6fe38a", "#1fb84a", "#13873a", "#fff3b8"],
  red:    ["#e2484d", "#b3141c", "#7f0c12", "#ffe1a0"],
  blue:   ["#4b6cf0", "#1532c9", "#0d2290", "#ffe7a3"],
  yellow: ["#fff27a", "#e5cd12", "#b39f06", "#6b4a06"],
  glow:   ["#ffffff", "#e3f2e1", "#b9d8b4", "#7a5410"],
  gray:   ["#a3a6ad", "#6f737b", "#4f535a", "#fff3c4"],
  black:  ["#3a3a3f", "#141416", "#000000", "#f1cf74"],
};

/** A sobriety key tag with the FF logo: ring, eyelet, stitched edge, the milestone in gold. */
function KeyTag({ c }: { c: TimeCoin }) {
  const [top, base, edge, text] = TAG[c.color];
  const g = `tag-${c.color}`;
  const words = c.label === "Just For Today" ? ["Just For", "Today"] : [c.short];
  // Rounded triangle, wider at the bottom, like a real key tag.
  const body = "M50 34 C67 34 77 46 83 66 C90 90 95 116 89 133 C84 145 68 148 50 148 C32 148 16 145 11 133 C5 116 10 90 17 66 C23 46 33 34 50 34 Z";
  const inner = "M50 42 C63 42 71 52 76 69 C82 91 87 114 82 128 C78 138 66 141 50 141 C34 141 22 138 18 128 C13 114 18 91 24 69 C29 52 37 42 50 42 Z";
  return (
    <svg viewBox="0 0 100 150" className="h-28 w-auto sm:h-32" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="0.65" stopColor={base} /></linearGradient>
        {c.color === "glow" && <filter id="tag-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>}
      </defs>
      <rect x="42" y="22" width="16" height="18" rx="4" fill={base} stroke={edge} strokeWidth="1.5" />
      <circle cx="50" cy="15" r="12" fill="none" stroke="#c5c9cf" strokeWidth="5" />
      <circle cx="50" cy="15" r="12" fill="none" stroke="#ffffff" strokeWidth="1.5" opacity="0.7" />
      {c.color === "glow" && <path d={body} fill="#c8f5c0" filter="url(#tag-glow)" opacity="0.9" />}
      <path d={body} fill={`url(#${g})`} stroke={edge} strokeWidth="2" />
      <path d={inner} fill="none" stroke={edge} strokeWidth="1.2" strokeDasharray="3 2.5" opacity="0.55" />
      <circle cx="50" cy="46" r="3.6" fill="#d9b04a" stroke="#7a5410" strokeWidth="1.2" />
      <image href="/brand/ff-logo.webp" x="39" y="56" width="22" height="29" />
      {words.map((w, i) => (
        <text key={w} x="50" y={(words.length > 1 ? 103 : 110) + i * 13} textAnchor="middle" fontSize={w.length > 8 ? 11.5 : 13}
          fontWeight="700" fontFamily="Georgia, 'Times New Roman', serif" letterSpacing="0.6" fill={text}
          style={{ fontVariant: "small-caps" }}>{w}</text>
      ))}
    </svg>
  );
}

/** His key tags: earned ones in color with a check; the next one with a progress bar; later ones faded with their date. */
export function TimeCoins({ coins, progress }: { coins: TimeCoin[]; progress?: { id: string; pct: number } | null }) {
  return (
    <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-5 lg:grid-cols-7">
      {coins.map((c) => {
        const next = progress?.id === c.id;
        return (
          <li key={c.id} className="flex flex-col items-center text-center">
            <div className={`relative ${c.earned ? "" : next ? "opacity-60" : "opacity-30 grayscale-[40%]"}`}>
              <KeyTag c={c} />
              {c.earned && (
                <span className="absolute -bottom-1 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-ok text-xs font-bold text-white shadow ring-2 ring-white" aria-hidden="true">✓</span>
              )}
            </div>
            {next && (
              <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(progress!.pct * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Progress to ${c.label}`}>
                <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(progress!.pct * 100)}%` }} />
              </div>
            )}
            <span className="mt-1 text-[11px] leading-tight text-muted">{c.earned ? "Earned" : fmtDate(c.on)}</span>
            <span className="sr-only">{c.earned ? `${c.label} earned` : `${c.label} on ${fmtDate(c.on)}`}</span>
          </li>
        );
      })}
    </ul>
  );
}
