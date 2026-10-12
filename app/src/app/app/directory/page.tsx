import Link from "next/link";
import { requireActive } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Card, Empty, SectionTitle } from "@/components/ui";

export const metadata = { title: "Directory" };

/** Opt-in only, city-level only, active members only (enforced by the member_contacts view). */
export default async function Directory() {
  const me = await requireActive();
  const db = await supabaseServer();
  const { data } = await db.from("member_contacts").select("*").eq("directory_opt_in", true).order("first_name");
  const { data: mine } = await db.from("contact_sharing").select("directory_opt_in").eq("profile_id", me.id).single();

  const groups = new Map<string, typeof data>();
  for (const m of data ?? []) {
    const key = m.country ? `${m.country}${m.city ? ` — ${m.city}` : ""}` : "Location not shared";
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  const sorted = [...groups.entries()].sort(([a], [b]) => (a === "Location not shared" ? 1 : b === "Location not shared" ? -1 : a.localeCompare(b)));

  return (
    <div className="space-y-6">
      <SectionTitle sub="Brothers who chose to be listed, grouped by city. Use it to find men near you or in your timezone.">Directory</SectionTitle>
      {!mine?.directory_opt_in && (
        <p className="text-sm text-muted">You&apos;re not listed. <Link href="/app/profile#sharing" className="text-gold underline">Turn it on in Profile &amp; Privacy</Link>.</p>
      )}
      {sorted.length ? sorted.map(([place, men]) => (
        <section key={place}>
          <h2 className="mb-2 text-gold">{place}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {(men ?? []).map((m) => (
              <Card key={m.id} className="p-3 text-sm">
                <div className="display text-ink">{m.display_name || m.first_name}</div>
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
