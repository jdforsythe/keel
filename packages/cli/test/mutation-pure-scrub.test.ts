// Exact-output tests for scrubCode (mutation killers).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { scrubCode } from "../src/internal/scrubCode.ts";

const SEED = 1337;
const sp = (n: number): string => " ".repeat(n);

describe("scrubCode", () => {
  it("plain code passes through; one output line per input line", () => {
    expect(scrubCode("a / b;\nlet x = 1;")).toEqual(["a / b;", "let x = 1;"]);
    expect(scrubCode("")).toEqual([""]);
    expect(scrubCode("a\n")).toEqual(["a", ""]);
  });

  it("line comments are blanked to the end of line, keeping length", () => {
    expect(scrubCode("a // hi")).toEqual([`a ${sp(5)}`]);
    expect(scrubCode("//x")).toEqual([sp(3)]);
    expect(scrubCode("a /")).toEqual(["a /"]);
    expect(scrubCode("a/b")).toEqual(["a/b"]);
  });

  it("block comments on one line", () => {
    expect(scrubCode("a /* x */ b")).toEqual([`a${sp(9)}b`]);
    expect(scrubCode("/**/x")).toEqual([`${sp(4)}x`]);
    expect(scrubCode("a /* x */ b /* y */ c")).toEqual([`a${sp(9)}b${sp(9)}c`]);
  });

  it("block comments span lines", () => {
    expect(scrubCode("a /* b\nc */ d\ne")).toEqual(["a     ", "     d", "e"]);
    expect(scrubCode("/*\n// not a line comment\n*/ x")).toEqual([sp(2), sp(21), "   x"]);
  });

  it("the opening /* is consumed whole: /*/ does not close itself", () => {
    expect(scrubCode("/*/ x\ny */ z")).toEqual([sp(5), "     z"]);
  });

  it("block comments do not nest and hide quotes and //", () => {
    expect(scrubCode("/* /* ' // */ x '")).toEqual([`${sp(14)}x '`]);
    expect(scrubCode('/* " */ y')).toEqual([`${sp(8)}y`]);
  });

  it("string contents are emptied; quotes kept", () => {
    expect(scrubCode(`x = 'abc' + "def";`)).toEqual([`x = '' + "";`]);
    expect(scrubCode(`'a//b' c`)).toEqual([`'' c`]);
    expect(scrubCode(`"a/*b" c`)).toEqual([`"" c`]);
  });

  it("the other quote kinds and backticks inside a string do not close it", () => {
    expect(scrubCode(`"it's" x`)).toEqual([`"" x`]);
    expect(scrubCode(`'say "hi"' x`)).toEqual([`'' x`]);
    expect(scrubCode("'a`b' x")).toEqual([`'' x`]);
    expect(scrubCode('"a`b" x')).toEqual([`"" x`]);
  });

  it("backslash escapes the next char", () => {
    expect(scrubCode(`"a\\"b" + 1`)).toEqual([`"" + 1`]);
    expect(scrubCode(`'a\\'b' + 1`)).toEqual([`'' + 1`]);
    expect(scrubCode(`"a\\\\" + b`)).toEqual([`"" + b`]);
    expect(scrubCode("`a\\`b` + 1")).toEqual(["`` + 1"]);
  });

  it("an unterminated string ends at end of line", () => {
    expect(scrubCode("'abc\nx // y")).toEqual(["'", `x ${sp(4)}`]);
    expect(scrubCode('"abc\nx')).toEqual(['"', "x"]);
    expect(scrubCode("/'/.test(s) // c")).toEqual(["/'"]);
  });

  it("template literals span lines and ignore quotes and comment openers inside", () => {
    expect(scrubCode("a`b\nc${d}e`f")).toEqual(["a`", "`f"]);
    expect(scrubCode('`it\'s "q" // x /* y`; z')).toEqual(["``; z"]);
    expect(scrubCode("`a\n// b\n`; // c")).toEqual(["`", "", `\`; ${sp(4)}`]);
    expect(scrubCode("`a` 'b' `c`")).toEqual(["`` '' ``"]);
  });

  it("property: scrubbing is length-preserving for comment-only input and idempotent on plain code", () => {
    const plain = fc.stringMatching(/^[a-z0-9 ;=+.(){}\n]*$/);
    fc.assert(
      fc.property(plain, (src) => {
        expect(scrubCode(src).join("\n")).toBe(src);
      }),
      { seed: SEED, numRuns: 100 },
    );
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z ]{0,20}$/), (body) => {
        const src = `//${body}`;
        expect(scrubCode(src)).toEqual([sp(src.length)]);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
