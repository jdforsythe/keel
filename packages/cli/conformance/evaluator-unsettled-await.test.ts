// Spec: k.evaluator, clause "In `G` with `index.mjs` holding `await new Promise(() => {}); export default 1`, `keel check` and `keel build` each exit 1 with one E1048 whose `path` is a contract file or `routes.ts` of `modules/setup` and no other error, and their output holds neither `unsettled` nor `Warning`; `keel dev` there prints that E1048 and answers a request."
// Also states, k.evaluator End: "The command also ends it, with no result: `deadlineMs` after its start by the command's monotonic clock (30,000 unless given; no `keel` command gives one), E1048; when Node ends it because a top-level await can never settle, E1048; when it exits or is killed any other way, E1049; when the command itself exits or is interrupted."
// Also states, k.evaluator Placing: "E1048 and E1049 lie at the entry file whose import had not finished (`tokens.ts`, a contract file or a `routes.ts`), with no line."
// Seed 1337 (recorded); no random inputs. The household copy of derived-support.ts, built once and cloned per case (`G` of k.evaluator Conformance; evaluator-support.ts `gFixture`).
// The unsettled await is ended by Node, not by the 30 s deadline: each case asserts the message ends `a top-level await never settles` (the deadline's ends `in <n> ms`). `keel dev` is started on a free port and stopped (its process group, which this file spawned) in `afterAll`.
// ASSUMED: "answers a request" is a `GET /` that gets any status; "prints that E1048" is the dev output holding the text `E1048`.
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, test } from "vitest";
import { type Tree, brief, cloneTree, dropTree, householdTree, until } from "./derived-support.ts";
import { type Dev, gFixture, get, keelBounded, recordsOf, startDev, text } from "./evaluator-support.ts";

const SLOW = testTime(600_000);
const RUN = 60_000;
const CODE = "await new Promise(() => {}); export default 1";

let house: Tree | undefined;
const made: Tree[] = [];
const devs: Dev[] = [];
afterAll(() => {
  for (const d of devs) d.stop();
  for (const t of made) dropTree(t);
});
const copy = (): Tree => {
  house ??= householdTree();
  if (!made.includes(house)) made.push(house);
  const t = cloneTree(house);
  made.push(t);
  return t;
};

describe("k.evaluator: a top-level await that never settles is E1048 at the entry file", () => {
  test.each([["check"], ["build"]])(
    "in `G` with `index.mjs` holding `await new Promise(() => {}); export default 1`, `keel %s` exits 1 with one E1048 whose `path` is a contract file or `routes.ts` of `modules/setup` and no other error, and its output holds neither `unsettled` nor `Warning`",
    (command) => {
      const t = copy();
      gFixture(t, CODE);
      const out = keelBounded(t.dir, [command], RUN);
      expect(out.status, brief(out)).toBe(1);
      const found = recordsOf(out, "E1048");
      expect(found, brief(out)).toHaveLength(1);
      const path = found[0]?.path;
      expect(
        typeof path === "string" && /^modules\/setup\/(?:[^/]+\.contract\.ts|routes\.ts)$/.test(path),
        String(path),
      ).toBe(true);
      expect(found[0]?.line, "E1048 has no line").toBeUndefined();
      expect(text(found[0]).endsWith("a top-level await never settles"), text(found[0])).toBe(true);
      expect(
        out.diags.filter((d) => d.code !== "E1048"),
        brief(out),
      ).toEqual([]);
      expect(out.stdout + out.stderr).not.toContain("unsettled");
      expect(out.stdout + out.stderr).not.toContain("Warning");
    },
    SLOW,
  );

  test(
    "`keel dev` there prints that E1048 and answers a request",
    async () => {
      const t = copy();
      gFixture(t, CODE);
      const dev = await startDev(t.dir, 120_000);
      devs.push(dev);
      expect(dev.child.exitCode, dev.output()).toBeNull();
      const printed = await until(() => dev.output().includes("E1048"), testTime(60_000));
      expect(printed, dev.output()).toBe(true);
      const answer = await get(dev.port, "/");
      expect(answer, dev.output()).toBeDefined();
      expect(dev.output()).not.toContain("unsettled");
      dev.stop();
    },
    SLOW,
  );
});
