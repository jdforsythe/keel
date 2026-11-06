// testResults: vitest's finished task tree in OUTPUT.md terms (shared by keel test and the repository reporter).
// Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { testResults } from "../src/index.ts";

const SEED = 1337;
const CWD = "/repo/pkg";

const failing = {
  type: "test",
  name: "adds",
  result: {
    state: "fail",
    errors: [
      {
        message: "expected 2 to be 3 // Object.is equality\nmore",
        diff: "- Expected\n+ Received\n\n- 3\n+ 2",
        stack: [
          "AssertionError: expected 2 to be 3",
          "    at /repo/pkg/node_modules/chai/index.js:1:1",
          "    at node:internal/process/task_queues:104:5",
          "    at /repo/pkg/test/a.test.ts:12:17",
          "    at file:///repo/pkg/src/helper.ts:3:9",
        ].join("\n"),
      },
    ],
  },
};

describe("testResults", () => {
  it("a failed test is one T0001 at its first app frame with the compact diff and further frames as fix", () => {
    const suite = { type: "suite", name: "math", tasks: [failing] };
    const file = { file: { filepath: "/repo/pkg/test/a.test.ts" }, tasks: [suite] };
    const r = testResults([file], [], CWD);
    expect(r).toEqual({
      diagnostics: [
        {
          kind: "diag",
          code: "T0001",
          path: "test/a.test.ts",
          line: 12,
          col: 17,
          message: "math > adds: expected 2 to be 3 // Object.is equality",
          fix: "- 3\n+ 2\nat src/helper.ts:3:9",
        },
      ],
      tests: 1,
      failed: 1,
      skipped: 0,
      errors: 0,
    });
  });

  it("parsed stacks win over stack text; files failing outside tests and unhandled errors are reported", () => {
    const stacks = [{ file: "/repo/pkg/a.ts", line: 2, column: 4 }];
    const parsed = { type: "test", name: "t", result: { state: "fail", errors: [{ message: "m", stacks }] } };
    const r = testResults(
      [
        { filepath: "/repo/pkg/a.test.ts", tasks: [parsed] },
        {
          filepath: "/repo/other/b.test.ts",
          tasks: [],
          result: { state: "fail", errors: [{ message: "Cannot find module" }] },
        },
      ],
      [{ message: "boom" }],
      CWD,
    );
    expect(r.diagnostics.map((d) => [d.path, d.line, d.col, d.message])).toEqual([
      ["a.ts", 2, 4, "t: m"],
      ["../other/b.test.ts", 1, 1, "Cannot find module"],
      [undefined, undefined, undefined, "boom"],
    ]);
    expect([r.failed, r.errors]).toEqual([2, 1]);
  });

  it("counts: every test node counted once; failures, skips and passes partition them; output is deterministic", () => {
    const state = fc.constantFrom("pass", "fail", "skip", "todo");
    fc.assert(
      fc.property(fc.array(state, { maxLength: 30 }), (states) => {
        const tasks = states.map((s, i) => ({
          type: "test",
          name: `t${i}`,
          result: { state: s, errors: [{ message: "x" }] },
        }));
        const files = [{ filepath: "/repo/pkg/a.test.ts", tasks }];
        const r = testResults(files, [], CWD);
        expect(r.tests).toBe(states.length);
        expect(r.failed).toBe(states.filter((s) => s === "fail").length);
        expect(r.skipped).toBe(states.filter((s) => s === "skip" || s === "todo").length);
        expect(r.diagnostics).toHaveLength(r.failed);
        expect(testResults(files, [], CWD)).toEqual(r);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
