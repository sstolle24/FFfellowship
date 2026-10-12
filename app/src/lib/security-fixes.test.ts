/** Unit tests for the app-side fixes from the Oct 2026 independent security test. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkLimit, clientIpFrom } from "./ip";
import { splitSignUp } from "./signup";
import { emailLogMeta } from "./email-meta";
import { PURGE_TABLES, purgeDeletedAccount } from "./purge";
import { turnInType } from "./mime";

const hdrs = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
const root = join(__dirname, "..", "..");

describe("L2: rate-limit IP and sign-up fail-closed", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers Netlify's client connection IP over a spoofable x-forwarded-for", () => {
    expect(clientIpFrom(hdrs({ "x-nf-client-connection-ip": "203.0.113.7", "x-forwarded-for": "1.2.3.4" }))).toBe("203.0.113.7");
  });

  it("on Netlify, ignores x-forwarded-for entirely", () => {
    vi.stubEnv("NETLIFY", "true");
    expect(clientIpFrom(hdrs({ "x-forwarded-for": "1.2.3.4" }))).toBeNull();
  });

  it("falls back to x-forwarded-for off Netlify", () => {
    vi.stubEnv("NETLIFY", "");
    expect(clientIpFrom(hdrs({ "x-forwarded-for": "1.2.3.4, 10.0.0.1" }))).toBe("1.2.3.4");
  });

  it("fails closed when asked (sign-up) and open otherwise", async () => {
    const boom = () => Promise.reject(new Error("db down"));
    const err = () => Promise.resolve({ data: null, error: { message: "x" } });
    expect(await checkLimit(boom, true)).toBe(false);
    expect(await checkLimit(err, true)).toBe(false);
    expect(await checkLimit(boom, false)).toBe(true);
    expect(await checkLimit(() => Promise.resolve({ data: false, error: null }), false)).toBe(false);
    expect(await checkLimit(() => Promise.resolve({ data: true, error: null }), true)).toBe(true);
  });
});

describe("L3: intake_reason never goes into user metadata", () => {
  it("splits it out of the sign-up form", () => {
    const r = splitSignUp({ email: "a@b.c", password: "pw", first_name: "Al", intake_reason: "  private  " });
    expect(r.meta).toEqual({ first_name: "Al" });
    expect(r.meta).not.toHaveProperty("intake_reason");
    expect(r.intakeReason).toBe("private");
    expect(splitSignUp({ email: "a", password: "b", intake_reason: "  " }).intakeReason).toBeNull();
  });

  it("the sign-up action sends `meta` (not the raw form) and writes intake with the service client", () => {
    const src = readFileSync(join(root, "src/app/(public)/auth-actions.ts"), "utf8");
    expect(src).toMatch(/options: \{ data: meta,/);
    expect(src).toMatch(/from\("profile_intake"\)\s*\.upsert/);
  });
});

describe("L4: account purge", () => {
  function fakeDb(files: string[]) {
    const calls: string[] = [];
    const q = (table: string) => {
      const chain: Record<string, unknown> = {};
      const ok = Promise.resolve({ data: table === "submissions" ? files.map((f) => ({ file_path: f })) : null, error: null });
      for (const m of ["select", "not"]) chain[m] = () => chain;
      chain.eq = (col: string, v: string) => { calls.push(`${table}.${(chain as { op?: string }).op ?? "select"}.${col}=${v}`); return chain; };
      chain.delete = () => { (chain as { op?: string }).op = "delete"; return chain; };
      chain.update = (vals: object) => { calls.push(`${table}.update ${JSON.stringify(vals)}`); (chain as { op?: string }).op = "update"; return chain; };
      chain.then = ok.then.bind(ok);
      return chain;
    };
    const db = {
      from: q,
      storage: { from: () => ({ remove: (p: string[]) => { calls.push(`storage.remove ${p.join(",")}`); return Promise.resolve({ error: null }); } }) },
      auth: { admin: { deleteUser: (id: string) => { calls.push(`auth.deleteUser ${id}`); return Promise.resolve({ error: null }); } } },
    };
    return { db: db as unknown as SupabaseClient, calls };
  }

  it("removes files, every personal table, contact fields, then the auth user", async () => {
    const { db, calls } = fakeDb(["u1/s/1/a.pdf"]);
    expect(await purgeDeletedAccount(db, "u1")).toBe(1);
    expect(PURGE_TABLES).toEqual(expect.arrayContaining(
      ["video_progress", "meeting_logs", "fishing_contacts", "panic_events", "match_requests", "submissions", "worksheet_answers", "journal_entries"]));
    for (const t of PURGE_TABLES) {
      expect(calls).toContain(`${t}.delete.${t === "match_requests" ? "requester_id" : "man_id"}=u1`);
    }
    expect(calls).toContain("storage.remove u1/s/1/a.pdf");
    expect(calls).toContain(`profiles.update {"phone":null,"signal":null,"city":null,"email":null}`);
    expect(calls[calls.length - 1]).toBe("auth.deleteUser u1");
  });
});

describe("L5: email_log meta", () => {
  it("keeps only template, dedupe key and step id", () => {
    expect(emailLogMeta("returned", { stepId: "s1" })).toEqual({ template: "returned", dedupe: null, step_id: "s1" });
    expect(emailLogMeta("inactive_3d", { dedupeKey: "2026-10-01" })).toEqual({ template: "inactive_3d", dedupe: "2026-10-01", step_id: null });
  });

  it("sendTemplate no longer spreads template variables (note text, phone) into the log", () => {
    const src = readFileSync(join(root, "src/lib/email.ts"), "utf8");
    expect(src).toMatch(/meta: emailLogMeta\(template, opts\)/);
    expect(src).not.toMatch(/meta: \{ \.\.\.vars/);
  });
});

describe("M5: turn-in uploads", () => {
  it("sends an allowed content type derived from the extension", () => {
    expect(turnInType("Steps.PDF")).toBe("application/pdf");
    expect(turnInType("photo.heic")).toBe("image/heic");
    expect(turnInType("page.html")).toBeNull();
    expect(turnInType("noext")).toBeNull();
  });

  it("every allowed upload type is in the bucket's allowed_mime_types", async () => {
    const { TURN_IN_TYPES } = await import("./mime");
    const sql = readFileSync(join(root, "supabase/migrations/0004_security_fixes.sql"), "utf8");
    for (const t of new Set(Object.values(TURN_IN_TYPES))) expect(sql).toContain(`'${t}'`);
  });

  it("signed URLs are created as downloads", () => {
    for (const f of ["src/app/app/step/[spId]/page.tsx", "src/app/app/packet/[manId]/page.tsx"]) {
      const src = readFileSync(join(root, f), "utf8");
      expect(src, f).toMatch(/createSignedUrl\([^)]*\{ download: true \}\)/);
    }
  });
});

describe("L6: runtime and dependency versions", () => {
  it("Netlify builds on Node 22", () => {
    expect(readFileSync(join(root, "netlify.toml"), "utf8")).toMatch(/NODE_VERSION = "22"/);
  });
  it("next is on the latest patched 15.x and vitest on 5.x", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(pkg.dependencies.next).toBe("15.5.27");
    expect(pkg.devDependencies.vitest).toMatch(/^\^5\./);
  });
});
