// keel review's model (k.review Novelty, Loudness): folding literals back to their string, the loudness table and its
// opt-in step, and novelty matching. Seed 1337.
import fc from "fast-check";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vitest";
import type { Danger } from "../src/review/Danger.ts";
import type { Found } from "../src/review/Found.ts";
import type { Novelty } from "../src/review/Novelty.ts";
import { foldString } from "../src/review/foldString.ts";
import { judge } from "../src/review/judge.ts";
import { loudness } from "../src/review/loudness.ts";

const SEED = 1337;
const DANGERS: readonly Danger[] = ["critical", "high", "medium", "low"];
const NOVELTIES: readonly Novelty[] = ["new", "changed", "standing", "accepted"];
const RANK = { fail: 3, warn: 2, list: 1, count: 0 } as const;

/** The expression of `export const v = <src>;`. */
function expr(src: string): Parameters<typeof foldString>[0] | null {
  const st = parseSync("a.ts", `export const v = ${src};`, { sourceType: "module", lang: "ts" }).program.body[0];
  if (st?.type !== "ExportNamedDeclaration" || st.declaration?.type !== "VariableDeclaration") return null;
  return st.declaration.declarations[0]?.init ?? null;
}

describe("foldString", () => {
  test("a string split into literal parts and rejoined by +, a template, .join or String.raw folds back to it", () => {
    const part = fc.stringMatching(/^[a-z@\- ]{0,6}$/);
    fc.assert(
      fc.property(fc.array(part, { minLength: 1, maxLength: 5 }), fc.integer({ min: 0, max: 3 }), (parts, form) => {
        const lit = parts.map((p) => JSON.stringify(p));
        const src = [
          lit.join(" + "),
          `\`${parts.map((p) => `\${${JSON.stringify(p)}}`).join("")}\``,
          `[${lit.join(", ")}].join("")`,
          `String.raw\`${parts.join("")}\``,
        ][form];
        const e = expr(src ?? "");
        expect(e === null ? null : foldString(e)).toBe(parts.join(""));
      }),
      { seed: SEED, numRuns: 200 },
    );
  });

  test("a part that is not a literal leaves nothing folded", () => {
    for (const src of ["a + 'x'", "`x${a}`", "[a, 'x'].join('')", "String.raw`${a}`", "f('x')", "['a'].join(b)"]) {
      const e = expr(src);
      expect(e === null ? "unparsed" : foldString(e), src).toBeNull();
    }
    const comma = expr("['a', 'b'].join()");
    expect(comma === null ? null : foldString(comma)).toBe("a,b");
  });
});

describe("loudness", () => {
  test("the table of k.review Loudness", () => {
    const table = DANGERS.map((d) => NOVELTIES.map((n) => loudness(d, n, false)).join(" "));
    expect(table).toEqual([
      "fail fail fail count",
      "fail fail warn count",
      "warn warn list count",
      "list list list count",
    ]);
  });

  test("an opt-in is one step quieter, never louder; more danger is never quieter; accepted only counts", () => {
    fc.assert(
      fc.property(fc.constantFrom(...DANGERS), fc.constantFrom(...NOVELTIES), (d, n) => {
        const work = RANK[loudness(d, n, false)];
        const opt = RANK[loudness(d, n, true)];
        expect(opt).toBeLessThanOrEqual(work);
        expect(work - opt).toBeLessThanOrEqual(1);
        if (work >= 2) expect(work - opt).toBe(1);
        const i = DANGERS.indexOf(d);
        const above = DANGERS[i - 1];
        if (above !== undefined) expect(RANK[loudness(above, n, false)]).toBeGreaterThanOrEqual(work);
        if (n === "accepted") expect(loudness(d, n, true)).toBe("count");
      }),
      { seed: SEED, numRuns: 64 },
    );
  });
});

const found = (id: string, line: number, code = "R1050", path = "a.ts"): Found => ({
  code,
  path,
  line,
  col: 1,
  message: "m",
  protection: "k.check",
  opt: false,
  danger: "medium",
  id,
});

describe("judge", () => {
  test("same id standing, another id of that code and path changed (nearest first), the rest new", () => {
    const base = [found("a", 1), found("b", 10), found("c", 1, "R1050", "b.ts")];
    const head = [found("a", 3), found("x", 9), found("y", 20), found("z", 1, "R1051")];
    expect(judge(head, base, () => false).map((j) => [j.found.id, j.novelty, j.base?.id])).toEqual([
      ["a", "standing", "a"],
      ["x", "changed", "b"],
      ["y", "new", undefined],
      ["z", "new", undefined],
    ]);
    expect(judge(head, base, (f) => f.id === "a")[0]?.novelty).toBe("accepted");
  });

  test("each base finding is matched once, and a head finding is never new while an unmatched base one of its group is left", () => {
    const ids = fc.array(fc.constantFrom("a", "b", "c", "d"), { maxLength: 6 });
    fc.assert(
      fc.property(ids, ids, (h, b) => {
        const head = h.map((id, i) => found(id, i + 1));
        const base = b.map((id, i) => found(id, i + 1));
        const j = judge(head, base, () => false);
        const matched = j.flatMap((x) => (x.base === undefined ? [] : [x.base]));
        expect(new Set(matched).size).toBe(matched.length);
        const fresh = j.filter((x) => x.novelty === "new").length;
        expect(fresh).toBe(Math.max(0, head.length - base.length));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
