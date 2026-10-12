import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { supabaseServer } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** The signed-in man's own profile (RLS: self row). Cached per request. */
export const getMe = cache(async (): Promise<Profile | null> => {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return (data as Profile) ?? null;
});

export async function requireUser() {
  const me = await getMe();
  if (!me || me.deleted_at) redirect("/login");
  return me;
}
/** Approved, active member (newcomer and up). Pending men get the shell instead. */
export async function requireActive() {
  const me = await requireUser();
  if (me.status !== "active") redirect("/app");
  return me;
}
export async function requireSponsorRole() {
  const me = await requireActive();
  if (!["ap_sponsor", "leader", "admin"].includes(me.role)) redirect("/app");
  return me;
}
export async function requireLeader() {
  const me = await requireActive();
  if (!["leader", "admin"].includes(me.role)) redirect("/app");
  return me;
}
export async function requireAdmin() {
  const me = await requireActive();
  if (me.role !== "admin") redirect("/leader");
  return me;
}
export const isLeader = (p: Profile | null) => !!p && p.status === "active" && (p.role === "leader" || p.role === "admin");
export const isSponsorRole = (p: Profile | null) =>
  !!p && p.status === "active" && ["ap_sponsor", "leader", "admin"].includes(p.role);
