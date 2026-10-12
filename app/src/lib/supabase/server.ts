import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { env } from "@/lib/env";

/** Supabase client acting as the signed-in user. Every query is subject to RLS. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) =>
            store.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: "lax" }),
          );
        } catch {
          /* called from a Server Component; middleware refreshes the session */
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses RLS — only for server-side jobs that have no
 * user (cron, email fan-out, rate limiting). Never import into client code.
 */
export function supabaseService() {
  return createPlainClient(env.supabaseUrl, env.supabaseServiceKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
