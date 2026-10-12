import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** "Download my data": everything we hold about the signed-in man (export is audit-logged). */
export async function GET() {
  const db = await supabaseServer();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in" }, { status: 401 });
  const { data, error } = await db.rpc("export_my_data");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="finally-free-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
