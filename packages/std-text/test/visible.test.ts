// Seed 1337
import { gen } from "@keel/schema/gen";
import fc from "fast-check";
import { expect, test } from "vitest";
import { line } from "../src/line.ts";
import { para } from "../src/para.ts";
import { textCheck } from "../src/textCheck.ts";

const SEED = 1337;

test("a value with no visible character is refused and joiners and variation selectors between visible ones stay", () => {
  const check = textCheck(1, 3, false);
  for (const bad of ["​", "ㅤ", "﻿", " \u{E0041}", "ᅟᅠﾠ", " ‍ "]) expect(check(bad)).toBe(false);
  for (const ok of ["❤️", "a‍b", "a\u{E0041}", "﻿x"]) expect(check(ok)).toBe(true);
  expect(textCheck(0, 3, false)("")).toBe(true);
});

test("blank-looking characters, marks alone and a lone surrogate are refused; a visible base keeps them valid", () => {
  const check = textCheck(1, 3, false);
  for (const bad of ["\u{2800}", "\u{FFF9}", "\u{FFFB}", "\u{13430}", "\u{301}", "\u{301}\u{302}", "a\uD800"]) {
    expect(check(bad)).toBe(false);
    expect(textCheck(1, 3, true)(bad)).toBe(false);
  }
  for (const ok of ["\u{2800}a", "q\u{301}", "a\u{200D}"]) expect(check(ok)).toBe(true);
});

test("every Bidi_Control character is refused in line and para", () => {
  const marks = [0x61c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069];
  for (const n of marks) {
    const bad = `a${String.fromCodePoint(n)}b`;
    expect(textCheck(1, 9, false)(bad)).toBe(false);
    expect(textCheck(1, 9, true)(bad)).toBe(false);
  }
});

test("every generated line and para value parses", () => {
  for (const schema of [line({ max: 8 }), line({ min: 0, max: 5 }), para({ min: 2, max: 9 })]) {
    fc.assert(
      fc.property(gen(schema), (v) => {
        expect(schema.parse(v).ok).toBe(true);
      }),
      { seed: SEED, numRuns: 300 },
    );
  }
});

test("a lone surrogate inserted anywhere in a generated value is refused", () => {
  const schema = line({ max: 8 });
  fc.assert(
    fc.property(gen(schema), fc.nat(), (v, at) => {
      const i = at % (v.length + 1);
      expect(schema.parse(`${v.slice(0, i)}\uD800${v.slice(i)}`).ok).toBe(false);
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("a bidi control inserted anywhere in a generated value is refused", () => {
  const schema = line({ max: 8 });
  fc.assert(
    fc.property(gen(schema), fc.nat(), fc.constantFrom(0x61c, 0x200e, 0x200f, 0x202e, 0x2067), (v, at, mark) => {
      const i = at % (v.length + 1);
      const bad = v.slice(0, i) + String.fromCodePoint(mark) + v.slice(i);
      expect(schema.parse(bad).ok).toBe(false);
    }),
    { seed: SEED, numRuns: 200 },
  );
});
