/**
 * King James Version (public domain) text for the verses the app cites, so a
 * tap on "John 8:32" shows the verse. Add a verse here to make its reference
 * tappable everywhere; references not listed stay plain text.
 */
export const KJV: Record<string, string> = {
  "Matthew 5:44": "But I say unto you, Love your enemies, bless them that curse you, do good to them that hate you, and pray for them which despitefully use you, and persecute you;",
  "Matthew 6:33": "But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.",
  "Mark 3:25": "And if a house be divided against itself, that house cannot stand.",
  "Luke 6:28": "Bless them that curse you, and pray for them which despitefully use you.",
  "Luke 14:28": "For which of you, intending to build a tower, sitteth not down first, and counteth the cost, whether he have sufficient to finish it?",
  "John 8:32": "And ye shall know the truth, and the truth shall make you free.",
  "John 8:36": "If the Son therefore shall make you free, ye shall be free indeed.",
  "John 9:4": "I must work the works of him that sent me, while it is day: the night cometh, when no man can work.",
  "Romans 6:23": "For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.",
  "1 Corinthians 10:13": "There hath no temptation taken you but such as is common to man: but God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape, that ye may be able to bear it.",
  "2 Corinthians 6:2": "(For he saith, I have heard thee in a time accepted, and in the day of salvation have I succoured thee: behold, now is the accepted time; behold, now is the day of salvation.)",
  "Galatians 6:7": "Be not deceived; God is not mocked: for whatsoever a man soweth, that shall he also reap.",
  "James 1:15": "Then when lust hath conceived, it bringeth forth sin: and sin, when it is finished, bringeth forth death.",
  "Proverbs 6:27": "Can a man take fire in his bosom, and his clothes not be burned?",
  "Lamentations 3:22-23": "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.",
  "1 John 4:18": "There is no fear in love; but perfect love casteth out fear: because fear hath torment. He that feareth is not made perfect in love.",
};

const ALIASES: Record<string, string> = { Mathew: "Matthew", Matt: "Matthew", Rom: "Romans", Gal: "Galatians", Prov: "Proverbs" };
const BOOKS = [...new Set(Object.keys(KJV).map((r) => r.replace(/ \d+:.*$/, "")).concat(Object.keys(ALIASES)))]
  .sort((a, b) => b.length - a.length).map((b) => b.replace(/ /g, "\\s"));
const REF = new RegExp(`\\b((?:${BOOKS.join("|")}))\\.?\\s(\\d+):(\\d+(?:[-–]\\d+)?)`, "g");

export type Piece = string | { ref: string; label: string; text: string };

/** Splits text into plain strings and known verse references ({ref, label, text}). "1 John 4:18" is never read as "John 4:18". */
export function splitScripture(input: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of input.matchAll(REF)) {
    const book = ALIASES[m[1]] ?? m[1].replace(/\s/g, " ");
    const ref = `${book} ${m[2]}:${m[3].replace("–", "-")}`;
    const text = KJV[ref];
    // "John" matched inside "1 John"? The longer book name wins because it's tried first, so skip only unknown refs.
    if (!text) continue;
    if (m.index! > last) out.push(input.slice(last, m.index));
    out.push({ ref, label: m[0], text });
    last = m.index! + m[0].length;
  }
  if (last < input.length) out.push(input.slice(last));
  return out;
}
