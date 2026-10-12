#!/usr/bin/env python3
"""Builds supabase/seed/seed.sql from the Finally Free source docs (plain-text exports).

  python3 build_seed.py <key1.txt> <key2.txt> <key3.txt> > seed.sql

Wording is kept verbatim. Only form artifacts are dropped: blank initial lines
(_____), answer-slot numerals, and column-fill underscores.
"""
import json, re, sys

def q(s):
    return "null" if s is None else "'" + s.replace("'", "''") + "'"

def clean(s):
    s = re.sub(r"_{2,}[_ .\t]*", " ", s)          # initial / fill-in blanks
    s = re.sub(r"[ \t]{2,}", " ", s)
    s = re.sub(r"\s+([.,])", r"\1", s)
    return s.strip()

def paragraphs(text):
    out, cur = [], []
    for line in text.splitlines():
        if line.strip() == "":
            if cur: out.append(cur); cur = []
        else:
            cur.append(line)
    if cur: out.append(cur)
    return out

# ───────────────────────── Key 1 ─────────────────────────
def key1(text):
    lines = [l.rstrip() for l in text.splitlines()]
    verse = clean(lines[1])
    closing = clean(lines[-1].strip("* "))
    qs = [
        (lines[2], 10), (lines[8], 10), (lines[14], 6), (lines[21], 5), (lines[27], 7),
        ("1-When Should I begin to serve God?     2-When will you begin?     3-When should I stop serving God?", 3),
        ("What if the first person isn't interested or the 3?? one, what shall I do? And why???", 1),
        ('What other resources could I use to reference further, "How to work with others"', 4),
    ]
    return verse, closing, [(clean(p), n) for p, n in qs]

# ───────────────────────── Key 2 ─────────────────────────
KEY2_TITLES = {
    1: "Pray morning and night", 2: "Pray 30 days to be a fisher of men",
    3: "Clear home of porn and triggering material", 4: "Get daily resources",
    5: "Save 20+ member contacts", 6: "Install accountability software",
    7: "Do your disclosure", 8: "Buy the AA Big Book and 12 x 12",
    9: "Write Steps 1, 2 and 3", 10: "90 in 90 sheet and home group",
    11: '"My Program" page', 12: "Commit to a service position",
    13: "Time commitment statement", 14: "How I will help others",
    15: "How I will help my accountability partner", 16: "Get an accountability partner",
    17: "Night Battle box breathing", 18: "Have a sponsor or temporary sponsor",
    19: "Sponsor someone", 20: "AP reviews your 21 (cover sheet)", 21: "Give hugs",
}
TURN_IN = {9, 10, 11, 13, 14, 15}
DUE = {12: 14, 19: 30, 18: 90}
# Timed / waiting-on-others items: start when they open and don't block the next
# item while their timer runs (still need every sign-off before Key 2 completes).
BACKGROUND = {2, 10, 12, 16, 18, 19}
HELPERS = {
    4: {"type": "meeting_link_joined", "sub": "D"},
    16: {"type": "relationship", "rel": "ap"},
    18: {"type": "relationship", "rel": "sponsor"},
    19: {"type": "mentee_linked"},
    20: {"type": "cover_sheet"},
}

def key2(text):
    lines = text.splitlines()
    start = next(i for i, l in enumerate(lines) if re.match(r"\s*1\.\s+Pray in the Morning", l))
    intro = "\n\n".join(clean(" ".join(p)) for p in paragraphs("\n".join(lines[:start]))
                        if not p[0].strip().startswith("Name"))
    items, cur_no, cur = {}, None, []
    for l in lines[start:]:
        m = re.match(r"\s*(\d{1,2})\.\s+(.*)", l)
        if m and int(m.group(1)) == (cur_no or 0) + 1:
            if cur_no: items[cur_no] = cur
            cur_no, cur = int(m.group(1)), [m.group(2)]
        else:
            cur.append(l)
    items[cur_no] = cur
    # #21 carries the closing text; keep only the item itself.
    last = "\n".join(items[21])
    item21, closing = last.split("Congratulations", 1)
    items[21] = item21.splitlines()
    closing = "Congratulations" + closing
    closing = clean(" ".join(l.strip() for l in closing.splitlines() if l.strip()
                             and not l.strip().startswith("Signature")))
    out = {}
    for n, ls in items.items():
        body = "\n".join(clean(l) for l in ls if clean(l))
        # "Write one page for each subject below..." heads items 13–15 but sits inside #12.
        body = body.replace("\nWrite one page for each subject below and prepare to read at group:", "")
        out[n] = body
    assert len(out) == 21, len(out)
    return intro, closing, out

