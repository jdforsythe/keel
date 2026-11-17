// @vitest-environment node
// The log scrub's cost and reach without a clock (k.privacy Server log): each text is read once, in steps linear in its
// length however many values the request has; the build is linear in the forms; no copy as written is left; past
// 2,000,000 characters of distinct written forms each text is one mark; and the cases that broke the scan before it.
// Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { scrubbed } from "../src/internal/scrubbed.ts";

const SEED = 1337;
const counter = () => ({ build: 0, walk: 0, forms: 0 });
const one = (message: string, secrets: readonly string[], pii: readonly string[] = []): string =>
  scrubbed(message, [
    [new Set(secrets), "[secret]"],
    [new Set(pii), "[pii]"],
  ]);
/** Units that broke a fold or a pair before: surrogates alone and paired, case pairs that change length, escapes. */
const UNITS = [
  "a",
  "K",
  "k",
  "ß",
  "İ",
  "ı",
  "i",
  "ς",
  "Σ",
  "ﬅ",
  "ﬆ",
  "\ud801",
  "\udc00",
  "𐐀",
  "=",
  "\\",
  '"',
  "%",
  "€",
  " ",
  "_",
  "7",
];
const textOf = (min: number, max: number) =>
  fc.array(fc.constantFrom(...UNITS), { minLength: min, maxLength: max }).map((u) => u.join(""));
/** At most this many forms per value: as written, JSON-escaped, URL-encoded, and two base64 forms. */
const FORMS = 5;

