// Spec: k.ledger, clause "\"E2001-E2003 each fire.\" cited by files adding `(E2001)`, `(E2002)`, `(E2003)` is `example`; skipping one file's tests, or one file adding `(E2001-E2003)` alone, gives `none`; \"No E2001-E2003.\" cited by a file naming no code is `example`." (E2001, E2002, E2003)
// The real `keel` binary over a temp project (OS tmpdir): one spec section whose clauses are the three cases, cited by
// in-memory conformance files. Clause items are `<section>#<n>` (1-based Conformance sentence). Property seed: 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ledgerRecord } from "./ledger-fixture-kinds.ts";
import { keel, makeProject, removeProject } from "./test-sim-project.ts";

const SPEC = "spec/kernel/k.fx.md";
const SEED = 1337;

const specText = (clauses: readonly string[]): string =>
  ["# k.fx: Fixture", "status: conformance-covered", "", "**Conformance.**", ...clauses.map((c) => `- ${c}`), ""].join(
    "\n",
  );

/** A citing file: `header` lines, then one trivial test (skipped when `skip`). */
const citing = (header: string, skip = false): string =>
  `${header}\nimport { expect, it } from "vitest";\nit${skip ? ".skip" : ""}("holds", () => {\n  expect(1 + 1).toBe(2);\n});\n`;
const cite = (clause: string, codes: string, skip = false): string =>
  citing(`// Spec: k.fx, clause "${clause}"${codes === "" ? "" : ` (${codes})`}`, skip);

const rungs = (clauses: readonly string[], tests: Readonly<Record<string, string>>): (unknown | undefined)[] => {
  const dir = makeProject("ledger-range", { [SPEC]: specText(clauses), ...tests });
  try {
    const run = keel(dir, ["ledger"]);
    return clauses.map((_, i) => ledgerRecord(run, `k.fx#${i + 1}`)?.rung);
  } finally {
    removeProject(dir);
  }
};

const EACH = "E2001-E2003 each fire.";
const NONE = "No E2001-E2003.";
const T = (n: number): string => `packages/m/conformance/t${n}.test.ts`;

describe("k.ledger: a range clause holds a rung only while every code in it is named by a citing file", () => {
  it('"E2001-E2003 each fire." cited by files adding `(E2001)`, `(E2002)`, `(E2003)` is `example`', () => {
    const tests = { [T(1)]: cite(EACH, "E2001"), [T(2)]: cite(EACH, "E2002"), [T(3)]: cite(EACH, "E2003") };
    expect(rungs([EACH], tests)).toEqual(["example"]);
  }, 60_000);

  it("skipping one citing file's tests gives `none`", () => {
    const tests = { [T(1)]: cite(EACH, "E2001"), [T(2)]: cite(EACH, "E2002", true), [T(3)]: cite(EACH, "E2003") };
    expect(rungs([EACH], tests)).toEqual(["none"]);
  }, 60_000);

  it("one file adding `(E2001-E2003)` alone gives `none`: a range names its ends, not the codes between", () => {
    expect(rungs([EACH], { [T(1)]: cite(EACH, "E2001-E2003") })).toEqual(["none"]);
  }, 60_000);

  it('"No E2001-E2003." cited by a file naming no code is `example`: no `each`, an ordinary clause', () => {
    expect(rungs([NONE], { [T(1)]: cite(NONE, "") })).toEqual(["example"]);
  }, 60_000);

  it("for any range of one letter, every code named is `example` and any one code left out is `none`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2001, max: 2990 }), fc.integer({ min: 2, max: 5 }), fc.nat(), (lo, len, pick) => {
        const codes = Array.from({ length: len + 1 }, (_, i) => `E${lo + i}`);
        const clause = `E${lo}-E${lo + len} each fire.`;
        const files = (omit: number): Record<string, string> =>
          Object.fromEntries(codes.flatMap((c, i) => (i === omit ? [] : [[T(i), cite(clause, c)] as const])));
        expect(rungs([clause], files(-1))).toEqual(["example"]);
        expect(rungs([clause], files(pick % codes.length))).toEqual(["none"]);
      }),
      { numRuns: 5, seed: SEED },
    );
  }, 600_000);
});
