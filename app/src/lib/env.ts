/** Central place for configuration. Server-only secrets are read lazily so a
 *  missing key fails loudly where it's used, not at import. */
function req(name: string, v: string | undefined) {
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "",

  supabaseServiceKey: () => req("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  turnstileSecret: () => process.env.TURNSTILE_SECRET_KEY ?? "",
  resendKey: () => process.env.RESEND_API_KEY ?? "",
  emailFrom: () => process.env.EMAIL_FROM ?? "Finally Free Fellowship <no-reply@finallyfreeapp.com>",
  cronSecret: () => req("CRON_SECRET", process.env.CRON_SECRET),
  /** Member-only. Rendered server-side on member pages, never in a public bundle. */
  signalGroupUrl: () => process.env.SIGNAL_GROUP_URL ?? "",
};
