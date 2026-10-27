import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Password reset links land here: verify the one-time token, sign him in, then set a new password. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  if (token_hash && url.searchParams.get("type") === "recovery") {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash });
    if (!error) return NextResponse.redirect(new URL("/app/password", url.origin));
  }
  return NextResponse.redirect(new URL("/login?link=expired", url.origin));
}
