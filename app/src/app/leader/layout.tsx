import Link from "next/link";
import { requireLeader } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/ui";
import { NavLinks } from "@/components/NavLinks";

export default async function LeaderLayout({ children }: { children: React.ReactNode }) {
  const me = await requireLeader();
  const db = await supabaseServer();
  await db.rpc("touch_activity");
  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print border-b border-line bg-navy-2 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex items-center gap-3 p-4">
          <Link href="/"><Logo size={36} priority /></Link>
          <div>
            <div className="display text-gold">Leader area</div>
            <div className="text-xs text-muted">{me.first_name} · {me.role === "admin" ? "Admin" : "Leader"}</div>
          </div>
        </div>
        <NavLinks links={[
          ["/leader", "Pipeline"], ["/leader/review", "Review Queue"], ["/leader/matching", "Matching Board"],
          ["/leader/members", "Members & Roles"], ["/leader/meetings", "Meetings Admin"], ["/leader/reports", "Reports"],
        ]} />
        <div className="px-4 pb-4 pt-2 text-sm"><Link href="/app" className="text-muted hover:text-gold">← My member area</Link></div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
    </div>
  );
}
