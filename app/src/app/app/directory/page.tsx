import Link from "next/link";
import { StageTag } from "@/components/StageTag";
import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Card, Empty, SectionTitle } from "@/components/ui";
import { WorldMap, type Pin } from "@/components/WorldMap";
import { placeFor } from "@/lib/places";

export const metadata = { title: "Directory" };

/** Opt-in only, city-level only, active members only (enforced by the member_contacts view). The map pins state or country, never city. */
export default async function Directory({ searchParams }: { searchParams: Promise<{ state?: string; place?: string }> }) {
  const me = await requireActive();
  const db = await supabaseServer();
  const { state, place } = await searchParams;
  const { data: all } = await db.from("member_contacts").select("*").eq("directory_opt_in", true).order("first_name");
  const states = [...new Set((all ?? []).map((m) => m.state as string | null).filter((x): x is string => !!x))].sort();
  // Map pins: state or country only (member_contacts already hides location unless he shares it).
  const placeOf = new Map((all ?? []).map((m) => [m.id as string, placeFor(m.country, m.state)]));
  const pinBy = new Map<string, Pin>();
  for (const pl of placeOf.values()) {
    if (!pl) continue;
    const pin = pinBy.get(pl.key) ?? { ...pl, count: 0 };
    pin.count++;
    pinBy.set(pl.key, pin);
  }
  const pins = [...pinBy.values()];
  const activePin = place ? pinBy.get(place) : undefined;
  const data = activePin ? (all ?? []).filter((m) => placeOf.get(m.id)?.key === activePin.key)
    : state ? (all ?? []).filter((m) => m.state === state) : all;
  const { data: cards } = await db.from("member_cards").select("id, stage").in("id", (all ?? []).map((m) => m.id).concat("00000000-0000-0000-0000-000000000000"));
  const stageOf = new Map((cards ?? []).map((c) => [c.id as string, c.stage as string]));
  const { data: mine } = await db.from("contact_sharing").select("directory_opt_in").eq("profile_id", me.id).single();

  const groups = new Map<string, typeof data>();
  for (const m of data ?? []) {
    const key = m.country || m.state ? [m.country, m.state, m.city].filter(Boolean).join(" — ") : "Location not shared";
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => (a === "Location not shared" ? 1 : b === "Location not shared" ? -1 : a.localeCompare(b)));

  return (
    <div className="space-y-6">
      <SectionTitle sub="Brothers who chose to be listed, grouped by location. Use it to find men near you or in your timezone.">Directory</SectionTitle>
      {pins.length > 0 && (
        <WorldMap pins={pins} active={activePin?.key} total={pins.reduce((n, p) => n + p.count, 0)}
          hidden={(all ?? []).length - pins.reduce((n, p) => n + p.count, 0)} />
      )}
      {activePin && (
        <p className="text-sm">Showing brothers in <strong>{activePin.label}</strong>. <Link href="/app/directory" className="text-gold underline">Show everyone</Link></p>
      )}
      {states.length > 0 && !activePin && (
        <form className="flex flex-wrap items-end gap-2" action="/app/directory">
          <div>
            <label className="lbl" htmlFor="state">State / province</label>
            <select id="state" name="state" defaultValue={state ?? ""} className="field">
              <option value="">All</option>
              {states.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <button type="submit" className="rounded-lg border border-line px-3 py-2 text-sm hover:border-gold">Show</button>
        </form>
      )}
      {!mine?.directory_opt_in && (
        <p className="text-sm text-muted">You&apos;re not listed. <Link href="/app/profile#sharing" className="text-gold underline">Turn it on in Profile &amp; Privacy</Link>.</p>
      )}
      {sorted.length ? sorted.map(([place, men]) => (
        <section key={place}>
          <h2 className="mb-2 text-gold">{place}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(men ?? []).map((m) => (
              <Card key={m.id} className="p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2"><span className="display text-ink">{m.display_name || m.first_name}</span><StageTag stage={stageOf.get(m.id)} /></div>
                <div className="mt-1 flex flex-wrap gap-3 text-muted">
                  {m.phone && <a className="text-gold underline" href={`tel:${m.phone.replace(/[^\d+]/g, "")}`}>{m.phone}</a>}
                  {m.signal && <span>Signal: {m.signal}</span>}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )) : <Empty>No one has opted in yet.</Empty>}
    </div>
  );
}
