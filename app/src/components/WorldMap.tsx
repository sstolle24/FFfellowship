import Link from "next/link";
import { LAND_PATH, MAP_H, MAP_W, SPHERE_PATH, project } from "@/lib/world-map";

export type Pin = { key: string; label: string; count: number; lat: number; lon: number };

/** Where Directory brothers are, by state or country (never city). Each pin filters the list to that place. */
export function WorldMap({ pins, active, total, hidden }: { pins: Pin[]; active?: string; total: number; hidden: number }) {
  const sorted = [...pins].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return (
    <figure className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-line bg-panel">
        <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block h-auto w-full" role="img" aria-label={`World map: ${total} brother${total === 1 ? "" : "s"} in ${pins.length} place${pins.length === 1 ? "" : "s"}`}>
          <path d={SPHERE_PATH} fill="var(--color-navy-2)" />
          <path d={LAND_PATH} fill="var(--color-line)" stroke="var(--color-panel)" strokeWidth="0.6" />
          {/* smaller groups drawn last so they stay clickable on top */}
          {sorted.map((p) => {
            const [x, y] = project(p.lon, p.lat);
            const r = 5 + Math.min(10, Math.sqrt(p.count) * 2.4);
            const on = active === p.key;
            return (
              <Link key={p.key} href={on ? "/app/directory" : `/app/directory?place=${p.key}`} aria-label={`${p.label}: ${p.count} brother${p.count === 1 ? "" : "s"}`}>
                <title>{`${p.label} — ${p.count} brother${p.count === 1 ? "" : "s"}`}</title>
                <circle cx={x} cy={y} r={r + 3} fill="#f59e0b" opacity="0.25" />
                <circle cx={x} cy={y} r={r} fill={on ? "#b45309" : "#f59e0b"} stroke="#ffffff" strokeWidth="1.8" />
                {p.count > 1 && <text x={x} y={y + 3.6} textAnchor="middle" fontSize="10" fontWeight="700" fill="#3b2405">{p.count}</text>}
              </Link>
            );
          })}
        </svg>
      </div>
      <figcaption className="space-y-2 text-sm">
        <ul className="flex flex-wrap gap-2" aria-label="Places">
          {sorted.map((p) => (
            <li key={p.key}>
              <Link href={active === p.key ? "/app/directory" : `/app/directory?place=${p.key}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${active === p.key ? "border-amber-600 bg-amber-100 text-amber-900" : "border-line text-ink hover:border-gold"}`}>
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
                {p.label} <span className="text-muted">{p.count}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          Pins show a state or country, never a city, and only for brothers who share their location.
          {hidden > 0 && ` ${hidden} listed brother${hidden === 1 ? " isn't" : "s aren't"} on the map (location not shared or not recognized).`}
        </p>
      </figcaption>
    </figure>
  );
}
