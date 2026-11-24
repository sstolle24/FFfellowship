import "server-only";
import { env } from "@/lib/env";
import { holidayOn, type Holiday } from "@/lib/holiday";

/** Holiday settings (0030), fetched without a session and cached for 5 minutes, so pages stay fast. */
export async function getHoliday(): Promise<{ holiday: Holiday | null; on: boolean }> {
  if (!env.supabaseUrl) return { holiday: null, on: false };
  try {
    const res = await fetch(`${env.supabaseUrl}/rest/v1/rpc/holiday_settings`, {
      method: "POST",
      headers: { apikey: env.supabaseAnonKey, Authorization: `Bearer ${env.supabaseAnonKey}`, "Content-Type": "application/json" },
      body: "{}",
      next: { revalidate: 300, tags: ["holiday"] },
    });
    if (!res.ok) return { holiday: null, on: false };
    const holiday = (await res.json()) as Holiday | null;
    return { holiday, on: holidayOn(holiday) };
  } catch {
    return { holiday: null, on: false };
  }
}
