/**
 * Security + gate tests against a real Postgres built from the migrations.
 * Run:  npm run test:db   (resets the DB via supabase/tests/reset_test_db.sh first)
 *
 * Each `as(user)` call runs inside a transaction with the same role and JWT
 * claims Supabase's PostgREST would set, then rolls back nothing — writes stick
 * so later steps can build on them. Tests run in order.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Pool, PoolClient } from "pg";

const pool = new Pool({
  host: process.env.PGHOST ?? "/home/claude/pgtest",
  port: Number(process.env.PGPORT ?? 54329),
  user: "postgres",
  database: process.env.PGDATABASE ?? "ff_test",
});

type Who = string | null; // user id, or null for anon

async function as<T>(who: Who, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    if (who === null) {
      await c.query("set local role anon");
    } else {
      await c.query("set local role authenticated");
      await c.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: who, role: "authenticated" }),
      ]);
    }
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}
const admin = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows;
const rpc = (who: Who, fn: string, ...args: unknown[]) =>
  as(who, async (c) => {
    const ph = args.map((_, i) => `$${i + 1}`).join(", ");
    return (await c.query(`select public.${fn}(${ph}) as r`, args)).rows[0].r;
  });
const rows = (who: Who, sql: string, params: unknown[] = []) =>
  as(who, async (c) => (await c.query(sql, params)).rows);

async function newUser(first: string, extra: Record<string, unknown> = {}) {
  const [{ id }] = await admin(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${first.toLowerCase()}@test.local`, JSON.stringify({ first_name: first, intake_reason: `${first}'s private intake`, ...extra })],
  );
  return id as string;
}
async function stepId(module: string, item: number | null, order = 1) {
  const [r] = await admin(
    `select ps.id from program_steps ps join program_modules pm on pm.id = ps.module_id
      where pm.key = $1 and ${item === null ? "ps.order_no = $2" : "ps.item_number = $2"}`,
    [module, item ?? order],
  );
  return r.id as string;
}
async function sp(man: string, module: string, item: number | null, order = 1) {
  const step = await stepId(module, item, order);
  const [r] = await admin(`select id, status from step_progress where man_id = $1 and step_id = $2`, [man, step]);
  return r as { id: string; status: string };
}

let LEADER: string, LEADER2: string, ADMIN: string, SPONSOR: string, N1: string, N2: string, PENDING: string;

beforeAll(async () => {
  LEADER = await newUser("Larry");
  LEADER2 = await newUser("Luke");
  ADMIN = await newUser("Adam");
  SPONSOR = await newUser("Sam");
  N1 = await newUser("Nate", { sobriety_start_date: "2026-09-01" });
  N2 = await newUser("Ned");
  PENDING = await newUser("Pete");
  // Bootstrap: first admin + leaders are set directly (the only time we bypass functions).
  await admin(`update profiles set status='active', role='admin' where id = $1`, [ADMIN]);
  await admin(`update profiles set status='active', role='leader' where id in ($1,$2)`, [LEADER, LEADER2]);
  await rpc(LEADER, "approve_member", SPONSOR, null);
  await rpc(ADMIN, "set_member_role", SPONSOR, "ap_sponsor");
  await rpc(LEADER, "approve_member", N1, LEADER);
  await rpc(LEADER, "approve_member", N2, LEADER);
});
afterAll(() => pool.end());

describe("sign-up & roles", () => {
  it("creates a pending profile from sign-up metadata", async () => {
    const [p] = await admin(`select role, status, first_name from profiles where id = $1`, [PENDING]);
    expect(p).toEqual({ role: "pending", status: "pending", first_name: "Pete" });
  });

  it("approval opens Module 0 for the man", async () => {
    const s = await sp(N1, "welcome", null);
    expect(s.status).toBe("open");
    expect((await sp(N1, "key_1", null)).status).toBe("locked");
  });

  it("a member cannot change his own role or status", async () => {
    await expect(rows(N1, `update profiles set role='admin' where id = $1`, [N1])).rejects.toThrow(/permission denied/);
    await expect(rows(N1, `update profiles set status='active' where id = $1`, [N1])).rejects.toThrow(/permission denied/);
  });

  it("only an admin can change roles", async () => {
    await expect(rpc(LEADER, "set_member_role", N2, "leader")).rejects.toThrow(/Only an admin/);
  });

  it("intake_reason is leaders-only", async () => {
    expect(await rows(N1, `select * from profile_intake`)).toHaveLength(0);
    expect((await rows(LEADER, `select * from profile_intake where profile_id = $1`, [N1]))[0].intake_reason)
      .toBe("Nate's private intake");
  });

  it("a newcomer can read his own profile but not another man's", async () => {
    const r = await rows(N1, `select id from profiles`);
    expect(r.map((x) => x.id)).toEqual([N1]);
  });
});

describe("meetings", () => {
  beforeAll(async () => {
    await admin(`update meetings set zoom_url='https://zoom.example/secret', zoom_id='111', zoom_password='pw'`);
  });

  it("anon cannot read meetings.zoom_* (required)", async () => {
    await expect(rows(null, `select zoom_url, zoom_id, zoom_password from meetings`)).rejects.toThrow(/permission denied/);
    await expect(rpc(null, "join_meeting", "00000000-0000-0000-0000-000000000000")).rejects.toThrow(/permission denied/);
  });

  it("anon gets the public schedule with no link columns", async () => {
    const r = await rows(null, `select * from meetings_public`);
    expect(r.length).toBe(9);
    expect(Object.keys(r[0]).sort()).toEqual(["beginner", "day_of_week", "id", "name", "start_time_utc", "tagline"]);
  });

  it("pending members can see links (Steven's decision); joins are recorded", async () => {
    expect((await rows(PENDING, `select zoom_url from meetings`))[0].zoom_url).toContain("zoom");
    const [m] = await admin(`select id from meetings limit 1`);
    const r = await rpc(N1, "join_meeting", m.id);
    expect(r.zoom_url).toContain("zoom");
    expect(await rows(N1, `select * from meeting_link_joins`)).toHaveLength(1);
  });

  it("pending members cannot read program content", async () => {
    expect(await rows(PENDING, `select * from program_steps`)).toHaveLength(0);
  });
});

describe("Module 0 → Key 1", () => {
  it("self gate completes Module 0 and opens Key 1", async () => {
    const s = await sp(N1, "welcome", null);
    const r = await rpc(N1, "initial_self", s.id);
    expect(r.events.some((e: { type: string; module: string }) => e.type === "module_unlocked" && e.module === "key_1")).toBe(true);
    const [p] = await admin(`select stage from profiles where id = $1`, [N1]);
    expect(p.stage).toBe("key_1");
  });

  it("the AP step needs videos and worksheet first", async () => {
    const apStep = await sp(N1, "key_1", null, 2);
    await expect(rpc(N1, "initial_self", apStep.id)).rejects.toThrow(/videos/);
  });

  it("worksheet needs every question answered", async () => {
    const ws = await sp(N1, "key_1", null, 1);
    await expect(rpc(N1, "initial_self", ws.id)).rejects.toThrow(/Answer every question/);
    const qs = await rows(N1, `select q.id from worksheet_questions q join program_modules m on m.id=q.module_id where m.key='key_1'`);
    await as(N1, async (c) => {
      for (const q of qs) await c.query(`insert into worksheet_answers (man_id, question_id, slot, answer) values ($1,$2,1,'answer')`, [N1, q.id]);
      const vids = await c.query(`select v.id from videos v join program_modules m on m.id=v.module_id where m.key='key_1'`);
      for (const v of vids.rows) await c.query(`insert into video_progress (man_id, video_id, watched_at, notes) values ($1,$2,now(),'notes')`, [N1, v.id]);
    });
    await rpc(N1, "initial_self", ws.id);
    // locked after initial
    await expect(as(N1, (c) => c.query(`update worksheet_answers set answer='edit' where man_id=$1`, [N1]))).rejects.toThrow(/locked/);
    // snapshot submission created
    expect(await rows(N1, `select * from submissions where step_progress_id = $1`, [ws.id])).toHaveLength(1);
  });

  it("with no AP/sponsor, only his primary leader may give the Key 1 AP confirmation", async () => {
    const apStep = await sp(N1, "key_1", null, 2);
    await rpc(N1, "initial_self", apStep.id);
    await expect(rpc(N2, "initial_ap", apStep.id)).rejects.toThrow(/Only his active AP/);
    await expect(rpc(LEADER2, "initial_ap", apStep.id)).rejects.toThrow(/Only his active AP/);
    const r = await rpc(LEADER, "initial_ap", apStep.id);
    expect(r.events.some((e: { module: string }) => e.module === "key_2")).toBe(true);
  });
});

describe("matching", () => {
  let reqId: string;
  it("newcomer's request shows on the Sponsor Board with limited fields only", async () => {
    reqId = (await rpc(N1, "create_match_request", "sponsor", "America/Chicago", "evenings", "call", "private note")).id;
    const board = await rows(SPONSOR, `select * from sponsor_board`);
    expect(board).toHaveLength(1);
    expect(board[0].first_name).toBe("Nate");
    expect(board[0]).not.toHaveProperty("notes");
    expect(board[0]).not.toHaveProperty("requester_id");
    expect(await rows(N2, `select * from sponsor_board`)).toHaveLength(0); // newcomer role
    expect(await rows(SPONSOR, `select * from match_requests`)).toHaveLength(0); // notes hidden
  });

  it("offer → accept → leader confirm makes the sponsor active", async () => {
    await rpc(SPONSOR, "offer_match", reqId);
    const [offer] = await rows(N1, `select id from match_offers where request_id = $1`, [reqId]);
    const r = await rpc(N1, "accept_offer", offer.id);
    expect(r.events[0].type).toBe("match_needs_leader");
    // not active yet → no access
    expect(await rows(SPONSOR, `select * from step_progress where man_id = $1`, [N1])).toHaveLength(0);
    await rpc(LEADER, "leader_confirm_relationship", r.events[0].relationship_id);
    expect((await rows(SPONSOR, `select * from step_progress where man_id = $1`, [N1])).length).toBeGreaterThan(0);
    // matched man can now read the notes
    expect((await rows(SPONSOR, `select notes from match_requests where id = $1`, [reqId]))[0].notes).toBe("private note");
  });

  it("leader matches N1 and N2 as mutual APs", async () => {
    await rpc(LEADER, "leader_create_relationship", N2, N1, "ap");
    expect((await rows(N1, `select * from step_progress where man_id = $1`, [N2])).length).toBeGreaterThan(0);
    expect((await rows(N2, `select * from step_progress where man_id = $1`, [N1])).length).toBeGreaterThan(0);
  });
});

describe("Key 2 — triple gate", () => {
  it("orange item can't be initialed without a turn-in", async () => {
    const s = await sp(N1, "key_2", 9);
    await expect(rpc(N1, "initial_self", s.id)).rejects.toThrow(/Turn in/);
    await rpc(N1, "add_submission", s.id, "My steps 1, 2 and 3", null);
    await rpc(N1, "initial_self", s.id);
  });

  it("upload paths must be inside his own folder", async () => {
    const s = await sp(N1, "key_2", 10);
    await expect(rpc(N1, "add_submission", s.id, null, `${N2}/x/1/file.pdf`)).rejects.toThrow(/path/);
  });

  it("nobody can initial his own item in someone else's column", async () => {
    const s = await sp(N1, "key_2", 9);
    await expect(rpc(N1, "initial_ap", s.id)).rejects.toThrow(/own item/);
  });

  it("leader can't initial before the AP", async () => {
    const s = await sp(N1, "key_2", 9);
    await expect(rpc(LEADER, "initial_leader", s.id)).rejects.toThrow(/AP/);
  });

  it("only an active AP/sponsor can AP-initial; returns require a note", async () => {
    const s = await sp(N1, "key_2", 9);
    await expect(rpc(PENDING, "initial_ap", s.id)).rejects.toThrow();
    await expect(rpc(N2, "return_step", s.id, "  ")).rejects.toThrow(/note is required/);
    await rpc(N2, "return_step", s.id, "Step 3 page is missing");
    expect((await sp(N1, "key_2", 9)).status).toBe("returned");
  });

  it("after a return he must turn in a new version before re-initialing", async () => {
    const s = await sp(N1, "key_2", 9);
    await expect(rpc(N1, "initial_self", s.id)).rejects.toThrow(/Turn in/);
    const r = await rpc(N1, "add_submission", s.id, "Steps 1, 2 and 3 — all pages", null);
    expect(r.version).toBe(2);
    await rpc(N1, "initial_self", s.id);
    await rpc(N2, "initial_ap", s.id);
    await rpc(LEADER, "initial_leader", s.id);
    expect((await sp(N1, "key_2", 9)).status).toBe("leader_initialed");
  });

  it("a man cannot approve his own leader gate, even as a leader (required)", async () => {
    // Put LEADER2's own Key 2 item #1 at the leader column.
    await admin(`insert into step_progress (man_id, step_id, status) values ($1, $2, 'ap_initialed') on conflict do nothing`,
      [LEADER2, await stepId("key_2", 1)]);
    const own = await sp(LEADER2, "key_2", 1);
    await expect(rpc(LEADER2, "initial_leader", own.id)).rejects.toThrow(/your own leader gate/);
    await expect(rpc(LEADER2, "leader_certify_key2", LEADER2)).rejects.toThrow(/yourself/);
    // a non-leader can't give leader initials at all
    const s = await sp(N1, "key_2", 1);
    await expect(rpc(N2, "initial_leader", s.id)).rejects.toThrow(/Only leaders/);
  });

  it("#20 cover sheet blocks until every orange turn-in is uploaded", async () => {
    const s20 = await sp(N1, "key_2", 20);
    await expect(rpc(N1, "initial_self", s20.id)).rejects.toThrow(/missing for items: 10, 11, 13, 14, 15/);
  });

  it("all 21 + leader confirmation → Detox-21 certified, Key 3 opens", async () => {
    for (let n = 1; n <= 21; n++) {
      const s = await sp(N1, "key_2", n);
      if (s.status === "leader_initialed") continue;
      if ([10, 11, 13, 14, 15].includes(n)) await rpc(N1, "add_submission", s.id, `item ${n}`, null);
      await rpc(N1, "initial_self", s.id);
      await rpc(SPONSOR, "initial_ap", s.id); // sponsor may give AP initials too
      if (n === 13) await expect(rpc(N2, "set_read_to_group", s.id, true)).rejects.toThrow(/Leaders only/);
      if (n === 13) await rpc(LEADER, "set_read_to_group", s.id, true);
      await rpc(LEADER, "initial_leader", s.id);
    }
    expect((await sp(N1, "key_3_part_1", null)).status).toBe("locked"); // needs leader confirm
    await expect(rpc(N2, "leader_certify_key2", N1)).rejects.toThrow(/Leaders only/);
    const r = await rpc(LEADER, "leader_certify_key2", N1);
    expect(r.events.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(["milestone", "module_unlocked"]));
    expect((await sp(N1, "key_3_part_1", null)).status).toBe("open");
    expect((await sp(N1, "key_3_part_2", null)).status).toBe("locked");
    expect((await admin(`select stage from profiles where id=$1`, [N1]))[0].stage).toBe("key_3");
  });
});

describe("Key 3 → certification", () => {
  async function answerAll(man: string, module: string) {
    const qs = await rows(man, `select q.id from worksheet_questions q join program_modules m on m.id=q.module_id where m.key=$1 and q.answer_slots>0`, [module]);
    await as(man, async (c) => {
      for (const q of qs) await c.query(`insert into worksheet_answers (man_id, question_id, slot, answer) values ($1,$2,1,'a')`, [man, q.id]);
    });
  }
  it("Part 2 opens once Part 1 is self-initialed", async () => {
    await answerAll(N1, "key_3_part_1");
    const p1 = await sp(N1, "key_3_part_1", null);
    await rpc(N1, "initial_self", p1.id);
    expect((await sp(N1, "key_3_part_2", null)).status).toBe("open");
  });

  it("both parts leader-initialed → keys_complete → certification_review", async () => {
    await answerAll(N1, "key_3_part_2");
    const p1 = await sp(N1, "key_3_part_1", null);
    const p2 = await sp(N1, "key_3_part_2", null);
    await rpc(N1, "initial_self", p2.id);
    for (const s of [p1, p2]) { await rpc(N2, "initial_ap", s.id); await rpc(LEADER, "initial_leader", s.id); }
    expect((await admin(`select stage from profiles where id=$1`, [N1]))[0].stage).toBe("certification_review");
    expect((await sp(N1, "certification", null)).status).toBe("open");
  });

  it("leader approves the packet → fellowship certified; sponsor gets certified_another", async () => {
    const c = await sp(N1, "certification", null);
    await rpc(N1, "initial_self", c.id);
    await expect(rpc(N2, "initial_leader", c.id)).rejects.toThrow(/Only leaders/);
    await rpc(LEADER, "initial_leader", c.id);
    expect((await admin(`select stage from profiles where id=$1`, [N1]))[0].stage).toBe("certified");
    await rpc(LEADER, "leader_award_certified_another", SPONSOR, N1);
    expect((await admin(`select type from milestones where man_id=$1`, [SPONSOR])).map((r) => r.type)).toContain("certified_another");
  });
});

describe("privacy", () => {
  it("a newcomer cannot read another newcomer's submissions (required)", async () => {
    // N3 has no relationship with N1.
    const N3 = await newUser("Neil");
    await rpc(LEADER, "approve_member", N3, LEADER);
    expect(await rows(N3, `select * from submissions where man_id = $1`, [N1])).toHaveLength(0);
    expect(await rows(N3, `select * from step_progress where man_id = $1`, [N1])).toHaveLength(0);
    expect(await rows(N3, `select * from worksheet_answers where man_id = $1`, [N1])).toHaveLength(0);
    // storage objects follow the same rule
    await admin(`insert into storage.objects (bucket_id, name) values ('submissions', $1)`, [`${N1}/step/1/file.pdf`]);
    expect(await rows(N3, `select * from storage.objects`)).toHaveLength(0);
    expect(await rows(N2, `select * from storage.objects`)).toHaveLength(1); // his AP
    await expect(as(N3, (c) => c.query(`insert into storage.objects (bucket_id, name) values ('submissions', $1)`, [`${N1}/x/1/evil.pdf`])))
      .rejects.toThrow(/row-level security/);
  });

  it("an ended sponsor loses access immediately (required)", async () => {
    expect((await rows(SPONSOR, `select * from submissions where man_id = $1`, [N1])).length).toBeGreaterThan(0);
    const [rel] = await rows(N1, `select id from relationships where mentor_id = $1 and status='active'`, [SPONSOR]);
    await rpc(N1, "end_relationship", rel.id);
    expect(await rows(SPONSOR, `select * from submissions where man_id = $1`, [N1])).toHaveLength(0);
    expect(await rows(SPONSOR, `select * from storage.objects`)).toHaveLength(0);
    expect(await rows(SPONSOR, `select * from meeting_logs where man_id = $1`, [N1])).toHaveLength(0);
  });

  it("unshared journal: owner + leaders only; shared: also his AP", async () => {
    await as(N1, (c) => c.query(`insert into journal_entries (man_id, body, shared_with_mentors) values ($1,'private',false),($1,'shared',true)`, [N1]));
    expect((await rows(N2, `select body from journal_entries where man_id=$1`, [N1])).map((r) => r.body)).toEqual(["shared"]);
    expect(await rows(LEADER, `select body from journal_entries where man_id=$1`, [N1])).toHaveLength(2);
  });

  it("leader notes are leaders-only", async () => {
    await as(LEADER, (c) => c.query(`insert into leader_notes (man_id, leader_id, body) values ($1,$2,'note')`, [N1, LEADER]));
    expect(await rows(N1, `select * from leader_notes`)).toHaveLength(0);
  });

  it("contact info follows opt-ins only", async () => {
    await admin(`update profiles set phone='555-0100', city='Falls City' where id=$1`, [N2]);
    let r = await rows(N1, `select * from member_contacts where id=$1`, [N2]);
    expect(r).toHaveLength(0);
    await as(N2, (c) => c.query(`update contact_sharing set directory_opt_in=true, share_city=true where profile_id=$1`, [N2]));
    r = await rows(N1, `select * from member_contacts where id=$1`, [N2]);
    expect(r[0].city).toBe("Falls City");
    expect(r[0].phone).toBeNull();
    expect(await rows(null, `select * from member_contacts`).catch(() => "denied")).toBe("denied");
  });

  it("panic button is rate-limited", async () => {
    for (let i = 0; i < 3; i++) await rpc(N1, "trigger_panic");
    await expect(rpc(N1, "trigger_panic")).rejects.toThrow(/Alert already sent/);
  });

  it("approvals land in the audit log", async () => {
    const r = await admin(`select action, count(*)::int n from audit_log group by action`);
    const by = Object.fromEntries(r.map((x) => [x.action, x.n]));
    for (const a of ["initial_ap", "initial_leader", "return_step", "relationship_ended", "role_changed", "member_approved"])
      expect(by[a], a).toBeGreaterThan(0);
  });

  it("export + delete my account", async () => {
    const data = await rpc(N2, "export_my_data");
    expect(data.profile.id).toBe(N2);
    await rpc(N2, "delete_my_account");
    expect(await rows(N1, `select * from step_progress where man_id=$1`, [N2])).toHaveLength(0); // AP link ended
  });
});