describe("linear steps", () => {
  it("property: the walk takes at most 5 steps per text unit and the build at most 4 per form unit and 2 per form", () => {
    fc.assert(
      fc.property(
        fc.array(textOf(1, 30), { minLength: 1, maxLength: 40 }),
        fc.array(textOf(0, 12), { maxLength: 4 }),
        textOf(0, 200),
        (secrets, pii, filler) => {
          const message = `${filler}${secrets.join(filler)}${pii.join(" ")}`;
          const count = counter();
          scrubbed(
            message,
            [
              [new Set(secrets), "[secret]"],
              [new Set(pii), "[pii]"],
            ],
            count,
          );
          expect(count.walk).toBeLessThanOrEqual(5 * message.length + 5);
          expect(count.build).toBeLessThanOrEqual(4 * count.forms + 2 * FORMS * (secrets.length + pii.length));
        },
      ),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("the shapes that were quadratic stay within the bounds", () => {
    const shapes: [string, string[]][] = [
      [`m ${"a".repeat(400_000)}`, [`${"a".repeat(400_000)}b`]],
      ["ab".repeat(200_000).slice(0, -1), ["ab".repeat(200_000)]],
      ["a".repeat(400_000), Array.from({ length: 256 }, (_, i) => "a".repeat(999 - i))],
    ];
    for (const [message, secrets] of shapes) {
      const count = counter();
      scrubbed(message, [[new Set(secrets), "[secret]"]], count);
      expect(count.walk).toBeLessThanOrEqual(5 * message.length + 5);
      expect(count.build).toBeLessThanOrEqual(4 * count.forms + 2 * FORMS * secrets.length);
    }
  });
});

describe("one pass", () => {
  it("one text costs at most 3 more steps per unit with 20,000 values than with one", () => {
    const values = Array.from({ length: 20_000 }, (_, i) => `tok-${i}-zz`);
    const message = Array.from({ length: 2_000 }, (_, i) => `x tok-${i * 7}-zz tok-${i}-z ${i}`).join(" ");
    const few = counter();
    const many = counter();
    expect(scrubbed(message, [[new Set(values.slice(0, 1)), "[secret]"]], few)).toContain("[secret]");
    expect(scrubbed(message, [[new Set(values), "[secret]"]], many)).not.toContain("tok-7-zz");
    expect(Math.abs(many.walk - few.walk)).toBeLessThanOrEqual(3 * message.length);
  });
});

describe("no copy left", () => {
  it("property: no piece between marks holds a value of 3 or more units that the text held as written", () => {
    fc.assert(
      fc.property(textOf(1, 24), textOf(0, 6), textOf(0, 12), textOf(0, 12), (secret, pii, before, after) => {
        const message = `${before}${secret}${after}${pii}`;
        const out = one(message, [secret], [pii]);
        for (const piece of out.split(/\[secret\]|\[pii\]/)) {
          if (secret.length >= 3) expect(piece.includes(secret)).toBe(false);
        }
      }),
      { seed: SEED, numRuns: 1_000 },
    );
  });
});

describe("exact cap", () => {
  // 857,140 of `k`: as written, and base64 without its two `=` (1,142,854), one form for both alphabets: 1,999,994.
  // `qq` and padded `cXE=` add 6, `qqq` and `cXFx` add 7.
  const big = "k".repeat(857_140);
  it("forms totalling 2,000,000 characters are scrubbed, and one more makes each text one mark", () => {
    const at = counter();
    const set = new Set([big, "qq"]);
    expect(scrubbed("m qq end", [[set, "[secret]"]], at)).toBe("m [secret] end");
    expect(at.forms).toBe(2_000_000);
    const past = counter();
    const over = new Set([big, "qqq"]);
    expect(scrubbed("m qqq end", [[over, "[secret]"]], past)).toBe("[secret]");
    expect(past.forms).toBe(2_000_001);
    expect(scrubbed("at app/routes/x.ts:4", [[over, "[secret]"]])).toBe("[secret]");
    expect(scrubbed("", [[over, "[secret]"]])).toBe("[secret]");
  });

  it("past the cap the mark is the secret's when the request made one, else the pii mark", () => {
    expect(one("hello", [], [big, "qqq"])).toBe("[pii]");
    expect(one("hello", ["s3cret"], [big, "qqq"])).toBe("[secret]");
  });
});

describe("the cases the scan broke on", () => {
  it("a 400,000 run against a 400,001-character secret that differs in its last character is unchanged", () => {
    expect(one(`m ${"a".repeat(400_000)}`, [`${"a".repeat(400_000)}b`])).toBe(`m ${"a".repeat(400_000)}`);
  });

  it("a periodic 400,000-character secret against its text less one character is unchanged", () => {
    const message = "ab".repeat(200_000).slice(0, -1);
    expect(one(message, ["ab".repeat(200_000)])).toBe(message);
  });

  it("500 secrets of 1,000 `a` and nine digits leave a 520,000 run of `a` unchanged", () => {
    const secrets = Array.from({ length: 500 }, (_, i) => `${"a".repeat(1_000)}${String(i).padStart(9, "0")}`);
    expect(one("a".repeat(520_000), secrets)).toBe("a".repeat(520_000));
  });

  it("256 secrets of 999 down to 744 `a` mark a 400,000 run of `a` whole", () => {
    const secrets = Array.from({ length: 256 }, (_, i) => "a".repeat(999 - i));
    expect(one("a".repeat(400_000), secrets)).toBe("[secret]");
  });

  it("50 secrets sharing a 15,000-character prefix are marked exactly, and with a 20,000 prefix the text is one mark", () => {
    const shared = (n: number): { message: string; secrets: string[] } => {
      const p = "k".repeat(n);
      const secrets = Array.from({ length: 50 }, (_, i) => `${p}-${i}-tail`);
      return { message: `${p.repeat(10)} ${secrets[7] ?? ""} end`, secrets };
    };
    const under = shared(15_000);
    expect(one(under.message, under.secrets)).toBe(`${"k".repeat(15_000).repeat(10)} [secret] end`);
    const over = shared(20_000);
    expect(one(over.message, over.secrets)).toBe("[secret]");
  });

  it("a long secret opening with a lone low surrogate is marked where the text pairs it", () => {
    const secret = `\udc00${"k".repeat(1_000)}`;
    expect(one(`< 𐐀${"k".repeat(1_000)} >`, [secret])).toBe("< \ud801[secret] >");
  });

  it("dotless `ı` and `i` match at 999, 1,000 and 1,001 units alike", () => {
    for (const n of [998, 999, 1_000]) {
      expect(one(`< ı${"k".repeat(n)} >`, [`i${"k".repeat(n)}`])).toBe("< [secret] >");
      expect(one(`< i${"k".repeat(n)} >`, [`ı${"k".repeat(n)}`])).toBe("< [secret] >");
    }
  });

  it("`ᾈ` and `ᾀ` match, and the ligatures `ﬅ` and `ﬆ` do not, at 999, 1,000 and 1,001 units alike", () => {
    for (const n of [998, 999, 1_000]) {
      expect(one(`< ᾈ${"k".repeat(n)} >`, [`ᾀ${"k".repeat(n)}`])).toBe("< [secret] >");
      const lig = `< ﬅ${"k".repeat(n)} >`;
      expect(one(lig, [`ﬆ${"k".repeat(n)}`])).toBe(lig);
    }
  });

  it("a padded base64url or base64 copy is marked with its padding", () => {
    const std = btoa("??>?hunter");
    const url = std.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
    expect(one(`m ${url}== x`, ["??>?hunter"])).toBe("m [secret] x");
    expect(one(`m ${std} x`, ["??>?hunter"])).toBe("m [secret] x");
    expect(one("m aHVudGVyMjI= x", ["hunter22"])).toBe("m [secret] x");
  });

  it("a base64 copy is matched without regard to case, so a near copy is over-marked, never left", () => {
    const b = btoa("hunter22").replace(/=+$/, "");
    expect(one(`m ${b.toUpperCase()} x`, ["hunter22"])).toBe("m [secret] x");
    expect(one(`m ${b.toLowerCase()} x`, ["hunter22"])).toBe("m [secret] x");
  });

  it("a 2-character secret is marked only as a whole token", () => {
    expect(one("node code mode", ["81"])).toBe("node code mode");
    expect(one("pin 81 sent", ["81"])).toBe("pin [secret] sent");
    // A combining mark belongs to the word before it: the same word, precomposed or not, keeps the two letters.
    expect(one("e\u0301ab x", ["ab"])).toBe("e\u0301ab x");
    expect(one("\u00e9ab x", ["ab"])).toBe("\u00e9ab x");
    expect(one("ab\u0301 x", ["ab"])).toBe("ab\u0301 x");
    // The short value's longer encoded copies are replaced wherever they stand.
    expect(one("caf%C3%A9 and caf\u00e9", ["\u00e9"])).toBe("caf[secret] and caf\u00e9");
  });

  it("two secrets that overlap without one holding the other are marked as one run", () => {
    expect(one("joined aaaa-bbbb-cccc", ["aaaa-bbbb", "bbbb-cccc"])).toBe("joined [secret]");
  });

  it("a secret holding a pii value is marked whole as the secret", () => {
    expect(one("abcd-1234-9876", ["abcd-1234-9876"], ["1234"])).toBe("[secret]");
  });
});

describe("the cap bounds the work", () => {
  // Values of 400 characters: about 2,100 pass the cap with their base64 forms, and 9,000 make at most about 8,400,000
  // characters of forms where nothing stops at the cap.
  const users = (n: number): Set<string> =>
    new Set(Array.from({ length: n }, (_, i) => `user${String(i).padStart(6, "0")}${"x".repeat(390)}`));
  const sets = (pii: ReadonlySet<string>): [ReadonlySet<string>, string][] => [
    [new Set<string>(), "[secret]"],
    [pii, "[pii]"],
  ];

  it("forming stops at the cap, so 9,000 values of 400 characters cost what 3,000 do", () => {
    const few = counter();
    const many = counter();
    expect(scrubbed("login failed for user7@example.com", sets(users(3_000)), few)).toBe("[pii]");
    expect(scrubbed("login failed for user7@example.com", sets(users(9_000)), many)).toBe("[pii]");
    expect(many.build).toBe(few.build);
    expect(many.forms).toBe(few.forms);
    expect(many.forms).toBeGreaterThan(2_000_000);
    expect(many.forms).toBeLessThanOrEqual(2_000_000 + 2_000);
  });

  it("a later text on the same sets, grown or not, adds no build and no forms", () => {
    const pii = users(3_000);
    const passes = sets(pii);
    scrubbed("first", passes);
    const later = counter();
    expect(scrubbed("frame /app/x.ts:1:1", passes, later)).toBe("[pii]");
    pii.add("one-more@example.com");
    expect(scrubbed("frame /app/x.ts:2:1", passes, later)).toBe("[pii]");
    expect(later).toEqual(counter());
  });

  it("past the cap a request that made a secret holding no string or number is marked `[secret]`", () => {
    expect(
      scrubbed("refused true", [
        [new Set([""]), "[secret]"],
        [users(3_000), "[pii]"],
      ]),
    ).toBe("[secret]");
  });
});

describe("a form of 1 or 2 units splits no surrogate pair", () => {
  it("is not marked on either half of a pair, and is as a whole lone surrogate", () => {
    expect(one("say 😀 ok", ["\ud83d"])).toBe("say 😀 ok");
    expect(one("say a😀 ok", ["a\ud83d"])).toBe("say a😀 ok");
    expect(one("say 😀 ok", ["\ude00"])).toBe("say 😀 ok");
    expect(one("say \ud83d ok", ["\ud83d"])).toBe("say [secret] ok");
  });
});

describe("a padded base64 copy goes with its padding", () => {
  it("even when a longer form ends at the same unit", () => {
    const w = "hunter2!xy";
    expect(one("m aHVudGVyMiF4eQ== x", [w])).toBe("m [secret] x");
    expect(one("m QaHVudGVyMiF4eQ== x", [w, "QaHVudGVyMiF4eQ"])).toBe("m [secret] x");
  });
});
