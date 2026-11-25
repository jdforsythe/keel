// Spec: std.sessions, clause "`redact(schema, value, { paths, seed, salt, strings?, found? })` (`./redact`) is that redaction, pure; it drops undeclared keys, and `strings: { except }` writes each string not under an `except` path as `x` repeated."
// Seed 1337 (fast-check `seed: 1337`).
// Readings: `redact` returns the redacted value; `paths` of `[]` redacts no entry; `strings: { except }` takes dotted paths as `piiPaths` writes them; "`x` repeated" is `x` repeated to the string's length; a string not under `except` includes one under an open object's declared field and an array item.
import { s } from "@keel/schema";
import { redact } from "@keel/std-sessions/redact";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const opts = { seed: 1337, numRuns: 60 };
const word = fc.stringMatching(/^[a-z]{1,16}$/);
const digits = fc.stringMatching(/^[0-9]{1,8}$/);
const marker = fc.stringMatching(/^[a-z]{16}$/);
const base = { paths: [], seed: 1, salt: "s" };

describe("std.sessions: redact (./redact)", () => {
  test("it drops undeclared keys, at any depth, with what is under them", () => {
    const Schema = s.object({ a: s.string(), o: s.object({ b: s.string() }), l: s.array(s.object({ c: s.int() })) });
    fc.assert(
      fc.property(digits, digits, marker, marker, fc.integer({ min: -9, max: 9 }), (a, b, k1, k2, c) => {
        const value = {
          a,
          [`u${k1}`]: { deep: `v${k2}` },
          o: { b, [`w${k1}`]: [`x${k2}`] },
          l: [{ c, [`y${k2}`]: `z${k1}` }],
        };
        const out = redact(Schema, value, base);
        expect(out).toEqual({ a, o: { b }, l: [{ c }] });
        const text = JSON.stringify(out);
        for (const m of [`u${k1}`, `v${k2}`, `w${k1}`, `x${k2}`, `y${k2}`, `z${k1}`]) expect(text).not.toContain(m);
      }),
      opts,
    );
  });

  test("it is pure: the value it is given is unchanged and two calls agree", () => {
    const Schema = s.object({ a: s.string() });
    fc.assert(
      fc.property(word, word, (a, k) => {
        const value = { a, [`u${k}`]: k };
        const before = JSON.stringify(value);
        const one = redact(Schema, value, base);
        expect(JSON.stringify(value)).toBe(before);
        expect(redact(Schema, value, base)).toEqual(one);
      }),
      opts,
    );
  });

  test("`strings: { except }` writes each string not under an `except` path as `x` repeated, and keeps one under it", () => {
    const Schema = s.object({
      keep: s.string(),
      drop: s.string(),
      o: s.object({ n: s.string(), m: s.int() }),
      l: s.array(s.string()),
    });
    fc.assert(
      fc.property(
        word,
        word,
        word,
        word,
        fc.array(word, { maxLength: 3 }),
        fc.integer({ min: -9, max: 9 }),
        (keep, drop, n, k, l, m) => {
          const value = { keep, drop, o: { n, m }, l, [`u${k}`]: "gone" };
          const out = redact(Schema, value, { ...base, strings: { except: ["keep"] } });
          expect(out).toEqual({
            keep,
            drop: "x".repeat(drop.length),
            o: { n: "x".repeat(n.length), m },
            l: l.map((x) => "x".repeat(x.length)),
          });
        },
      ),
      opts,
    );
  });
});
