// Spec: k.test-run Results "Each error outside any test's result ... is one T0001 `uncaught: <first line>`, its string `code` before the line when it has one ... It is located at its first app frame, from vitest's parsed `stacks` when present ...; with none, at 1:1 of the file vitest names for it (`VITEST_TEST_PATH`); with neither, without a location."
// Spec: k.test-run Conformance "`testResults([], [e], cwd)` for an error whose `stacks` are a `node_modules` frame, then `cwd/test/a.test.ts` 12:11, is one T0001 at `test/a.test.ts:12:11`, `uncaught: boom`; with `code` `ECONNRESET`, `uncaught: ECONNRESET boom`; with no app frame and `VITEST_TEST_PATH` `cwd/test/a.test.ts`, at `test/a.test.ts:1:1`; with neither, unlocated."
// Seed: 1337 (fc.assert below).
// ASSUMED (the spec names no report shape): the report holds its diagnostics as objects `{ code, path?, line?, col?, message }` (OUTPUT.md diagnostic shape)
// somewhere in the returned value; they are found by walking it for `code: "T0001"`. An error is vitest's `{ name, message, stacks: [{ method, file, line, column }], code?, VITEST_TEST_PATH? }`.
import { testResults } from "@keel/testing";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const CWD = "/work/project";
const APP = `${CWD}/test/a.test.ts`;
const NODE_MODULES = `${CWD}/node_modules/dep/index.js`;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const walk = (v: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] => {
  if (Array.isArray(v)) for (const x of v) walk(x, out);
  else if (isRecord(v)) {
    if (v.code === "T0001") out.push(v);
    else for (const x of Object.values(v)) walk(x, out);
  }
  return out;
};
const diagsOf = (error: unknown): Record<string, unknown>[] => walk(testResults([], [error], CWD));
const frame = (file: string, line: number, column: number) => ({ method: "f", file, line, column });

describe("k.test-run: testResults locates an uncaught error", () => {
  it("an error whose stacks are a node_modules frame, then cwd/test/a.test.ts 12:11, is one T0001 at test/a.test.ts:12:11, `uncaught: boom`", () => {
    const e = { name: "Error", message: "boom", stacks: [frame(NODE_MODULES, 3, 5), frame(APP, 12, 11)] };
    const diags = diagsOf(e);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({
      code: "T0001",
      path: "test/a.test.ts",
      line: 12,
      col: 11,
      message: "uncaught: boom",
    });
  });

  it("the first app frame is the location whatever precedes it and whatever follows (property over lines and columns)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.constantFrom(
          "node:internal/timers",
          NODE_MODULES,
          `${CWD}/node_modules/vitest/dist/x.js`,
          `${CWD}/node_modules/@vitest/runner/y.js`,
        ),
        (line, col, otherLine, skipped) => {
          const e = {
            name: "Error",
            message: "boom",
            stacks: [frame(skipped, otherLine, 1), frame(APP, line, col), frame(`${CWD}/test/b.test.ts`, otherLine, 2)],
          };
          const diags = diagsOf(e);
          expect(diags).toHaveLength(1);
          expect(diags[0]).toMatchObject({ path: "test/a.test.ts", line, col, message: "uncaught: boom" });
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("with a string code ECONNRESET the message is `uncaught: ECONNRESET boom`", () => {
    const e = {
      name: "Error",
      message: "boom",
      code: "ECONNRESET",
      stacks: [frame(NODE_MODULES, 3, 5), frame(APP, 12, 11)],
    };
    const diags = diagsOf(e);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ path: "test/a.test.ts", line: 12, col: 11, message: "uncaught: ECONNRESET boom" });
  });

  it("with no app frame and VITEST_TEST_PATH cwd/test/a.test.ts the T0001 is at test/a.test.ts:1:1", () => {
    const e = { name: "Error", message: "boom", stacks: [frame(NODE_MODULES, 3, 5)], VITEST_TEST_PATH: APP };
    const diags = diagsOf(e);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ path: "test/a.test.ts", line: 1, col: 1, message: "uncaught: boom" });
  });

  it("with neither an app frame nor VITEST_TEST_PATH the T0001 has no path", () => {
    const e = { name: "Error", message: "boom", stacks: [frame(NODE_MODULES, 3, 5)] };
    const diags = diagsOf(e);
    expect(diags).toHaveLength(1);
    expect(diags[0]).toMatchObject({ code: "T0001", message: "uncaught: boom" });
    expect([undefined, ""]).toContain(diags[0]?.path);
  });
});