# ───────────────────────── Key 3 ─────────────────────────
def key3(text):
    part1_txt, part2_txt = re.split(r"\n\s*Bills Story Minutes 59 to\s+end\s*\n", text, maxsplit=1)
    def parse(t, skip_header):
        paras = paragraphs(t)
        header = []
        if skip_header:
            header = [clean(l) for l in paras[0]]
            paras = paras[1:]
        qs = []
        for p in paras:
            ls = [l for l in p if not re.fullmatch(r"\s*\d\s*", l)]   # answer-slot numerals
            if not ls: continue
            s = clean(" ".join(l.strip() for l in ls))
            if not s: continue
            label = None
            m = re.match(r"@\s*(\d+(?:\s*-\s*\d+)?)\s*,?\s*(.*)", s)
            if m:
                label = "@" + m.group(1).replace(" ", "")
                s = m.group(2)
            # A bare "2) ..." paragraph continues the previous question (e.g. @43).
            if label is None and re.match(r"\d\)", s) and qs and not s.startswith("1)"):
                plabel, ps, _ = qs.pop()
                s, label = ps + " " + s, plabel
            subs = len(set(re.findall(r"(?:^|\s|\()(\d)\)", s)))
            asks = "?" in s or re.search(r"\b(tell|relate|what|how|why|compare|explain|list)\b", s, re.I)
            slots = subs if subs else (1 if asks else 0)              # 0 = statement, no answer needed
            qs.append((label, s, slots))
        return header, qs
    h1, q1 = parse(part1_txt, True)
    _, q2 = parse(part2_txt, False)
    return h1, q1, q2

