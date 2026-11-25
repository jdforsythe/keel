// The scrub's cost (k.privacy Cost): the matcher is built in steps linear in the bytes of its set, and each text is
// read in steps linear in its length, each reading once. Linear cannot be seen from outside, so the steps are counted
// (`count`) over generated sets and texts of growing size, adversarial ones included (one or two letters, long
// periodic values, shared prefixes, escapes), and held under one constant per byte and per unit at every size.
// The 0729 body is a regression case: 99,000 distinct 8-byte secrets stop at the cap and no matcher is built. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { holdSecrets } from "../src/internal/holdSecrets.ts";
import { pastCap } from "../src/internal/pastCap.ts";
import { readingsOf } from "../src/internal/readingsOf.ts";
import { scrubbed } from "../src/internal/scrubbed.ts";
import { utf8Bytes } from "../src/internal/utf8Bytes.ts";

const SEED = 1337;
/** Steps per byte of values the build may take: about 12 form units per byte, each read a few times (50 seen). */
const BUILD_PER_BYTE = 120;
/** Steps per unit of each reading the walk may take: transitions (amortized 2), one long form, two short ones (2.4 seen). */
const WALK_PER_UNIT = 5;

const unit = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom("a", "b") },
  { weight: 2, arbitrary: fc.constantFrom("%41", "+", "&amp;", "\\u0062", "%C3%A9", "=", "/") },
  { weight: 1, arbitrary: fc.constantFrom("é", "😀", "́", "K", "ß") },
);
const value = (most: number): fc.Arbitrary<string> =>
  fc.array(unit, { minLength: 1, maxLength: most }).map((a) => a.join(""));

const run = (values: readonly string[], text: string) => {
  const set = new Set<string>();
  holdSecrets(set, values);
  const count = { build: 0, walk: 0 };
  scrubbed(
    text,
    [
      [set, "[secret]"],
      [new Set<string>(), "[pii]"],
    ],
    count,
  );
  const counted = new Set([...set].flatMap((v) => [v, v.normalize("NFC"), v.normalize("NFD")]));
  const bytes = [...counted].reduce((n, v) => n + utf8Bytes(v), 0);
  const read = readingsOf(text).reduce((n, v) => n + v.n, 0);
  return { count, bytes, read, past: pastCap.has(set) };
};

describe("steps linear in the set's bytes and the text's length", () => {
  for (const [size, runs] of [
    [8, 200],
    [64, 100],
    [512, 30],
    [4096, 8],
  ] as const)
    it(`property: values of up to ${String(size)} pieces and texts of up to ${String(size * 8)} hold the bounds`, () => {
      let held = 0;
      fc.assert(
        fc.property(
          fc.array(value(size), { minLength: 1, maxLength: size >= 4096 ? 3 : 12 }),
          fc.array(fc.oneof(unit, value(size)), { maxLength: size * 2 }).map((a) => a.join("")),
          (values, text) => {
            const { count, bytes, read, past } = run(values, text);
            fc.pre(!past);
            held++;
            expect(count.build).toBeLessThanOrEqual(BUILD_PER_BYTE * bytes + 1_000);
            expect(count.walk).toBeLessThanOrEqual(WALK_PER_UNIT * read);
            expect(read).toBeLessThanOrEqual(10 * text.length);
          },
        ),
        { seed: SEED, numRuns: runs },
      );
      // Most generated sets are under the cap, so the bounds were read at each size.
      expect(held).toBeGreaterThan(runs / 2);
    });

  it("the shapes that are quadratic for a naive matcher stay within the bounds", () => {
    const shapes: [string[], string][] = [
      [[`${"a".repeat(30_000)}b`], "a".repeat(200_000)],
      [Array.from({ length: 200 }, (_, i) => "a".repeat(i + 3)), "a".repeat(100_000)],
      [Array.from({ length: 50 }, (_, i) => `${"ab".repeat(300)}${String(i)}`), "ab".repeat(50_000)],
      [["%41".repeat(1_000)], "%2541".repeat(20_000)],
      [["a+b".repeat(2_000)], "a%2Bb".repeat(10_000) + "a+b".repeat(10_000)],
    ];
    for (const [values, text] of shapes) {
      const { count, bytes, read, past } = run(values, text);
      expect(past).toBe(false);
      expect(count.build).toBeLessThanOrEqual(BUILD_PER_BYTE * bytes + 1_000);
      expect(count.walk).toBeLessThanOrEqual(WALK_PER_UNIT * read);
    }
  });
});

describe("the 0729 body", () => {
  it("99,000 distinct 8-byte secrets stop at the cap after 8,193 and a 790 KB text costs no build", () => {
    const values = Array.from({ length: 99_000 }, (_, i) => i.toString(36).padStart(8, "0"));
    const set = new Set<string>();
    holdSecrets(set, values);
    expect(pastCap.has(set)).toBe(true);
    // The empty string and 8,193 values: the 8,193rd takes the scope past 65,536 bytes.
    expect(set.size).toBe(8_194);
    const text = `bad ${values.join(",")}`;
    const count = { build: 0, walk: 0 };
    const out = scrubbed(
      text,
      [
        [set, "[secret]"],
        [new Set<string>(), "[pii]"],
      ],
      count,
    );
    expect(out).toBe("[secret]");
    expect(count).toEqual({ build: 0, walk: 0 });
  });
});
