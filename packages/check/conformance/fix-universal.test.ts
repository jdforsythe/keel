// Spec: k.fixes, clause "Every fixture of `packages/check/conformance` whose diagnostic carries a fix, applied alone, gives a project for which `keel check` reports neither that diagnostic nor any the start did not have, and `tsc` reports none."
// Seed 1337. One property over every fixture of the folder (fixtures-by-code.ts and support.ts FIXTURES): for each diagnostic that carries a fix, the fix alone is applied with `git apply`, then `check` runs with the type pass on (a TypeScript error is E1751, so "tsc reports none" is "no E1751 the start did not have"). Fixtures whose own start project already has a TypeScript error are compared by count, not by absence.
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { CODE_FIXTURES } from "./fixtures-by-code.ts";
import { applyFix } from "./rules-support.ts";
import { FIXTURES, type Files, SEED } from "./support.ts";

type Options = NonNullable<Parameters<typeof check>[1]>;
interface Start {
  code: string;
  files: Files;
  opts: Options;
  after: Options | undefined;
}
const STARTS: Start[] = [
  ...Object.entries(CODE_FIXTURES).map(([code, fx]) => ({
    code,
    files: fx.bad,
    opts: { ...(fx.badOpts ?? fx.opts ?? {}), types: true } satisfies Options,
    after: fx.fixedOpts === undefined ? undefined : { ...fx.fixedOpts, types: true },
  })),
  ...FIXTURES.map((x) => ({
    code: x.code,
    files: [{ path: "C.tsx", source: x.bad }],
    opts: { types: true } satisfies Options,
    after: undefined,
  })),
];
const tally = (ds: readonly { code: string; path: string }[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const d of ds) m.set(`${d.code} ${d.path}`, (m.get(`${d.code} ${d.path}`) ?? 0) + 1);
  return m;
};

test(
  "property: the fix of every diagnostic that carries one, applied alone, leaves that diagnostic and nothing new, and no TypeScript error the start did not have",
  () => {
    fc.assert(
      fc.property(fc.constantFrom(...STARTS), (start) => {
        const before = check(start.files, start.opts).diagnostics;
        const before1751 = before.filter((d) => d.code === "E1751").length;
        for (const d of before) {
          if (d.fix === undefined) continue;
          const patched = applyFix(start.files, d.fix);
          const after = check(patched, start.after ?? start.opts).diagnostics;
          const was = tally(before);
          const now = tally(after);
          for (const [k, n] of now)
            expect(n, `${start.code}: new or more of ${k}`).toBeLessThanOrEqual(was.get(k) ?? 0);
          expect(after.filter((x) => x.code === d.code && x.path === d.path).length).toBeLessThan(
            before.filter((x) => x.code === d.code && x.path === d.path).length,
          );
          expect(after.filter((x) => x.code === "E1751").length).toBeLessThanOrEqual(before1751);
        }
      }),
      { seed: SEED, numRuns: STARTS.length * 2 },
    );
  },
  CHECK_CASE_BOUND * STARTS.length,
);

test(
  "every fix-bearing code of fix-diffs' partition has a fixture whose diagnostic carries a fix",
  () => {
    const withFix = new Set(
      STARTS.filter((s) =>
        check(s.files, { ...s.opts, types: false }).diagnostics.some((d) => d.fix !== undefined),
      ).map((s) => s.code),
    );
    for (const code of ["E1451", "E1452", "E1455"]) expect(withFix.has(code), code).toBe(true);
    for (const code of [
      "E1453",
      "E1457",
      "E1458",
      "E1459",
      "E1460",
      "E1461",
      "E1765",
      "E1766",
      "E1203",
      "E1208",
      "E1256",
      "E1762",
    ]) {
      for (const s of STARTS.filter((x) => x.code === code)) {
        const ds = check(s.files, { ...s.opts, types: false }).diagnostics.filter((d) => d.code === code);
        expect(
          ds.every((d) => d.fix === undefined),
          code,
        ).toBe(true);
      }
    }
  },
  CHECK_CASE_BOUND * 3,
);
