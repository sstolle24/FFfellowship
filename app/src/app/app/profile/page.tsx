import { requireUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { OPTIONAL_PREFS } from "@/lib/email";
import { fmtDate } from "@/lib/time";
import { ActionForm, Submit } from "@/components/forms";
import { Card, SectionTitle } from "@/components/ui";
import { deleteAccount, saveEmailPrefs, saveProfile, saveSharing, setSobrietyDate } from "../actions";

export const metadata = { title: "Profile & Privacy" };

const TZS = Intl.supportedValuesOf("timeZone");

export default async function Profile() {
  const me = await requireUser();
  const db = await supabaseServer();
  const active = me.status === "active";
  const none = { data: [] as never[] };
  const [{ data: cs }, { data: cards }, { data: listed }, { data: rels }] = await Promise.all([
    db.from("contact_sharing").select("*").eq("profile_id", me.id).single(),
    active ? db.from("member_cards").select("id, first_name, display_name, is_leader").neq("id", me.id).order("first_name") : Promise.resolve(none),
    active ? db.from("member_contacts").select("id").eq("directory_opt_in", true) : Promise.resolve(none),
    active ? db.from("relationships").select("mentor_id, mentee_id").eq("status", "active") : Promise.resolve(none),
  ]);
  // Panic picks: men listed in the Directory, his AP/sponsor/sponsees, and leaders (the server enforces the same set).
  const allowed = new Set<string>([
    ...(listed ?? []).map((m) => m.id as string),
    ...(rels ?? []).map((r) => (r.mentor_id === me.id ? r.mentee_id : r.mentor_id) as string),
  ]);
  const members = (cards ?? []).filter((m) => m.is_leader || allowed.has(m.id));
  const panic: string[] = (cs?.panic_recipients as string[]) ?? [];

  return (
    <div className="space-y-6">
      <SectionTitle>Profile &amp; Privacy</SectionTitle>

      <Card>
        <h2 className="mb-3 text-lg text-gold">About you</h2>
        <ActionForm action={saveProfile} className="grid gap-3 sm:grid-cols-2">
          <div><label className="lbl" htmlFor="first_name">First name</label><input id="first_name" name="first_name" defaultValue={me.first_name} required className="field" maxLength={40} /></div>
          <div><label className="lbl" htmlFor="display_name">Display name (optional, e.g. &ldquo;John K&rdquo;)</label><input id="display_name" name="display_name" defaultValue={me.display_name ?? ""} className="field" maxLength={60} /></div>
          <div><label className="lbl" htmlFor="phone">Phone</label><input id="phone" name="phone" defaultValue={me.phone ?? ""} className="field" maxLength={30} autoComplete="tel" /></div>
          <div><label className="lbl" htmlFor="signal">Signal (number or username)</label><input id="signal" name="signal" defaultValue={me.signal ?? ""} className="field" maxLength={60} /></div>
          <div>
            <label className="lbl" htmlFor="timezone">Timezone</label>
            <select id="timezone" name="timezone" defaultValue={me.timezone} className="field">{TZS.map((t) => <option key={t}>{t}</option>)}</select>
          </div>
          <div><label className="lbl" htmlFor="city">City</label><input id="city" name="city" defaultValue={me.city ?? ""} className="field" maxLength={60} /></div>
          <div><label className="lbl" htmlFor="country">Country</label><input id="country" name="country" defaultValue={me.country ?? ""} className="field" maxLength={60} /></div>
          <div><label className="lbl" htmlFor="home_group">Home group (Key 2 #10)</label><input id="home_group" name="home_group" defaultValue={me.home_group ?? ""} className="field" maxLength={80} /></div>
          <div className="sm:col-span-2"><label className="lbl" htmlFor="service_position">Service position (Key 2 #12)</label><input id="service_position" name="service_position" defaultValue={me.service_position ?? ""} className="field" maxLength={120} /></div>
          <div className="sm:col-span-2"><Submit>Save</Submit></div>
        </ActionForm>
      </Card>

      <Card id="sobriety">
        <h2 className="text-lg text-gold">Sobriety date</h2>
        <p className="mb-3 text-sm text-muted">
          {me.sobriety_start_date ? `Currently ${fmtDate(me.sobriety_start_date)}.` : "Not set."} If you slipped, reset it honestly and tell your AP. Every reset is kept privately for you and leaders.
        </p>
        <ActionForm action={setSobrietyDate} className="flex flex-wrap items-end gap-3">
          <div><label className="lbl" htmlFor="date">New date</label><input id="date" name="date" type="date" required className="field" /></div>
          <Submit variant="ghost">Update</Submit>
        </ActionForm>
      </Card>

      {active && (
        <Card id="sharing">
          <h2 className="text-lg text-gold">What other members can see</h2>
          <p className="mb-3 text-sm text-muted">Nothing below is ever shown publicly — only to approved members.</p>
          <ActionForm action={saveSharing} className="space-y-3">
            {[
              ["share_phone", "Share my phone number", cs?.share_phone],
              ["share_signal", "Share my Signal", cs?.share_signal],
              ["share_city", "Share my city and country", cs?.share_city],
              ["directory_opt_in", "List me in the member Directory", cs?.directory_opt_in],
            ].map(([n, l, v]) => (
              <label key={n as string} className="flex items-center gap-2"><input type="checkbox" name={n as string} defaultChecked={!!v} className="accent-gold" /> {l as string}</label>
            ))}
            <div>
              <label className="lbl" htmlFor="panic">Panic Button recipients (in addition to your AP, sponsor and primary leader). Lists Directory members, the men you walk with, and leaders. Hold Ctrl/⌘ to pick several.</label>
              <select id="panic" name="panic" multiple defaultValue={panic} className="field min-h-36">
                {members.map((m) => <option key={m.id} value={m.id}>{m.display_name || m.first_name}</option>)}
              </select>
            </div>
            <Submit>Save sharing</Submit>
          </ActionForm>
        </Card>
      )}

      <Card>
        <h2 className="mb-3 text-lg text-gold">Email</h2>
        <ActionForm action={saveEmailPrefs} className="space-y-2">
          <input type="hidden" name="keys" value={Object.keys(OPTIONAL_PREFS).join(",")} />
          {Object.entries(OPTIONAL_PREFS).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="checkbox" name={`pref:${k}`} defaultChecked={me.email_prefs?.[k] !== false} className="accent-gold" /> {l}</label>
          ))}
          <p className="text-xs text-muted">Approvals of your account, returned items, match updates and Panic Button alerts always send.</p>
          <Submit variant="ghost">Save email settings</Submit>
        </ActionForm>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg text-gold">Your data</h2>
        <a href="/api/export" className="inline-block rounded-lg border border-line px-4 py-2 text-sm hover:border-gold">Download my data (JSON)</a>
        <details>
          <summary className="cursor-pointer text-sm text-danger">Delete my account</summary>
          <ActionForm action={deleteAccount} className="mt-3 space-y-2">
            <p className="text-sm text-muted">Your account is deactivated immediately, your AP/sponsor relationships end, and after 30 days your turned-in work, logs, journal and contact details are permanently erased along with your login. Type DELETE to confirm.</p>
            <input name="confirm" className="field max-w-48" autoComplete="off" />
            <Submit variant="danger">Delete my account</Submit>
          </ActionForm>
        </details>
      </Card>
    </div>
  );
}
