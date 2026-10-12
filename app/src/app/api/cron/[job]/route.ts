import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";
import { runDaily, runWeeklyLeader, runWeeklyMember } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled jobs. Called by Vercel Cron, a Netlify scheduled function, or
 * Supabase pg_cron — always with `Authorization: Bearer <CRON_SECRET>`.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ job: string }> }) {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${env.cronSecret()}`);
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { job } = await params;
  const run = { daily: runDaily, "weekly-member": runWeeklyMember, "weekly-leader": runWeeklyLeader }[job];
  if (!run) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  const result = await run();
  return NextResponse.json({ job, ok: true, ...result });
}
