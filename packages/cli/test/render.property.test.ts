// Limit and quiet invariants of the renderer, and determinism. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { normalize } from "../src/internal/normalize.ts";
import { render } from "../src/internal/render.ts";
import type { Mode } from "../src/types/Mode.ts";
import type { OutRecord } from "../src/types/OutRecord.ts";

const SEED = 1337;
const lines = (s: string): string[] => s.split("\n").filter((l) => l !== "");

const recordsArb = fc
  .array(fc.tuple(fc.constantFrom("E1042", "E1752", "W1001", "I1055"), fc.nat({ max: 50 })), { maxLength: 40 })
  .map((xs): OutRecord[] => [
    ...xs.map(([code, n]) => ({ kind: "diag", code, path: `src/f${n}.ts`, line: n + 1, col: 1, message: `m${n}` })),
    { kind: "summary", ok: xs.length === 0, name: "check", counts: { files: xs.length } },
  ]);
const opts = (mode: Mode, extra: { quiet?: boolean; limit?: number }) => ({
  mode,
  quiet: extra.quiet === true,
  limit: extra.limit,
  verbose: false,
  code: undefined,
  command: "check",
});
const countBy = (rs: readonly OutRecord[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const r of rs) if (r.kind === "diag" && typeof r.code === "string") m.set(r.code, (m.get(r.code) ?? 0) + 1);
  return m;
};

describe("render invariants", () => {
  it("--limit N: at most N lines per code and one `... +K more` line with K = count - N", () => {
    fc.assert(
      fc.property(
        recordsArb,
        fc.integer({ min: 1, max: 12 }),
        fc.constantFrom<Mode>("compact", "pretty"),
        (rs, n, mode) => {
          const out = lines(render(rs, opts(mode, { limit: n })));
          for (const [code, count] of countBy(rs)) {
            const shown = out.filter((l) => l.startsWith(`${code} `)).length;
            expect(shown).toBe(Math.min(n, count));
            const more = out.filter((l) => l.startsWith("... +") && l.includes(` more ${code} `));
            expect(more).toEqual(count > n ? [`... +${count - n} more ${code} (keel check --code ${code})`] : []);
          }
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("json: --limit N caps records per code; every line parses; summary last", () => {
    fc.assert(
      fc.property(recordsArb, fc.integer({ min: 1, max: 12 }), (rs, n) => {
        const out = lines(render(rs, opts("json", { limit: n })));
        const recs = out.map((l): unknown => JSON.parse(l));
        let expected = 1;
        for (const count of countBy(rs).values()) expected += Math.min(n, count);
        expect(recs).toHaveLength(expected);
        expect(out.at(-1)).toContain('"kind":"summary"');
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("--quiet prints exactly the trailer, which is the last line of the full output", () => {
    fc.assert(
      fc.property(recordsArb, fc.constantFrom<Mode>("compact", "json", "pretty"), (rs, mode) => {
        const q = lines(render(rs, opts(mode, { quiet: true })));
        expect(q).toHaveLength(1);
        expect(lines(render(rs, opts(mode, {}))).at(-1)).toBe(q[0]);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("rendering is a pure function of its input: equal records give byte-identical output", () => {
    fc.assert(
      fc.property(recordsArb, fc.constantFrom<Mode>("compact", "json", "pretty"), (rs, mode) => {
        expect(render(structuredClone(rs), opts(mode, {}))).toBe(render(rs, opts(mode, {})));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("compact and json contain no ANSI escapes or carriage returns", () => {
    fc.assert(
      fc.property(recordsArb, fc.constantFrom<Mode>("compact", "json"), (rs, mode) => {
        const out = render(rs, opts(mode, {}));
        expect(out).not.toContain(String.fromCharCode(27));
        expect(out).not.toContain("\r");
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a record kind without a formatter becomes E1054", () => {
    const rs = normalize([{ kind: "nobody.home", x: 1 }]);
    expect(rs).toEqual([{ kind: "diag", code: "E1054", message: "record kind nobody.home has no formatter" }]);
  });
});
