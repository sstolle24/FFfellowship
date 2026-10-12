import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Sign-up fields that may go into Supabase user metadata. Metadata is stored
 * on auth.users and returned to the client in the session JWT, so the
 * leaders-only `intake_reason` is kept out of it and written to
 * profile_intake by the server instead.
 */
export function splitSignUp<T extends { email: string; password: string; intake_reason?: string }>(data: T) {
  const { email, password, intake_reason, ...meta } = data;
  return { email, password, intakeReason: intake_reason?.trim() || null, meta };
}

/**
 * Fills in his intake reason (service client). The sign-up trigger creates
 * the row empty; this only writes while it is still null, so a repeat
 * sign-up can never overwrite what a man already told the leaders.
 */
export async function saveIntakeReason(db: SupabaseClient, profileId: string, reason: string) {
  const { error } = await db.from("profile_intake").update({ intake_reason: reason })
    .eq("profile_id", profileId).is("intake_reason", null);
  if (error) console.error("intake save failed", error.message);
}
