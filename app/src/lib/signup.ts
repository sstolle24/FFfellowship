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
