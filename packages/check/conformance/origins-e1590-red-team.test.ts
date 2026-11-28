// rfc:0160 conformance: a reason of a no-break space alone, or holding NUL, a tab or U+202E, is E1590; `https://[::1]` is E1590 with no fix.
// k.origins, Declaration "A reason is 1 to 200 characters on one line, one visible. A directive holds at most 16 origins. Visible: outside k.schema's blank set; no control or format character."
// k.origins, Declaration "no IPv6 literal"
// k.origins, Rules "E1590 an `origins` the static read cannot take (not an object literal, a spread or computed key), a key outside the five, an origin that is not exact (fix: the key as its `originOf` serialization when that is exact; none for a path, as `https://cdn.example/img`), a reason out of form, or a directive over 16"
// Seed 1337 (fc.assert below; the control and format characters are every code point of \p{Cc} and \p{Cf}).
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, decl, single, withCode } from "./origins-support.ts";

const e1590 = (origins: string) => withCode(single(origins), "E1590");
const reasonOf = (reason: string): string =>
  `{ img: { 'https://cdn.example': '${[...reason].map((c) => `\\u{${(c.codePointAt(0) ?? 0).toString(16)}}`).join("")}' } }`;

const NOT_VISIBLE: number[] = [];
for (let cp = 0; cp <= 0x10ffff; cp++) {
  if (/^[\p{Cc}\p{Cf}]$/u.test(String.fromCodePoint(cp))) NOT_VISIBLE.push(cp);
}

describe("rfc:0160 conformance: E1590 reasons and IPv6", () => {
  test("rfc:0160 conformance: a reason of `'\\u00a0'` alone is one E1590", () => {
    expect(e1590("{ img: { 'https://cdn.example': '\\u00a0' } }")).toHaveLength(1);
    expect(e1590("{ img: { 'https://cdn.example': ' ' } }")).toHaveLength(1);
  });
  test("rfc:0160 conformance: a reason holding NUL, a tab or U+202E is one E1590", () => {
    expect(e1590(reasonOf("a\u0000b"))).toHaveLength(1);
    expect(e1590(reasonOf("a\tb"))).toHaveLength(1);
    expect(e1590(reasonOf("a‮b"))).toHaveLength(1);
  });
  test("rfc:0160 conformance: a reason holding any one control or format character is one E1590, and the same without it is none", () => {
    fc.assert(
      fc.property(fc.constantFrom(...NOT_VISIBLE), fc.stringMatching(/^[a-z]{1,10}$/), fc.nat(10), (cp, word, at) => {
        const i = Math.min(at, word.length);
        const bad = word.slice(0, i) + String.fromCodePoint(cp) + word.slice(i);
        expect(e1590(reasonOf(bad)), `U+${cp.toString(16)}`).toHaveLength(1);
        expect(e1590(reasonOf(word))).toEqual([]);
      }),
      { seed: SEED, numRuns: 150 },
    );
  });
  test("rfc:0160 conformance: `https://[::1]` is one E1590 with no fix", () => {
    const found = e1590(decl("img", "https://[::1]"));
    expect(found).toHaveLength(1);
    expect(found[0]?.fix ?? null).toBeNull();
  });
});
