"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { sendTemplate } from "@/lib/email";
import { checkLimit, clientIpFrom } from "@/lib/ip";
import { splitSignUp } from "@/lib/signup";

export type FormState = { error?: string; ok?: string } | undefined;

async function clientIp() {
  return clientIpFrom(await headers());
}

/**
 * Server-side rate limit backed by the database (works across serverless instances).
 * `failClosed`: refuse if the limiter can't be reached or the client IP is unknown.
 */
async function allow(key: string, max: number, windowSeconds: number, failClosed = false) {
  return checkLimit(
    () => supabaseService().rpc("rate_limit_hit", { p_key: key, p_max: max, p_window_seconds: windowSeconds }),
    failClosed,
  );
}

async function verifyTurnstile(token: string | null, ip: string) {
  const secret = env.turnstileSecret();
  if (!secret) return process.env.NODE_ENV !== "production"; // required in production
  if (!token) return false;
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  });
  const json = (await res.json()) as { success: boolean };
  return json.success;
}

const SignUp = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(40),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(10, "Use at least 10 characters"),
  timezone: z.string().max(60).default("America/Chicago"),
  country: z.string().trim().max(60).optional(),
  city: z.string().trim().max(60).optional(),
  sobriety_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  heard_about: z.string().trim().max(200).optional(),
  intake_reason: z.string().trim().max(2000).optional(),
});

export async function signUp(_: FormState, form: FormData): Promise<FormState> {
  // Sign-up fails closed: no trustworthy IP or no limiter → no new account.
  const ip = (await clientIp()) ?? (process.env.NODE_ENV !== "production" ? "local" : null);
  if (!ip) return { error: "We couldn't verify your connection. Please try again in a few minutes." };
  if (!(await allow(`signup:${ip}`, 5, 3600, true))) {
    return { error: "Too many sign-ups from this network (or sign-up is briefly unavailable). Try again in an hour." };
  }
  if (!(await verifyTurnstile(form.get("cf-turnstile-response") as string | null, ip))) {
    return { error: "Please complete the verification check." };
  }
  const parsed = SignUp.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // intake_reason stays out of user metadata (it would ride along in the session JWT).
  const { email, password, intakeReason, meta } = splitSignUp(parsed.data);

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: meta, emailRedirectTo: `${env.siteUrl}/auth/callback?next=/app` },
  });
  if (error) return { error: error.message };

  if (data.user) {
    if (intakeReason) {
      // The sign-up trigger already created his profile_intake row (empty); fill it in.
      const { error: ie } = await supabaseService().from("profile_intake")
        .upsert({ profile_id: data.user.id, intake_reason: intakeReason }, { onConflict: "profile_id" });
      if (ie) console.error("intake save failed", ie.message);
    }
    await sendTemplate(data.user.id, "welcome").catch(() => {});
    const { data: leaders } = await supabaseService().from("profiles").select("id")
      .in("role", ["leader", "admin"]).eq("status", "active");
    await Promise.all((leaders ?? []).map((l) => sendTemplate(l.id, "new_signup", { first: meta.first_name }).catch(() => {})));
  }
  return { ok: "Check your email to confirm your address. A leader will approve your account shortly." };
}

export async function logIn(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/app");
  const ip = (await clientIp()) ?? "unknown";
  if (!(await allow(`login:${ip}`, 20, 900)) || !(await allow(`login:${email}`, 8, 900))) {
    return { error: "Too many attempts. Wait 15 minutes and try again." };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email or password is incorrect." };
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/app");
}

export async function sendMagicLink(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const ip = (await clientIp()) ?? "unknown";
  if (!(await allow(`magic:${ip}`, 5, 900)) || !(await allow(`magic:${email}`, 3, 900))) {
    return { error: "Too many requests. Wait 15 minutes." };
  }
  const supabase = await supabaseServer();
  await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${env.siteUrl}/auth/callback?next=/app` },
  });
  // Same answer whether or not the email exists.
  return { ok: "If that email has an account, a sign-in link is on its way." };
}

export async function logOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
