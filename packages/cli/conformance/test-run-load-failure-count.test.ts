// Spec: k.library-pack, Pack: "`test`: `test: <f> of <n> tests failed; nothing packed` (`1 test`), counted as `keel test` counts them, a test file that fails to load one failed test; or `test: the run did not pass; nothing packed` when none failed and the run still failed (an error outside any test, such as an unhandled rejection); nowhere, after the test's diagnostics."
// The real `keel` binary runs `keel test` over temp projects (OS tmpdir). Seed 1337 (the property over mixes of files).
// MISSING SENTENCE: k.test-run and k.testing state no summary count for `keel test`; the one sentence that states how
// `keel test` counts a file that fails to load is the one above (from k.library-pack). What it gives: a file that fails
// to load is one failed test, so `failed` never exceeds `tests`. Not stated, so not asserted: `keel test` over no test
// files (`ok 0 tests`), over a file holding no test, and whether a skipped test counts in `tests`.
// ASSUMPTION: a file that fails to load adds one to `tests` as well as one to `failed` (the `<f> of <n>` of the sentence, with `f <= n`).
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { keel, makeProject, removeProject, summaryOf } from "./test-sim-project.ts";

const SEED = 1337;
const SLOW = 240_000;
const made: string[] = [];
afterAll(() => {
  for (const dir of made) removeProject(dir);
});

const PASS = "import { expect, it } from 'vitest'\nit('passes', () => {\n  expect(1).toBe(1)\n})\n";
const FAIL = "import { expect, it } from 'vitest'\nit('fails', () => {\n  expect(1).toBe(2)\n})\n";
const SKIP = "import { it } from 'vitest'\nit.skip('skipped', () => {})\n";
const BROKEN = "throw new Error('does not load')\n";
const SOURCES = { pass: PASS, fail: FAIL, skip: SKIP, broken: BROKEN } as const;
type Kind = keyof typeof SOURCES;

const run = (kinds: readonly Kind[]) => {
  const files: Record<string, string> = {};
  kinds.forEach((k, i) => {
    files[`test/f${i}.test.ts`] = SOURCES[k];
  });
  const dir = makeProject("load-count", files);
  made.push(dir);
  const r = keel(dir, ["test"]);
  const counts = summaryOf(r)?.counts;
  const num = (key: string): number => {
    const v = typeof counts === "object" && counts !== null ? Reflect.get(counts, key) : undefined;
    return typeof v === "number" ? v : Number.NaN;
  };
  return { r, tests: num("tests"), failed: num("failed") };
};

describe("`keel test` counts a test file that fails to load as one failed test", () => {
  it(
    "a project whose only test file fails to load is `1 tests, 1 failed` and the run fails",
    () => {
      const o = run(["broken"]);
      expect({ tests: o.tests, failed: o.failed }).toEqual({ tests: 1, failed: 1 });
      expect(o.r.status).toBe(1);
    },
    SLOW,
  );

  it(
    "one test file of two fails to load, the other passing: `2 tests, 1 failed`",
    () => {
      const o = run(["pass", "broken"]);
      expect({ tests: o.tests, failed: o.failed }).toEqual({ tests: 2, failed: 1 });
      expect(o.r.status).toBe(1);
    },
    SLOW,
  );

  it(
    "for any mix of passing, failing, skipped and unloadable files, `failed` never exceeds `tests`, and `failed` is the failing tests plus the files that fail to load",
    () => {
      fc.assert(
        fc.property(
          fc.array(fc.constantFrom<Kind>("pass", "fail", "skip", "broken"), { minLength: 1, maxLength: 4 }),
          (kinds) => {
            const o = run(kinds);
            expect(o.failed).toBeLessThanOrEqual(o.tests);
            expect(o.failed).toBe(kinds.filter((k) => k === "fail" || k === "broken").length);
          },
        ),
        { seed: SEED, numRuns: 6 },
      );
    },
    SLOW * 3,
  );
});
