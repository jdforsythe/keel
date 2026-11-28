// Also states, k.evaluator Questions: "The evaluator holds no fact of the machine but its start. A view answers by asking the command, which reads the disk, the environment and its own process (the working folder is the command's), answers, and records the question as an input or probe (k.check-cache Evaluation probes). The evaluator waits for each answer, so `readFileSync` and a `process.env` read are synchronous as in Node."
// Also states, k.evaluator Start: "It starts Node on `entry`, a file in a folder holding nothing else, with `--permission`, `--allow-fs-read` naming that folder alone, `--disallow-code-generation-from-strings` and `--zero-fill-buffers`, in a new empty working folder, with an environment built from nothing: `TZ`, `LANG` and each `LC_*` name of the command's, and no other value of it."
// Also states, k.evaluator Rules: "E1048 is a command code as E1050 is (k.compiler Rules): `check()` never reports it and `reportedCodes()` does not list it."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case (`G` of k.evaluator Conformance; evaluator-support.ts `gFixture`).
// An env name outside `TZ`, `LANG`, `LC_*` read by evaluated code (`REPRO_X`) is answered through the command and recorded: a miss when it changes, a hit when it does not (k.check-cache Evaluation probes: "each `process.env` name"). That the child's own environment lacks it is asserted at `evaluate` (packages/compiler/conformance/evaluator-seam.test.ts).
// The synchronous read is observed as the value reaching `.keel/routes.json` (the guard's redirect) in the same run.
import { reportedCodes } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { type Tree, brief, cloneTree, dropTree, householdTree, read } from "./derived-support.ts";
import { gFixture, keelBounded } from "./evaluator-support.ts";

const SLOW = testTime(600_000);
const RUN = 60_000;

let house: Tree | undefined;
const made: Tree[] = [];
afterAll(() => {
  for (const t of made) dropTree(t);
});
const copy = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  return t;
};

describe("k.evaluator: a question is answered by the command and recorded", () => {
  test(
    "a `process.env` name outside `TZ`, `LANG` and `LC_*` read by evaluated code is answered through the command: its value reaches `routes.json` in the same run",
    () => {
      const t = copy();
      gFixture(t, "export default process.env.REPRO_X ?? '0'\n");
      const out = keelBounded(t.dir, ["check"], RUN, { REPRO_X: "1" });
      expect(out.status, brief(out)).toBe(0);
      expect(read(t.dir, ".keel/routes.json")).toContain("members.signin");
    },
    SLOW,
  );

  test(
    "that name is recorded: a `keel check` with `REPRO_X=2` after one with `REPRO_X=1` has `counts.evaluated` 1, and a third with `REPRO_X=2` has `counts.cached` 1",
    () => {
      const t = copy();
      gFixture(t, "export default process.env.REPRO_X ?? '0'\n");
      keelBounded(t.dir, ["check"], RUN, { REPRO_X: "1" });
      const second = keelBounded(t.dir, ["check"], RUN, { REPRO_X: "2" });
      expect(second.counts.evaluated, brief(second)).toBe(1);
      expect(read(t.dir, ".keel/routes.json")).toContain("app.start");
      const third = keelBounded(t.dir, ["check"], RUN, { REPRO_X: "2" });
      expect(third.counts.cached, brief(third)).toBe(1);
      expect(third.counts.evaluated, brief(third)).toBe(0);
    },
    SLOW,
  );
});

describe("k.evaluator Rules: E1048 is a command code", () => {
  test("`check()` never reports E1048 and `reportedCodes()` does not list it", () => {
    expect(reportedCodes()).not.toContain("E1048");
  });
});
