/** The "3 Keys to Freedom" (from the group's graphic). Shown on Home, How It Works and My Program. */
export type KeyInfo = { label: string; what: string; kingdom: string; application: string };

export const KEY_INFO: Record<"key_1" | "key_2" | "key_3", KeyInfo> = {
  key_1: {
    label: "Key 1",
    what: "Watch 3 Zoom videos and do the Fishing worksheet.",
    kingdom: "Real Repentance",
    application: "Avoid struggling for 10 years by following good ideas and finding what has the highest success rates and why.",
  },
  key_2: {
    label: "Key 2",
    what: "Complete the 21 detox worksheets.",
    kingdom: "Putting on the Full Armour",
    application: "Getting the tools and support you need to finally say no to the addiction.",
  },
  key_3: {
    label: "Key 3",
    what: "Watch the Bill W. movie and do the questionnaire.",
    kingdom: "Preparing for the Harvest",
    application: "In-depth study, finding your personal healing through rescuing others.",
  },
};

/** Which key a program module belongs to (Key 3 has two parts). */
export function keyInfoFor(moduleKey: string): KeyInfo | null {
  if (moduleKey === "key_1" || moduleKey === "key_2") return KEY_INFO[moduleKey];
  if (moduleKey === "key_3_part_1") return KEY_INFO.key_3;
  return null;
}

export const PROGRAM_PROMISE =
  "Our program gets you sober now, and can be done in as little as 2-4 weeks, and is compatible with all recovery curriculums including Conquerors and all 12-step programs.";