def main(k1, k2, k3):
    verse, k1_closing, k1_qs = key1(open(k1).read())
    k2_intro, k2_closing, k2_items = key2(open(k2).read())
    k3_header, k3p1, k3p2 = key3(open(k3).read())

    o = []
    w = o.append
    w("-- GENERATED by supabase/seed/build_seed.py from the 10-26 source docs. Do not hand-edit;")
    w("-- re-run the script when a doc changes.\n")
    w("begin;")
    w("-- Refuse to wipe content once men have progress (deleting modules cascades to step_progress).")
    w("do $$ begin if exists (select 1 from step_progress) or exists (select 1 from meeting_logs) then")
    w("  raise exception 'Progress already exists - refusing to re-seed. Update program rows in place instead.';")
    w("end if; end $$;")
    w("delete from program_modules;\n")

    mods = [
        ("welcome", 1, "Module 0 — Welcome",
         "Welcome to Finally Free Fellowship. Read through how the program works — the 3 Keys to Freedom — "
         "and commit to walking it out with your brothers.", None),
        ("key_1", 2, "Key 1 — The 3 Videos and the Fishing worksheet",
         verse + "\n\n" + k1_closing, "key1_videos_worksheet/Permanent_Real_Sobriety_Worksheet_10-26"),
        ("key_2", 3, 'Key 2 — Finally Free\'s "Virtual Detox" Program: "The 21"',
         k2_intro, "key2_detox21/Detox21_The21_Key2_10-26"),
        ("key_3_part_1", 4, "Key 3 — Bill's Story, Part 1 (minutes 1–59)",
         "\n".join(k3_header), "key3_bill_w/Bills_Story_Worksheet"),
        ("key_3_part_2", 5, "Key 3 — Bill's Story, Part 2 (minute 59 to end)",
         "Bills Story Minutes 59 to end", "key3_bill_w/Bills_Story_Worksheet"),
        ("certification", 6, "Certification",
         "Your certification packet is assembled from your Key 1 worksheet, Key 2 cover sheet and orange "
         "turn-ins, and Key 3 Parts 1 and 2. A leader reviews and approves it.", None),
    ]
    for key, n, title, desc, src in mods:
        w(f"insert into program_modules (key, order_no, title, description, source_doc) values "
          f"({q(key)}, {n}, {q(title)}, {q(desc)}, {q(src)});")
    w("")

    def mid(key): return f"(select id from program_modules where key = {q(key)})"

    def step(key, order, item, title, desc, gate, turn_in=False, due=None, helper=None):
        w(f"insert into program_steps (module_id, order_no, item_number, title, description, turn_in, gate_type, "
          f"requires_upload, due_day, helper) values ({mid(key)}, {order}, {item if item else 'null'}, {q(title)}, "
          f"{q(desc)}, {str(turn_in).lower()}, {q(gate)}, {str(turn_in).lower()}, {due if due else 'null'}, "
          f"{q(json.dumps(helper)) + '::jsonb' if helper else 'null'});")

    # Module 0
    step("welcome", 1, None, "Read the welcome and commit to the program",
         "I have read how Finally Free's 3 Keys to Freedom work and I commit to walking through them "
         "with my brothers.", "self")

    # Key 1
    for i in range(1, 4):
        w(f"insert into videos (module_id, order_no, title) values ({mid('key_1')}, {i}, {q(f'Video {i}')});")
    step("key_1", 1, None, "Fishing worksheet",
         "Fill in the worksheet below (or upload your completed paper copy).", "self",
         helper={"type": "worksheet"})
    step("key_1", 2, None, "Went over video notes and worksheet with AP",
         k1_closing, "self_ap")
    for i, (p, n) in enumerate(k1_qs, 1):
        w(f"insert into worksheet_questions (module_id, order_no, prompt, answer_slots) values "
          f"({mid('key_1')}, {i}, {q(p)}, {n});")
    w("")

    # Key 2 — The 21
    for n in range(1, 22):
        step("key_2", n, n, KEY2_TITLES[n], k2_items[n], "triple",
             turn_in=n in TURN_IN, due=DUE.get(n),
             helper={**HELPERS.get(n, {}), "background": True} if n in BACKGROUND else HELPERS.get(n))
    w(f"insert into app_settings values ('key2_closing', {q(json.dumps(k2_closing))}::jsonb) "
      "on conflict (key) do update set value = excluded.value;")
    w("")

    # Key 3
    w(f"insert into videos (module_id, order_no, title) values ({mid('key_3_part_1')}, 1, "
      f"{q('My Name Is Bill W.')});")
    step("key_3_part_1", 1, None, "Bill's Story worksheet — Part 1 (minutes 1–59)",
         "Watch the movie up to minute 59 and answer the worksheet (or upload it).", "triple",
         helper={"type": "worksheet"})
    step("key_3_part_2", 1, None, "Bill's Story worksheet — Part 2 (minute 59 to end)",
         "Watch from minute 59 to the end and answer the worksheet (or upload it).", "triple",
         helper={"type": "worksheet"})
    for key, qs in (("key_3_part_1", k3p1), ("key_3_part_2", k3p2)):
        for i, (label, p, slots) in enumerate(qs, 1):
            w(f"insert into worksheet_questions (module_id, order_no, timestamp_label, prompt, answer_slots) values "
              f"({mid(key)}, {i}, {q(label)}, {q(p)}, {slots});")
    w("")

    # Certification
    step("certification", 1, None, "Certification packet",
         "Submit your assembled packet for leader review.", "leader", helper={"type": "cert_packet"})

    # Meetings (from the current FF app). Times are true UTC; the old app labelled
    # 00:00 UTC meetings by their US evening day, so those move +1 UTC day here.
    # Zoom links/IDs/passwords are NOT seeded — enter them in Meetings Admin.
    meetings = [
        (1, "00:00", "Campfire 3 Share", "Scripture drill, FASTER check-in, and journaling. An intimate fellowship discussion.", False, "Anthony"),
        (2, "00:00", "Conquerors Reloaded", "Beginners meeting on the video series. No subscription required. All welcome.", True, "Frederick"),
        (3, "00:00", "Topic Tuesday Theatre", "Member-led discussion on addiction and recovery topics. Real Talk. Real Change.", False, "Jacob"),
        (4, "00:00", "Battle Plan for Purity", "For committed Conquerors. Regular attendance and homework required.", False, "Jared S"),
        (4, "13:30", "The Singapore Cartel", "Study the Conquerors series and Big Book. Fellowship across Asia.", False, "Nick"),
        (5, "00:00", "Thursday Night Conquerors", "Committed Conquerors group. Regular attendance and homework required.", False, "Rusty"),
        (5, "00:00", "Thursday Night Warpath", "Advanced Soul Refiners series. Prerequisite: completion of Conquerors.", False, "Morrison"),
        (6, "00:00", "The Space Capsule", "Speaker disclosures, birthday celebrations, and sobriety chip meetings.", False, "John K"),
        (0, "00:00", "The Healing Room", "Trauma. The ten worst and secrets. Therapy-themed healing. You are safe here.", False, "Wayne"),
    ]
    w("delete from meetings;")
    for d, t, name, tag, beg, sec in meetings:
        w(f"insert into meetings (name, day_of_week, start_time_utc, tagline, beginner, secretary_first_name) "
          f"values ({q(name)}, {d}, {q(t)}, {q(tag)}, {str(beg).lower()}, {q(sec)});")
    w("commit;")
    print("\n".join(o))
    print(f"-- counts: key1 questions {len(k1_qs)}, key2 items {len(k2_items)}, "
          f"key3 part1 {len(k3p1)}, part2 {len(k3p2)}", file=sys.stderr)

if __name__ == "__main__":
    main(*sys.argv[1:4])
