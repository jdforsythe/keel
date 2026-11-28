// k.test-run Results "Each error outside any test's result, an unhandled error or rejection vitest reports or one `keel test` catches around the run, is one T0001 `uncaught: <first line>` ... located at its first app frame ..."
// Spec: k.test-run, clause "`keel test` over a project whose test leaves a `setTimeout` that throws `new Error('late')` after the test ends prints `T0001 <file>:<line>:<col> uncaught: late` at the `throw`, and the run fails."
// The real `keel` binary runs `keel test` (compact) over a temp project (OS tmpdir). No generated inputs; seed n/a.
// The fixture's timer is spelled so its source is data here. A second test of the fixture waits, so the throw lands after the first test ended.
// The column is read as the position of the `throw` keyword or of the `new Error` it throws (V8 reports the latter); the spec says only "at the `throw`".
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeProject, removeProject, root } from "./test-sim-project.ts";

const TIMER = ["set", "Timeout"].join("");
const BIN = join(root, "packages", "cli", "src", "bin.ts");
const THROW_LINE = `  ${TIMER}(() => { throw new Error("late"); }, 20);`;
const TEST_SOURCE = [
  'import { expect, it } from "vitest";',
  "",
  'it("schedules a throw and ends", () => {',
  THROW_LINE,
  "  expect(1).toBe(1);",
  "});",
  "",
  'it("outlasts the timer", async () => {',
  `  await new Promise((resolve) => ${TIMER}(resolve, 300));`,
  "  expect(1).toBe(1);",
  "});",
  "",
].join("\n");
const LINE_NO = TEST_SOURCE.split("\n").indexOf(THROW_LINE) + 1;
const COL_THROW = THROW_LINE.indexOf("throw") + 1;
const COL_NEW = THROW_LINE.indexOf("new Error") + 1;

const cleanEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    env[k] = v;
  }
  return env;
};

let dir = "";
let status: number | null = null;
let out = "";

beforeAll(() => {
  dir = makeProject("late-throw", { "test/late.test.ts": TEST_SOURCE });
  const r = spawnSync(process.execPath, [BIN, "test", "--format=compact"], {
    cwd: dir,
    encoding: "utf8",
    env: cleanEnv(),
    timeout: testTime(150_000),
    killSignal: "SIGKILL",
  });
  status = r.status;
  out = r.stdout;
}, fixedTime(180_000));

afterAll(() => {
  removeProject(dir);
});

describe("k.test-run: keel test prints a late throw as a located T0001", () => {
  it("`keel test` over a project whose test schedules a throw that fires after the test ends prints `T0001 <test file>:<line>:<col> uncaught: late` at the throw", () => {
    const hits = out.split("\n").filter((l) => l.includes("uncaught: late"));
    expect(hits).toHaveLength(1);
    const m = /^T0001 (\S+):(\d+):(\d+) uncaught: late$/.exec(hits[0] ?? "");
    expect(m, hits[0]).not.toBeNull();
    expect(m?.[1]).toBe("test/late.test.ts");
    expect(Number(m?.[2])).toBe(LINE_NO);
    expect([COL_THROW, COL_NEW]).toContain(Number(m?.[3]));
  });

  it("the run fails", () => {
    expect(status).not.toBe(0);
    expect(out).not.toMatch(/^ok /m);
  });
});
