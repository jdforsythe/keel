// Spec: k.compat, clause "Removing an `output` field a base entry requires is one E1562 with no fix; adding a field to an open output object is none; removing a base entry is one E1562 with no fix."
// Seed 1337. Cross-deployable caller `a` (deployable x) of the contract `y` (deployable y). Every field is an entry `y.load<j>` of one project
// (`projectMany`), so the case is three builds and two checks.
import { afterAll, expect, test } from "vitest";
import { baseSurface, buildAndCheck, cleanup, diags, e1562Of, projectMany, write } from "./compat-support.ts";

/**
 * The case spawns three `keel build` and two `keel check`: 5 binary runs, 4.2 s alone here, 0.84 s a run. The allowance
 * is 40 s a run: 0.84 s times 10 (a runner ten times slower) times 3 (the suite runs files in parallel) times 1.5
 * (margin), 38 s rounded up, so at scale 0.1 each run has 4 s.
 */
const BINARY_RUN = 40_000;
const SLOW = 5 * BINARY_RUN;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const FIELDS = ["title", "total", "status"];

test(
  "Removing an `output` field a base entry requires is one E1562 with no fix; adding a field to an open output object is none.",
  () => {
    /** An output schema of `id` and `fields`, all strings, and a value of it. */
    const output = (fields: readonly string[]): [string, string] => [
      `s.object({ ${["id", ...fields].map((n) => `${n}: s.string()`).join(", ")} })`,
      `{ ${["id", ...fields].map((n) => `${n}: '${n === "id" ? "i" : "v"}'`).join(", ")} }`,
    ];
    const { dir, base } = baseSurface(projectMany({ outputs: FIELDS.map((f) => output([f])) }));
    dirs.push(dir);

    write(dir, projectMany({ outputs: FIELDS.map(() => output([])) }));
    const removed = buildAndCheck(dir, base);
    expect(diags(removed, "E1562")).toHaveLength(FIELDS.length);
    FIELDS.forEach((f, j) => {
      const found = e1562Of(removed, `y.load${j}`);
      expect(found, f).toHaveLength(1);
      expect(String(found[0]?.message)).toContain(f);
      expect(found[0]?.fix).toBeUndefined();
    });

    write(dir, projectMany({ outputs: FIELDS.map((f) => output([f, "more"])) }));
    const extra = buildAndCheck(dir, base);
    expect(diags(extra, "E1562")).toEqual([]);
    FIELDS.forEach((f, j) => expect(e1562Of(extra, `y.load${j}`), f).toEqual([]));
  },
  SLOW,
);
