/** App-side checks for the sequential program and Steven's Oct 2026 polish list. */
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
const { loadProgram, nextStep } = await import("./program");
const { daysLabel } = await import("./time");
const { isActive } = await import("./nav");

const mod = (key: string, order_no: number) => ({ id: key, key, order_no, title: key, description: null });
const step = (module_id: string, order_no: number, extra: object = {}) => ({
  id: `${module_id}-${order_no}`, module_id, order_no, item_number: module_id === "key_2" ? order_no : null,
  title: `${module_id} ${order_no}`, description: null, turn_in: false, gate_type: "triple",
  requires_upload: false, due_day: null, helper: null, ...extra,
});
const prog = (step_id: string, status: string) => ({ id: `sp-${step_id}`, step_id, man_id: "m", status });

function fakeDb(tables: Record<string, unknown[]>) {
  return {
    from(t: string) {
      const res = Promise.resolve({ data: tables[t] ?? [], error: null });
      const chain: Record<string, unknown> = { then: res.then.bind(res) };
      for (const k of ["select", "order", "eq", "in"]) chain[k] = () => chain;
      return chain;
    },
  } as unknown as SupabaseClient;
}

function program(progress: { step_id: string; status: string }[], watched: string[] = [], milestones: string[] = []) {
  const steps = [
    step("welcome", 1, { gate_type: "self" }),
    step("key_1", 1, { gate_type: "self", helper: { type: "worksheet" }, title: "Fishing worksheet" }),
    step("key_1", 2, { gate_type: "self_ap" }),
    ...[1, 2, 3, 4].map((n) => step("key_2", n, n === 2 ? { helper: { background: true } } : {})),
  ];
  return loadProgram(fakeDb({
    program_modules: [mod("welcome", 1), mod("key_1", 2), mod("key_2", 3)],
    program_steps: steps,
    step_progress: progress.map((p) => prog(p.step_id, p.status)),
    videos: [1, 2, 3].map((n) => ({ id: `v${n}`, module_id: "key_1", order_no: n, title: `Video ${n}`, video_url: null })),
    video_progress: watched.map((v) => ({ video_id: v, watched_at: "2026-10-01", notes: null })),
    milestones: milestones.map((type) => ({ type })),
  }), "m");
}

describe("My Program lock notes (mirror of app.lock_reason)", () => {
  it("a locked key hides behind 'Finish Key N first.'", async () => {
    const p = await program([{ step_id: "welcome-1", status: "open" }]);
    expect(p.byKey.key_1.unlocked).toBe(false);
    expect(p.byKey.key_1.lockNote).toBe("Finish Module 0 first.");
    expect(p.byKey.key_2.lockNote).toBe("Finish Key 1 first.");
    expect(p.byKey.key_2.steps.every((s) => s.lockNote === "Finish Key 1 first.")).toBe(true);
  });

  it("Key 1 opens with its videos, one at a time; the worksheet waits for all 3", async () => {
    const p = await program([{ step_id: "welcome-1", status: "self_initialed" }], ["v1"]);
    const k1 = p.byKey.key_1;
    expect(k1.unlocked).toBe(true);
    expect(k1.videos.map((v) => v.lockNote)).toEqual([null, null, "Watch Video 2 first."]);
    expect(k1.steps[0].lockNote).toBe("Watch the 3 videos first.");
    expect(k1.steps[1].lockNote).toBe("Finish the Fishing worksheet first.");
    expect(nextStep(p).label).toBe("Watch Video 2");
  });

  it("Key 2 items: background items don't hold back the next one", async () => {
    const p = await program([
      { step_id: "welcome-1", status: "self_initialed" }, { step_id: "key_1-1", status: "self_initialed" },
      { step_id: "key_1-2", status: "ap_initialed" }, { step_id: "key_2-1", status: "self_initialed" },
      { step_id: "key_2-2", status: "open" }, { step_id: "key_2-3", status: "open" }, { step_id: "key_2-4", status: "locked" },
    ], ["v1", "v2", "v3"]);
    const k2 = p.byKey.key_2.steps;
    expect(k2.map((s) => s.lockNote)).toEqual([null, null, null, "Finish #3 first."]);
  });

  it("the dashboard's next step links to the real item page (was a 404 → console error)", async () => {
    const p = await program([{ step_id: "welcome-1", status: "open" }]);
    expect(nextStep(p).href).toBe("/app/step/sp-welcome-1");
  });
});

