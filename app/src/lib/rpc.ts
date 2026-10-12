import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { dispatchEvents } from "@/lib/events";
import type { RpcResult } from "@/lib/types";

export type ActionResult = { ok: true; data?: RpcResult } | { ok: false; error: string };

/** Calls a gate function as the signed-in user, then fans its events out to email. */
export async function callRpc(fn: string, args: Record<string, unknown> = {}): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: friendly(error.message) };
  const res = data as RpcResult;
  await dispatchEvents(res?.events);
  return { ok: true, data: res };
}

function friendly(msg: string) {
  if (/permission denied|JWT|not authenticated/i.test(msg)) return "You don't have access to do that.";
  return msg;
}
