// Spec: k.check, clause "`respond` from `@keel/cli/testing` of the one record `{ kind: 'diag', code: 'E1751', message: m }` gives the same message with `format` `compact`, `pretty` and `json` (the text after `E1751 ` on the compact line, pretty's second line after its two spaces, the json line's `message`): `m` itself for 89 `a`s; 86 `a`s and `...` for 90 `a`s; `x y` for `'x \n\n  y '`; 85 `a`s and `...` for 85 `a`s, `'\u{1F600}'` and 10 `b`s."
// k.check, Diagnostics (the clip rule, in `respond`): at most 89 UTF-16 code units; a longer message keeps 86, or 85 when the 86th is the first half of a surrogate pair, then `...`; whitespace runs holding a line feed become one space first.
// Seed 1337 (every property below).
// ASSUMPTIONS: the compact line is `E1751 <message>`, pretty's is `E1751` then `  <message>`, json's is one object line; the oracle is the rule as the Diagnostics paragraph states it, with trimming by `String.prototype.trim`.
import { respond } from "@keel/cli/testing";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
type Format = "compact" | "pretty" | "json";
const FORMATS: readonly Format[] = ["compact", "pretty", "json"];

function messageIn(format: Format, m: string): string {
  const out = respond([{ kind: "diag", code: "E1751", message: m }], { format }).stdout;
  const lines = out.split("\n");
  if (format === "compact") {
    const line = lines.find((l) => l.startsWith("E1751 ")) ?? "";
    return line.slice("E1751 ".length);
  }
  if (format === "pretty") {
    const at = lines.findIndex((l) => l === "E1751");
    return (lines[at + 1] ?? "").replace(/^ {2}/, "");
  }
  const line = lines.find((l) => l.startsWith("{")) ?? "{}";
  const parsed: unknown = JSON.parse(line);
  const msg = typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "message") : undefined;
  return typeof msg === "string" ? msg : "";
}

/** The rule: fold line-feed whitespace runs, trim, then at most 89 units, else 86 (85 before a split pair) and `...`. */
function clipped(m: string): string {
  const one = m.replace(/\s*\n\s*/g, " ").trim();
  if (one.length <= 89) return one;
  const code = one.charCodeAt(85);
  const keep = code >= 0xd800 && code <= 0xdbff ? 85 : 86;
  return `${one.slice(0, keep)}...`;
}

const isLoneSurrogateFree = (s: string): boolean =>
  !/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(s);

describe("k.check: a diagnostic's message is clipped in `respond`", () => {
  it("89 `a`s are `m` itself in compact, pretty and json", () => {
    const m = "a".repeat(89);
    for (const f of FORMATS) expect(messageIn(f, m)).toBe(m);
  });

  it("90 `a`s are 86 `a`s and `...` in compact, pretty and json", () => {
    for (const f of FORMATS) expect(messageIn(f, "a".repeat(90))).toBe(`${"a".repeat(86)}...`);
  });

  it("a message with line breaks, 'x \\n\\n  y ', is `x y` in compact, pretty and json", () => {
    for (const f of FORMATS) expect(messageIn(f, "x \n\n  y ")).toBe("x y");
  });

  it("85 `a`s, an emoji (a surrogate pair) and 10 `b`s are 85 `a`s and `...` in compact, pretty and json", () => {
    const m = `${"a".repeat(85)}\u{1F600}${"b".repeat(10)}`;
    for (const f of FORMATS) expect(messageIn(f, m)).toBe(`${"a".repeat(85)}...`);
  });

  it("a message of any length and pair positions is clipped to the rule, the same in compact, pretty and json", () => {
    const unit = fc.constantFrom("a", "b", "\u{1F600}", "\u{1F4A9}", "é");
    fc.assert(
      fc.property(fc.array(unit, { minLength: 60, maxLength: 120 }), (parts) => {
        const m = parts.join("");
        const want = clipped(m);
        for (const f of FORMATS) expect(messageIn(f, m)).toBe(want);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  it("whatever its length, the clipped message is at most 89 UTF-16 code units, holds no lone surrogate when `m` held none, and an unclipped one is `m`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), fc.integer({ min: 0, max: 199 }), (len, pos) => {
        const base = "a".repeat(len);
        const at = Math.min(pos, len);
        const m = `${base.slice(0, at)}\u{1F600}${base.slice(at)}`;
        for (const f of FORMATS) {
          const got = messageIn(f, m);
          expect(got.length).toBeLessThanOrEqual(89);
          expect(isLoneSurrogateFree(got)).toBe(true);
          if (m.length <= 89) expect(got).toBe(m);
          else expect(got.endsWith("...")).toBe(true);
        }
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("a longer message keeps 86 code units before `...`, or 85 when the 86th is the first half of a pair, at every pair position", () => {
    for (let at = 80; at <= 90; at++) {
      const m = `${"a".repeat(at)}\u{1F600}${"b".repeat(20)}`;
      const keep = at === 85 ? 85 : 86;
      for (const f of FORMATS) {
        const got = messageIn(f, m);
        expect(got).toBe(`${m.slice(0, keep)}...`);
      }
    }
  });

  it("whitespace runs holding a line feed become one space before the length is counted", () => {
    const ws = fc.constantFrom(" \n", "\n\n  ", " \n ", "\n", "\r\n", "\t\n\t");
    fc.assert(
      fc.property(
        fc.array(fc.stringMatching(/^[a-z]{1,12}$/), { minLength: 1, maxLength: 12 }),
        fc.array(ws, { minLength: 12, maxLength: 12 }),
        (words, seps) => {
          const m = words.map((w, i) => `${w}${i < words.length - 1 ? (seps[i] ?? " ") : ""}`).join("");
          const want = words.join(" ");
          for (const f of FORMATS) expect(messageIn(f, m)).toBe(want.length <= 89 ? want : clipped(want));
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