describe("polish", () => {
  it("only the current sidebar page is highlighted", () => {
    expect(isActive("/app/sponsor-desk", "/app/sponsor")).toBe(false);
    expect(isActive("/app/sponsor-desk", "/app/sponsor-desk")).toBe(true);
    expect(isActive("/app/sponsor", "/app/sponsor")).toBe(true);
    expect(isActive("/app/program", "/app")).toBe(false);
    expect(isActive("/leader/men/123", "/leader/men")).toBe(true);
  });

  it("day counts read sensibly", () => {
    expect(daysLabel(null)).toBe("No sobriety date set");
    expect(daysLabel(1)).toBe("1 day");
    expect(daysLabel(42)).toBe("42 days");
  });
});

describe("videos and key meanings (Oct 2026 follow-up)", () => {
  it("video links/passcodes load only for his own My Program (links: true)", async () => {
    const calls: string[] = [];
    const base = fakeDb({
      program_modules: [mod("key_1", 2)],
      videos: [{ id: "v1", module_id: "key_1", order_no: 1, title: "Video 1" }],
    });
    const db = { ...base, from: base.from, rpc: (fn: string) => { calls.push(fn); return Promise.resolve({ data: [{ video_id: "v1", video_url: "https://x.example/1", passcode: "pc" }] }); } } as unknown as SupabaseClient;
    const other = await loadProgram(db, "m");
    expect(calls).toEqual([]);
    expect(other.byKey.key_1.videos[0]).toMatchObject({ video_url: null, passcode: null });
    const mine = await loadProgram(db, "m", { links: true });
    expect(calls).toEqual(["video_links"]);
    expect(mine.byKey.key_1.videos[0]).toMatchObject({ video_url: "https://x.example/1", passcode: "pc" });
  });

  it("each key carries its meaning from the 3 Keys graphic", async () => {
    const { KEY_INFO, keyInfoFor, PROGRAM_PROMISE } = await import("./keys");
    expect(KEY_INFO.key_1).toMatchObject({ kingdom: "Real Repentance" });
    expect(KEY_INFO.key_2).toMatchObject({ kingdom: "Putting on the Full Armour" });
    expect(KEY_INFO.key_3).toMatchObject({ kingdom: "Preparing for the Harvest" });
    expect(keyInfoFor("key_3_part_1")).toBe(KEY_INFO.key_3);
    expect(keyInfoFor("key_3_part_2")).toBeNull(); // shown once, on Part 1
    expect(PROGRAM_PROMISE).toMatch(/as little as 2-4 weeks/);
    const { readFileSync } = await import("node:fs");
    const how = readFileSync(new URL("../app/(public)/how-it-works/page.tsx", import.meta.url), "utf8");
    expect(how).toMatch(/PROGRAM_PROMISE/);
    expect(how).toMatch(/KEY_INFO\.key_1/);
    expect(readFileSync(new URL("../app/(public)/page.tsx", import.meta.url), "utf8")).toMatch(/KEY_INFO/);
  });

  it("no real video links or passcodes are committed (the repo is public)", async () => {
    const { execSync } = await import("node:child_process");
    const hits = execSync(
      `git grep --untracked -nIiE "zoom\\.us/rec|vimeo\\.com/[0-9]|passcode\\s*[:=]\\s*[\\"'][^\\"']{4,}[\\"']" -- . ':!*.test.ts' ':!node_modules' ':!.next' || true`,
      { cwd: new URL("../..", import.meta.url).pathname, encoding: "utf8" });
    expect(hits.trim()).toBe("");
  });
});
