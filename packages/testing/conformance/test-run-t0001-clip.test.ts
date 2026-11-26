// Spec: k.test-run, clause "`testResults([], [e], cwd)` for an error `e` whose `message` is 200 `a`s, with no `code`, `stacks` or `stack`, is one T0001 whose message is `uncaught: `, 76 `a`s and `...`; `testResults([f], [], cwd)` for a file `f` whose `result` is `{ state: 'fail', errors: [{ message: m }] }`, `m` 200 `a`s, and which has no test, is one T0001 whose message is 86 `a`s and `...`."
// k.test-run, Results "Each error outside any test's result, an unhandled error or rejection vitest reports or one `keel test` catches around the run, is one T0001 `uncaught: <first line>`, its string `code` before the line when it has one, its message clipped as k.check Diagnostics says."
// Seed 1337 (the property).
// ASSUMED (the spec names no report shape): as test-run-results-locations.test.ts, the report holds its diagnostics as objects with `code: "T0001"` and `message`, found by walking the returned value; a file is vitest's `{ filepath, name, result, tasks: [] }`.
import { fixedTime } from "@keel/tooling/test-time";
import { testResults } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const CWD = "/work/project";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const walk = (v: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] => {
  if (Array.isArray(v)) for (const x of v) walk(x, out);
  else if (isRecord(v)) {
    if (v.code === "T0001") out.push(v);
    else for (const x of Object.values(v)) walk(x, out);
  }
  return out;
};
const uncaught = (message: string): unknown[] =>
  walk(testResults([], [{ name: "Error", message }], CWD)).map((d) => d.message);
const failedFile = (message: string): unknown[] =>
  walk(
    testResults(
      [
        {
          filepath: `${CWD}/test/a.test.ts`,
          name: "test/a.test.ts",
          result: { state: "fail", errors: [{ message }] },
          tasks: [],
        },
      ],
      [],
      CWD,
    ),
  ).map((d) => d.message);

const lone = /[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/;
const unit = fc.constantFrom("a", "b", "\u{1F600}", "é");

describe("k.test-run: a T0001 message is clipped", () => {
  it(
    "an uncaught error whose message is 200 `a`s is one T0001 whose message is `uncaught: `, 76 `a`s and `...`",
    () => {
      expect(uncaught("a".repeat(200))).toEqual([`uncaught: ${"a".repeat(76)}...`]);
    },
    fixedTime(30_000),
  );

  it(
    "a file that failed to run with a 200-`a` message and no test is one T0001 whose message is 86 `a`s and `...`",
    () => {
      expect(failedFile("a".repeat(200))).toEqual([`${"a".repeat(86)}...`]);
    },
    fixedTime(30_000),
  );

  it(
    "whatever the message, a T0001 message is at most 89 UTF-16 code units and holds no lone surrogate, for an uncaught error and a failed file",
    () => {
      fc.assert(
        fc.property(fc.array(unit, { minLength: 1, maxLength: 140 }), (parts) => {
          const m = parts.join("");
          for (const got of [...uncaught(m), ...failedFile(m)]) {
            expect(typeof got).toBe("string");
            if (typeof got !== "string") continue;
            expect(got.length).toBeLessThanOrEqual(89);
            expect(lone.test(got)).toBe(false);
          }
        }),
        { seed: SEED, numRuns: 150 },
      );
    },
    fixedTime(30_000),
  );

  it(
    "a message that fits is kept whole: `uncaught: ` and 78 `a`s (89 units) is unchanged",
    () => {
      expect(uncaught("a".repeat(78))).toEqual([`uncaught: ${"a".repeat(78)}`]);
    },
    fixedTime(30_000),
  );
});
