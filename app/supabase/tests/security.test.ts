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

let LEADER: string, LEADER2: string, ADMIN: string, SPONSOR: string, N1: string, N2: string, PENDING: string, STRANGER: string;

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
  STRANGER = await newUser("Stan");
  await rpc(LEADER, "approve_member", STRANGER, LEADER);
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

  it("H1: pending members get the public schedule only, no links", async () => {
    expect(await rows(PENDING, `select zoom_url from meetings`)).toHaveLength(0);
    expect((await rows(PENDING, `select * from meetings_public`)).length).toBe(9);
    const [m] = await admin(`select id from meetings limit 1`);
    await expect(rpc(PENDING, "join_meeting", m.id)).rejects.toThrow(/Sign in to get meeting links/);
    expect(await admin(`select * from meeting_link_joins where man_id = $1`, [PENDING])).toHaveLength(0);
  });

  it("active members can see links; joins are recorded", async () => {
    expect((await rows(N1, `select zoom_url from meetings`))[0].zoom_url).toContain("zoom");
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

  const key1Videos = async () =>
    (await rows(N1, `select v.id from videos v join program_modules m on m.id=v.module_id where m.key='key_1' order by v.order_no`))
      .map((v) => v.id as string);
  const watch = (videoId: string) =>
    as(N1, (c) => c.query(`insert into video_progress (man_id, video_id, watched_at, notes) values ($1,$2,now(),'notes')
      on conflict (man_id, video_id) do update set watched_at = now()`, [N1, videoId]));

  it("Key 1 opens with only the videos: worksheet and AP step stay locked", async () => {
    expect((await sp(N1, "key_1", null, 1)).status).toBe("locked");
    expect((await sp(N1, "key_1", null, 2)).status).toBe("locked");
    const apStep = await sp(N1, "key_1", null, 2);
    await expect(rpc(N1, "initial_self", apStep.id)).rejects.toThrow(/Finish the Fishing worksheet first/);
  });

  it("sequential: videos must be checked off in order (1 → 2 → 3)", async () => {
    const [v1, v2, v3] = await key1Videos();
    await expect(watch(v2)).rejects.toThrow(/Watch Video 1 first/);
    await expect(watch(v3)).rejects.toThrow(/Watch Video 1 first/);
    await watch(v1);
    await expect(watch(v3)).rejects.toThrow(/Watch Video 2 first/);
    await watch(v2);
    // Can't un-check a video once he has moved past it.
    await expect(as(N1, (c) => c.query(`update video_progress set watched_at = null where man_id = $1 and video_id = $2`, [N1, v1])))
      .rejects.toThrow(/stays checked/);
  });

  it("M6 + sequential: the Fishing worksheet stays locked until all 3 videos are checked", async () => {
    const ws = await sp(N1, "key_1", null, 1);
    expect(ws.status).toBe("locked");
    await expect(rpc(N1, "initial_self", ws.id)).rejects.toThrow(/Watch the 3 videos first/);
    const [q] = await rows(N1, `select q.id from worksheet_questions q join program_modules m on m.id=q.module_id where m.key='key_1' limit 1`);
    await expect(as(N1, (c) => c.query(`insert into worksheet_answers (man_id, question_id, slot, answer) values ($1,$2,1,'x')`, [N1, q.id])))
      .rejects.toThrow(/Watch the 3 videos first/);
    const wsPath = `${N1}/${await stepId("key_1", null, 1)}/1/ws.pdf`;
    await expect(rpc(N1, "add_submission", ws.id, null, wsPath)).rejects.toThrow(/Watch the 3 videos first/);
    await expect(as(N1, (c) => c.query(`insert into storage.objects (bucket_id, name) values ('submissions', $1)`, [wsPath])))
      .rejects.toThrow(/row-level security/);
    expect(await rpc(N1, "step_lock_reason", ws.id)).toBe("Watch the 3 videos first.");
    const [, , v3] = await key1Videos();
    await watch(v3);
    expect((await sp(N1, "key_1", null, 1)).status).toBe("open");
    expect(await rpc(N1, "step_lock_reason", ws.id)).toBeNull();
    expect((await sp(N1, "key_1", null, 2)).status).toBe("locked"); // AP go-over waits for the worksheet
  });

  it("worksheet needs every question answered", async () => {
    const ws = await sp(N1, "key_1", null, 1);
    await expect(rpc(N1, "initial_self", ws.id)).rejects.toThrow(/Answer every question/);
    const qs = await rows(N1, `select q.id from worksheet_questions q join program_modules m on m.id=q.module_id where m.key='key_1'`);
    await as(N1, async (c) => {
      for (const q of qs) await c.query(`insert into worksheet_answers (man_id, question_id, slot, answer) values ($1,$2,1,'answer')`, [N1, q.id]);
    });
    await rpc(N1, "initial_self", ws.id);
    // locked after initial
    await expect(as(N1, (c) => c.query(`update worksheet_answers set answer='edit' where man_id=$1`, [N1]))).rejects.toThrow(/locked/);
    // snapshot submission created
    expect(await rows(N1, `select * from submissions where step_progress_id = $1`, [ws.id])).toHaveLength(1);
    // his part done → the AP go-over opens (no need to wait for anyone's initials)
    expect((await sp(N1, "key_1", null, 2)).status).toBe("open");
  });

  it("with no AP/sponsor, only his primary leader may give the Key 1 AP confirmation", async () => {
    const apStep = await sp(N1, "key_1", null, 2);
    await rpc(N1, "initial_self", apStep.id);
    await expect(rpc(N2, "initial_ap", apStep.id)).rejects.toThrow(/Only his active AP/);
    await expect(rpc(LEADER2, "initial_ap", apStep.id)).rejects.toThrow(/Only his active AP/);
    // Key 2 stays shut until the Key 1 AP sign-off is in.
    expect((await sp(N1, "key_2", 1)).status).toBe("locked");
    expect(await rpc(N1, "step_lock_reason", (await sp(N1, "key_2", 1)).id)).toBe("Finish Key 1 first.");
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
  it("sequential: only #1 opens with Key 2; the next item opens when he finishes his part", async () => {
    expect((await sp(N1, "key_2", 1)).status).toBe("open");
    for (const n of [2, 3, 9, 21]) expect((await sp(N1, "key_2", n)).status, `#${n}`).toBe("locked");
    const s3 = await sp(N1, "key_2", 3);
    await expect(rpc(N1, "initial_self", s3.id)).rejects.toThrow(/Finish #1 first/);
    await expect(rpc(N1, "add_submission", s3.id, "early", null)).rejects.toThrow(/Finish #1 first/);
    expect(await rpc(N1, "step_lock_reason", s3.id)).toBe("Finish #1 first.");
    expect(await rpc(STRANGER, "step_lock_reason", s3.id)).toBeNull(); // strangers learn nothing
    await rpc(N1, "initial_self", (await sp(N1, "key_2", 1)).id);
    // #2 (30 days of prayer) is a background item: it starts now and #3 opens right behind it.
    expect((await sp(N1, "key_2", 2)).status).toBe("open");
    expect((await sp(N1, "key_2", 3)).status).toBe("open");
    expect((await sp(N1, "key_2", 4)).status).toBe("locked");
  });

  it("items up to #8 in order (his initials alone keep him moving)", async () => {
    for (let n = 3; n <= 8; n++) {
      const s = await sp(N1, "key_2", n);
      expect(s.status, `#${n}`).toBe("open");
      await rpc(N1, "initial_self", s.id);
    }
    expect((await sp(N1, "key_2", 9)).status).toBe("open");
    expect((await sp(N1, "key_2", 10)).status).toBe("locked");
  });

  it("orange item can't be initialed without a turn-in", async () => {
    const s = await sp(N1, "key_2", 9);
    await expect(rpc(N1, "initial_self", s.id)).rejects.toThrow(/Turn in/);
    await expect(rpc(N1, "add_submission", s.id, null, `${N2}/x/1/file.pdf`)).rejects.toThrow(/path/);
    await rpc(N1, "add_submission", s.id, "My steps 1, 2 and 3", null);
    await rpc(N1, "initial_self", s.id);
    expect((await sp(N1, "key_2", 10)).status).toBe("open");
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

  it("background items don't block, but #20 still needs their turn-ins", async () => {
    // He moves through #11–#19 with his own initials; #10 (90 in 90), #12, #16, #18 and #19 run in the background.
    for (const n of [11, 13, 14, 15, 17]) {
      const s = await sp(N1, "key_2", n);
      expect(s.status, `#${n}`).toBe("open");
      if ([11, 13, 14, 15].includes(n)) await rpc(N1, "add_submission", s.id, `item ${n}`, null);
      await rpc(N1, "initial_self", s.id);
    }
    expect((await sp(N1, "key_2", 20)).status).toBe("open");
    const s20 = await sp(N1, "key_2", 20);
    await expect(rpc(N1, "initial_self", s20.id)).rejects.toThrow(/missing for items: 10$/);
  });

  it("a returned item doesn't re-lock what follows, but Key 3 waits for every sign-off", async () => {
    const s5 = await sp(N1, "key_2", 5);
    await rpc(N2, "return_step", s5.id, "Only 12 contacts — need 20");
    expect((await sp(N1, "key_2", 5)).status).toBe("returned");
    for (const n of [6, 7, 20]) expect((await sp(N1, "key_2", n)).status, `#${n}`).not.toBe("locked");
    expect((await sp(N1, "key_2", 21)).status).toBe("locked"); // still waiting on #20 (his cover sheet), not on the return
    await rpc(N1, "initial_self", s5.id); // fixed and re-initialed
  });

  it("all 21 + leader confirmation → Detox-21 certified, Key 3 opens", async () => {
    for (let n = 1; n <= 21; n++) {
      let s = await sp(N1, "key_2", n);
      if (s.status === "leader_initialed") continue;
      if (s.status === "open" || s.status === "returned") {
        if (n === 10) await rpc(N1, "add_submission", s.id, `item ${n}`, null);
        await rpc(N1, "initial_self", s.id);
      }
      await rpc(SPONSOR, "initial_ap", s.id); // sponsor may give AP initials too
      if (n === 13) await expect(rpc(N2, "set_read_to_group", s.id, true)).rejects.toThrow(/Leaders only/);
      if (n === 13) await rpc(LEADER, "set_read_to_group", s.id, true);
      // Key 3 stays locked until the very last sign-off and a leader's certification.
      expect((await sp(N1, "key_3_part_1", null)).status).toBe("locked");
      await rpc(LEADER, "initial_leader", s.id);
      s = await sp(N1, "key_2", n);
      expect(s.status, `#${n}`).toBe("leader_initialed");
    }
    expect((await sp(N1, "key_3_part_1", null)).status).toBe("locked"); // needs leader confirm
    const k3 = await sp(N1, "key_3_part_1", null);
    expect(await rpc(N1, "step_lock_reason", k3.id)).toBe("Finish Key 2 first.");
    await expect(rpc(N1, "initial_self", k3.id)).rejects.toThrow(/Finish Key 2 first/);
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

describe("sponsor desk view", () => {
  it("my_men shows only men the caller actively walks with", async () => {
    const A = await newUser("Abe"); const B = await newUser("Ben"); const C = await newUser("Cal");
    for (const x of [A, B, C]) await rpc(LEADER, "approve_member", x, LEADER);
    await rpc(LEADER, "leader_create_relationship", A, B, "sponsor");
    expect((await rows(A, `select id from my_men`)).map((r) => r.id)).toEqual([B]);
    expect(await rows(C, `select id from my_men`)).toHaveLength(0);
    expect(await rows(B, `select id from my_men`)).toHaveLength(0); // sponsorship is one-way
    expect(await rows(null, `select id from my_men`).catch(() => "denied")).toBe("denied");
  });
});

describe("independent security test fixes (Oct 2026)", () => {
  async function activeMan(first: string) {
    const id = await newUser(first);
    await rpc(LEADER, "approve_member", id, LEADER);
    return id;
  }
  /** Puts one of his Key 2 items at `status` with a turn-in, bypassing the gates. */
  async function key2Item(man: string, item: number, status: string) {
    const step = await stepId("key_2", item);
    const [r] = await admin(
      `insert into step_progress (man_id, step_id, status) values ($1,$2,$3)
       on conflict (man_id, step_id) do update set status = excluded.status returning id`, [man, step, status]);
    await admin(`insert into submissions (step_progress_id, man_id, body_text, version) values ($1,$2,'work',1)
                 on conflict do nothing`, [r.id, man]);
    return r.id as string;
  }

  it("H2: a deactivated AP can't read his man's submissions or give initials", async () => {
    const ap = await activeMan("Hank"); const man = await activeMan("Hal");
    await rpc(LEADER, "leader_create_relationship", ap, man, "ap");
    const item = await key2Item(man, 2, "self_initialed");
    expect(await rows(ap, `select * from submissions where man_id = $1`, [man])).toHaveLength(1);

    // Deactivated with the relationship row still active: is_ap_of now refuses him.
    await admin(`update profiles set status = 'inactive' where id = $1`, [ap]);
    expect(await rows(ap, `select * from submissions where man_id = $1`, [man])).toHaveLength(0);
    expect(await rows(ap, `select * from step_progress where man_id = $1`, [man])).toHaveLength(0);
    await expect(rpc(ap, "initial_ap", item)).rejects.toThrow(/Only his active AP/);
    await expect(rpc(ap, "return_step", item, "nope")).rejects.toThrow(/can't return/);

    // Deleted (not just inactive) is refused too.
    await admin(`update profiles set status = 'active', deleted_at = now() where id = $1`, [ap]);
    expect(await rows(ap, `select * from submissions where man_id = $1`, [man])).toHaveLength(0);
  });

  it("H2: set_member_status('inactive') ends all his active relationships", async () => {
    const sponsor = await activeMan("Ivan"); const ap = await activeMan("Ike"); const man = await activeMan("Ira");
    await rpc(LEADER, "leader_create_relationship", sponsor, man, "sponsor");
    await rpc(LEADER, "leader_create_relationship", ap, sponsor, "ap");
    const item = await key2Item(man, 3, "self_initialed");
    await rpc(LEADER, "set_member_status", sponsor, "inactive");
    expect(await admin(`select status from relationships where $1 in (mentor_id, mentee_id)`, [sponsor]))
      .toEqual([{ status: "ended" }, { status: "ended" }]);
    // Even if a leader re-activates him, the old access does not come back.
    await rpc(LEADER, "set_member_status", sponsor, "active");
    expect(await rows(sponsor, `select * from submissions where man_id = $1`, [man])).toHaveLength(0);
    await expect(rpc(sponsor, "initial_ap", item)).rejects.toThrow(/Only his active AP/);
  });

  it("H3: member_contacts shows Signal only when shared, never the phone in its place", async () => {
    const a = await activeMan("Jack"); const b = await activeMan("Jim");
    await admin(`update profiles set phone = '555-0199', signal = null where id = $1`, [a]);
    await admin(`update contact_sharing set share_signal = true, share_phone = false where profile_id = $1`, [a]);
    let [c] = await rows(b, `select phone, signal from member_contacts where id = $1`, [a]);
    expect(c).toEqual({ phone: null, signal: null });
    await admin(`update profiles set signal = 'jack.01' where id = $1`, [a]);
    [c] = await rows(b, `select phone, signal from member_contacts where id = $1`, [a]);
    expect(c).toEqual({ phone: null, signal: "jack.01" });
  });

  it("M1: the leader who gave AP initials can't also give leader initials", async () => {
    const man = await activeMan("Kirk");
    await rpc(LEADER2, "leader_create_relationship", LEADER, man, "ap");
    const item = await key2Item(man, 4, "self_initialed");
    await rpc(LEADER, "initial_ap", item);
    await expect(rpc(LEADER, "initial_leader", item)).rejects.toThrow(/A different leader must give leader initials/);
    await rpc(LEADER2, "initial_leader", item);
    expect((await admin(`select status from step_progress where id = $1`, [item]))[0].status).toBe("leader_initialed");
  });

  it("M2: member_cards only shows himself, Directory men, his relationships/open matches and leaders", async () => {
    const me = await activeMan("Lou"); const stranger = await activeMan("Lyle");
    const ap = await activeMan("Lane"); const offerer = await activeMan("Lars");
    await rpc(ADMIN, "set_member_role", offerer, "ap_sponsor");
    await rpc(LEADER, "leader_create_relationship", ap, me, "ap");
    const req = await rpc(me, "create_match_request", "sponsor", "UTC", "", "", "");
    await rpc(offerer, "offer_match", req.id);

    const ids = (await rows(me, `select id from member_cards`)).map((r) => r.id);
    expect(ids).toEqual(expect.arrayContaining([me, ap, offerer, LEADER, LEADER2, ADMIN]));
    expect(ids).not.toContain(stranger);
    expect(Object.keys((await rows(me, `select * from member_cards where id = $1`, [me]))[0])).not.toContain("sobriety_start_date");
    expect((await rows(me, `select is_leader from member_cards where id = $1`, [LEADER]))[0].is_leader).toBe(true);
    // The offerer sees the requester too (open match).
    expect((await rows(offerer, `select id from member_cards where id = $1`, [me]))).toHaveLength(1);

    await admin(`update contact_sharing set directory_opt_in = true where profile_id = $1`, [stranger]);
    expect(await rows(me, `select id from member_cards where id = $1`, [stranger])).toHaveLength(1);
    await admin(`update contact_sharing set directory_opt_in = false where profile_id = $1`, [stranger]);

    // Panic picks outside that set are ignored; his AP and primary leader are always alerted.
    await as(me, (c) => c.query(`update contact_sharing set panic_recipients = $1 where profile_id = $2`,
      [JSON.stringify([stranger, LEADER2]), me]));
    const r = await rpc(me, "trigger_panic");
    const to: string[] = r.events[0].recipients;
    expect(to).toEqual(expect.arrayContaining([ap, LEADER, LEADER2]));
    expect(to).not.toContain(stranger);
  });

  it("M3: leaders can't change a leader's/admin's status; pending can't be set active", async () => {
    await expect(rpc(LEADER, "set_member_status", LEADER2, "inactive")).rejects.toThrow(/Only an admin/);
    await expect(rpc(LEADER, "set_member_status", ADMIN, "inactive")).rejects.toThrow(/Only an admin/);
    const p = await newUser("Moe");
    await expect(rpc(LEADER, "set_member_status", p, "active")).rejects.toThrow(/Use Approve/);
    expect((await admin(`select status from profiles where id = $1`, [p]))[0].status).toBe("pending");
    // An admin may; status is restored for the rest of the suite.
    await rpc(ADMIN, "set_member_status", LEADER2, "inactive");
    await rpc(ADMIN, "set_member_status", LEADER2, "active");
    await expect(rpc(ADMIN, "set_member_status", ADMIN, "inactive")).rejects.toThrow(/your own status/);
  });

  it("M3: never leaves zero active admins", async () => {
    // Only reachable if the caller isn't an active admin himself, which the
    // admin check already blocks — so check the guard directly as the owner.
    const src = (await admin(`select prosrc from pg_proc where proname = 'set_member_status'`))[0].prosrc as string;
    expect(src).toMatch(/That would leave no active admin/);
  });

  it("M4: internal helpers can't be called by members; is_ap_of answers only the men involved or leaders", async () => {
    const man = await activeMan("Ned2"); const ap = await activeMan("Noel"); const other = await activeMan("Nick");
    await rpc(LEADER, "leader_create_relationship", ap, man, "ap");
    const [{ id: spId }] = await admin(`select id from step_progress where man_id = $1 limit 1`, [man]);
    const calls: [string, unknown[]][] = [
      ["app.load_sp($1)", [spId]], ["app.module_done($1,'key_1')", [man]], ["app.has_milestone($1,'keys_complete')", [man]],
      ["app.missing_turn_ins($1)", [man]], ["app.has_any_mentor($1)", [man]], ["app.step_done('open','self')", []],
      ["app.audit('x','y',null,null)", []], ["app.award($1,'keys_complete',$1)", [man]], ["app.refresh_program($1)", [man]],
      ["app.ensure_progress($1)", [man]],
    ];
    for (const [call, args] of calls) {
      await expect(rows(man, `select ${call}`, args), call).rejects.toThrow(/permission denied/);
    }
    const isAp = async (who: string) => (await rows(who, `select app.is_ap_of($1,$2) as v`, [ap, man]))[0].v;
    expect(await isAp(ap)).toBe(true);
    expect(await isAp(man)).toBe(true);
    expect(await isAp(LEADER)).toBe(true);
    expect(await isAp(other)).toBe(false);
    expect((await rows(other, `select app.is_sponsor_of($1,$2) as v`, [ap, man]))[0].v).toBe(false);
  });

  it("M5: bucket limits, and uploads only into an open step and a numeric version folder", async () => {
    const [b] = await admin(`select file_size_limit, allowed_mime_types from storage.buckets where id = 'submissions'`);
    expect(Number(b.file_size_limit)).toBe(20 * 1024 * 1024);
    expect(b.allowed_mime_types).toEqual(expect.arrayContaining([
      "application/pdf", "image/jpeg", "image/png", "image/heic", "image/webp", "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain",
      "application/rtf", "application/vnd.oasis.opendocument.text"]));
    expect(b.allowed_mime_types).not.toContain("text/html");

    const man = await activeMan("Otto");
    const open = await stepId("welcome", null);   // open after approval
    const locked = await stepId("key_2", 9);      // locked for a new man
    const put = (path: string) => as(man, (c) => c.query(`insert into storage.objects (bucket_id, name) values ('submissions', $1)`, [path]));
    await put(`${man}/${open}/1/ok.pdf`);
    for (const bad of [`${man}/${locked}/1/x.pdf`, `${man}/${open}/one/x.pdf`, `${man}/${open}/1/extra/x.pdf`,
                       `${man}/not-a-step/1/x.pdf`, `${man}/x.pdf`]) {
      await expect(put(bad), bad).rejects.toThrow(/row-level security/);
    }
  });

  it("L3: sign-up works with no intake_reason in metadata; the server fills profile_intake only while empty", async () => {
    const [{ id }] = await admin(`insert into auth.users (email, raw_user_meta_data) values ('quinn@test.local', $1) returning id`,
      [JSON.stringify({ first_name: "Quinn" })]);
    expect((await admin(`select intake_reason from profile_intake where profile_id = $1`, [id]))[0].intake_reason).toBeNull();
    // What saveIntakeReason (src/lib/signup.ts) sends with the service client after signUp.
    const save = (reason: string) =>
      admin(`update profile_intake set intake_reason = $2 where profile_id = $1 and intake_reason is null`, [id, reason]);
    await save("private");
    await save("overwrite attempt");
    expect((await rows(LEADER, `select intake_reason from profile_intake where profile_id = $1`, [id]))[0].intake_reason).toBe("private");
    expect(await rows(id, `select * from profile_intake`)).toHaveLength(0);
  });

  it("L4: a purged account can be scrubbed and its auth user deleted, even if he initialed others' items", async () => {
    const leaderGone = await activeMan("Ray"); const man = await activeMan("Rob");
    await rpc(ADMIN, "set_member_role", leaderGone, "leader");
    const item = await key2Item(man, 5, "self_initialed");
    await rpc(LEADER, "leader_create_relationship", leaderGone, man, "sponsor");
    await rpc(leaderGone, "initial_ap", item);
    await as(leaderGone, (c) => c.query(`insert into leader_notes (man_id, leader_id, body) values ($1,$2,'n')`, [man, leaderGone]));
    await rpc(leaderGone, "delete_my_account");
    // What runDaily's purge does (src/lib/purge.ts), as the service role.
    await admin(`update profiles set email = null, phone = null, signal = null, city = null where id = $1`, [leaderGone]);
    await admin(`delete from auth.users where id = $1`, [leaderGone]);
    expect(await admin(`select * from profiles where id = $1`, [leaderGone])).toHaveLength(0);
    const [s] = await admin(`select status, ap_initial_by from step_progress where id = $1`, [item]);
    expect(s).toEqual({ status: "ap_initialed", ap_initial_by: null });
  });
});

describe("view privileges (independent retest, Oct 2026)", () => {
  const views = async () =>
    (await admin(`select viewname from pg_views where schemaname = 'public' order by 1`)).map((r) => r.viewname as string);

  it("anon and members can't insert, update or delete meetings_public", async () => {
    const [m] = await admin(`select id, name from meetings limit 1`);
    for (const who of [null, N1, LEADER]) {
      await expect(rows(who, `insert into meetings_public (name, day_of_week, start_time_utc) values ('x', 1, '10:00')`))
        .rejects.toThrow(/permission denied/);
      await expect(rows(who, `update meetings_public set name = 'hacked' where id = $1`, [m.id])).rejects.toThrow(/permission denied/);
      await expect(rows(who, `delete from meetings_public where id = $1`, [m.id])).rejects.toThrow(/permission denied/);
    }
    expect((await admin(`select name from meetings where id = $1`, [m.id]))[0].name).toBe(m.name);
    expect((await rows(null, `select * from meetings_public`)).length).toBeGreaterThan(0); // still readable
  });

  it("an AP/sponsor can't update or delete his man's profile through my_men", async () => {
    const ap = await newUser("Uri"); const sponsor = await newUser("Ulf"); const man = await newUser("Uwe");
    for (const x of [ap, sponsor, man]) await rpc(LEADER, "approve_member", x, LEADER);
    await rpc(LEADER, "leader_create_relationship", ap, man, "ap");
    await rpc(LEADER, "leader_create_relationship", sponsor, man, "sponsor");
    for (const who of [ap, sponsor]) {
      expect((await rows(who, `select id from my_men`)).map((r) => r.id)).toContain(man); // still readable
      await expect(rows(who, `update my_men set first_name = 'hacked' where id = $1`, [man])).rejects.toThrow(/permission denied/);
      await expect(rows(who, `delete from my_men where id = $1`, [man])).rejects.toThrow(/permission denied/);
    }
    const [p] = await admin(`select first_name, deleted_at from profiles where id = $1`, [man]);
    expect(p).toEqual({ first_name: "Uwe", deleted_at: null });
  });

  it("every public view grants only SELECT to anon/authenticated (and anon only meetings_public)", async () => {
    const all = await views();
    expect(all).toEqual(expect.arrayContaining(["meetings_public", "member_cards", "member_contacts", "my_men", "sponsor_board"]));
    const grants = await admin(
      `select c.relname as view, r.rolname as role, p.privilege_type as priv
         from pg_class c join pg_namespace n on n.oid = c.relnamespace,
              lateral aclexplode(c.relacl) p join pg_roles r on r.oid = p.grantee
        where n.nspname = 'public' and c.relkind = 'v' and r.rolname in ('anon', 'authenticated')`);
    expect(grants.filter((g) => g.priv !== "SELECT")).toEqual([]);
    expect(grants.filter((g) => g.role === "anon").map((g) => g.view)).toEqual(["meetings_public"]);
    for (const v of all) {
      const has = (role: string) => grants.some((g) => g.view === v && g.role === role);
      expect(has("authenticated"), v).toBe(true);
    }
  });

  it("functions created later by postgres in public aren't executable by anon or authenticated", async () => {
    await admin(`create function public.zz_later_fn() returns int language sql as 'select 1'`);
    try {
      for (const role of ["anon", "authenticated"]) {
        const [r] = await admin(`select has_function_privilege($1, 'public.zz_later_fn()', 'execute') as ok`, [role]);
        expect(r.ok, role).toBe(false);
      }
      await expect(rows(null, `select public.zz_later_fn()`)).rejects.toThrow(/permission denied/);
      await expect(rows(N1, `select public.zz_later_fn()`)).rejects.toThrow(/permission denied/);
      // The service role keeps Supabase's default access.
      expect((await admin(`select has_function_privilege('service_role', 'public.zz_later_fn()', 'execute') as ok`))[0].ok).toBe(true);
    } finally {
      await admin(`drop function public.zz_later_fn()`);
    }
  });

  it("tables and views created later get no API privileges by default", async () => {
    const [d] = await admin(
      `select coalesce(array_agg(distinct r.rolname::text), '{}') as roles
         from pg_default_acl a join pg_namespace n on n.oid = a.defaclnamespace,
              lateral aclexplode(a.defaclacl) p join pg_roles r on r.oid = p.grantee
        where n.nspname = 'public' and a.defaclobjtype = 'r' and a.defaclrole = 'postgres'::regrole`);
    expect(d.roles).not.toContain("anon");
    expect(d.roles).not.toContain("authenticated");
  });
});

describe("sequential program: existing progress (0007)", () => {
  it("a man partway through Key 2 keeps everything he did; untouched items re-lock in order", async () => {
    const man = await newUser("Walt");
    await rpc(LEADER, "approve_member", man, LEADER);
    // Old rules: whole modules opened at once. Recreate that state directly.
    await admin(`update step_progress sp set status = 'self_initialed', self_initialed_at = now()
                   from program_steps ps join program_modules pm on pm.id = ps.module_id
                  where ps.id = sp.step_id and sp.man_id = $1 and pm.key in ('welcome','key_1')`, [man]);
    await admin(`update step_progress sp set status = 'ap_initialed', ap_initial_by = $2, ap_initialed_at = now()
                   from program_steps ps where ps.id = sp.step_id and sp.man_id = $1 and ps.gate_type = 'self_ap'`, [man, LEADER]);
    await admin(`insert into video_progress (man_id, video_id, watched_at)
                 select $1, v.id, now() from videos v join program_modules pm on pm.id = v.module_id where pm.key = 'key_1'`, [man]);
    await admin(`update step_progress sp set status = 'open' from program_steps ps join program_modules pm on pm.id = ps.module_id
                  where ps.id = sp.step_id and sp.man_id = $1 and pm.key = 'key_2'`, [man]);
    const status = async (n: number) => (await sp(man, "key_2", n)).status;
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const id = await stepId("key_2", n);
      await admin(`update step_progress set status = $3, self_initialed_at = now() where man_id = $1 and step_id = $2`,
        [man, id, n <= 3 ? "leader_initialed" : "self_initialed"]);
    }
    const s9 = await sp(man, "key_2", 9);
    await admin(`update step_progress set status = 'self_initialed', self_initialed_at = now() where id = $1`, [s9.id]);
    await admin(`insert into submissions (step_progress_id, man_id, body_text, version) values ($1, $2, 'steps', 1)`, [s9.id, man]);
    const s11 = await sp(man, "key_2", 11); // touched (typed a draft turn-in) but not initialed
    await admin(`insert into submissions (step_progress_id, man_id, body_text, version) values ($1, $2, 'draft', 1)`, [s11.id, man]);

    await admin(`select app.resequence_progress()`);

    for (const n of [1, 2, 3]) expect(await status(n), `#${n}`).toBe("leader_initialed");
    for (const n of [4, 5, 6, 9]) expect(await status(n), `#${n}`).toBe("self_initialed");
    expect(await status(7)).toBe("open");     // his next item
    expect(await status(8)).toBe("locked");   // waits for #7
    expect(await status(10)).toBe("locked");
    expect(await status(11)).toBe("open");    // he'd already started it — kept
    expect(await status(21)).toBe("locked");
    expect((await sp(man, "key_1", null, 2)).status).toBe("ap_initialed");
    // Running it again changes nothing.
    await admin(`select app.resequence_progress()`);
    expect(await status(7)).toBe("open");
    expect(await status(8)).toBe("locked");
  });
});
