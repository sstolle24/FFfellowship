import Link from "next/link";
import { requireUser, isLeader, isSponsorRole } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Monogram } from "@/components/ui";
import { NavLinks } from "@/components/NavLinks";
import { logOut } from "../(public)/auth-actions";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const supabase = await supabaseServer();
  await supabase.rpc("touch_activity");

  const active = me.status === "active";
  const links: [string, string][] = active
    ? [
        ["/app", "Dashboard"], ["/app/program", "My Program"], ["/app/meetings", "Meetings & Links"],
        ["/app/ninety", "90 in 90"], ["/app/journal", "Meeting Journal"], ["/app/fishing", "Fishing"],
        ["/app/sponsor", isSponsorRole(me) ? "Sponsor Board" : "Find a Sponsor / AP"], ["/app/brothers", "My Brothers"],
        ["/app/sponsor-desk", "Sponsor Desk"], ["/app/directory", "Directory"],
        ["/app/profile", "Profile & Privacy"],
      ]
    : [["/app", "Dashboard"], ["/app/meetings", "Meetings & Links"], ["/app/profile", "Profile & Privacy"]];

  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print border-b border-line bg-navy-2 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 p-4">
          <Link href="/"><Monogram size={36} /></Link>
          <div className="min-w-0">
            <div className="display truncate text-gold">{me.display_name || me.first_name}</div>
            <div className="text-xs text-muted">{me.status === "pending" ? "Awaiting approval" : "Member"}</div>
          </div>
        </div>
        <NavLinks links={links} />
        <div className="flex gap-3 px-4 pb-4 pt-2 text-sm md:flex-col md:gap-1">
          {isLeader(me) && <Link href="/leader" className="text-gold hover:underline">Leader area →</Link>}
          <form action={logOut}><button className="text-muted hover:text-gold">Log out</button></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
