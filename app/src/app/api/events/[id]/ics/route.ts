import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { eventIcs, type CommunityEvent } from "@/lib/community";
import { env } from "@/lib/env";

/** One item as an .ics file. Read with the visitor's own session, so members-only items stay members-only. */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data } = await (await supabaseServer()).from("community_events").select("*").eq("id", id).maybeSingle<CommunityEvent>();
  if (!data?.starts_at) return NextResponse.json({ error: "not found" }, { status: 404 });
  return new NextResponse(eventIcs(data, env.siteUrl), {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="finally-free-event.ics"` },
  });
}
