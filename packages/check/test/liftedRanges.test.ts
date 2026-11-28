// liftedRanges: the function given to a justified `unsafe(` call in a file under `unsafe/` (k.check, App code).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { liftedRanges } from "../src/internal/liftedRanges.ts";

const U = "unsafe";
const ranges = (source: string, path = "modules/m/unsafe/a.ts") => liftedRanges({ path, source });
const slice = (source: string, [a, b]: readonly [number, number]): string => source.slice(a, b);

describe("liftedRanges", () => {
  it("is the arrow function or function expression, first character to last", () => {
    const arrow = `${U}('r', (v: unknown): number => v as number)`;
    expect(ranges(arrow).map((r) => slice(arrow, r))).toEqual(["(v: unknown): number => v as number"]);
    const fn = `${U}("r", function () { return 1 })`;
    expect(ranges(fn).map((r) => slice(fn, r))).toEqual(["function () { return 1 }"]);
  });

  it("is empty for a name, a call, a blank or computed reason, and a file outside `unsafe/`", () => {
    expect(ranges(`${U}('r', g)`)).toEqual([]);
    expect(ranges(`${U}('r', g())`)).toEqual([]);
    expect(ranges(`${U}('  ', () => 1)`)).toEqual([]);
    expect(ranges(`${U}(\`a\${b}\`, () => 1)`)).toEqual([]);
    expect(ranges(`${U}(why, () => 1)`)).toEqual([]);
    expect(ranges(`${U}('r', () => 1)`, "modules/m/a.ts")).toEqual([]);
  });

  it("property: n justified calls give n ranges, each holding its own body", () => {
    fc.assert(
      fc.property(fc.array(fc.stringMatching(/^[a-z]{1,6}$/), { maxLength: 6 }), (names) => {
        const source = names.map((n, i) => `${U}('${n}', () => ${i})`).join("\n");
        const got = ranges(source).map((r) => slice(source, r));
        expect(got).toEqual(names.map((_, i) => `() => ${i}`));
      }),
      { seed: 1337, numRuns: 40 },
    );
  });
});
