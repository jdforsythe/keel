// Spec: k.compat, clause "With a base where `y.add`'s `body` is `{ name }` and module `a`, which imports `y`'s contract, is in deployable `x`, adding a required `note` is one E1562 at `note` whose fix leaves none; with `a` and `y` in one deployable there is none."
// Seed 1337. The base is a copy of an earlier build's `.keel/surface.json`; the change is made in the same temp project and rebuilt.
// ASSUMED: the fix is the `fix` diff on the diag record; "leaves none" is checked by applying the described change (make `note` optional) and re-checking.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import {
  SEED,
  baseSurfaceOnce,
  buildAndCheck,
  cleanup,
  diags,
  keel,
  materialize,
  project,
  write,
} from "./compat-support.ts";

/** Property runs spawn several `keel build` and `keel check` processes each. */
const SLOW = 120_000;
/**
 * What the first case bounds: six binary runs, two `keel build`s of a base and three `keel build` and `keel check`
 * pairs less the one cut short, about 3 s a run here (18 s in all). The bound is 60 s a run, so a runner ten times
 * slower (scale 0.1) still has twice the work's time.
 */
const SPLIT_CASE_BOUND = 6 * 60_000;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const NAME = "s.object({ name: s.string()  }, { closed: true })";
// The clause names the field `note`: one example, run through `fc.assert` once.
const field = fc.constant("note");

test(
  "With a base where `y`'s action input is `{ name }` and its caller `a` is in deployable `x`, adding a required field `note` is one E1562 at `note` whose fix leaves none; with `a` and the route in one deployable there is none.",
  () => {
    fc.assert(
      fc.property(field, (f) => {
        const required = `s.object({ name: s.string(), ${f}: s.string()  }, { closed: true })`;
        const { dir, base } = baseSurfaceOnce(project({ body: NAME, split: true }));
        dirs.push(dir);
        write(dir, project({ body: required, split: true }));
        const run = buildAndCheck(dir, base);
        const found = diags(run, "E1562");
        expect(found).toHaveLength(1);
        expect(String(found[0]?.message)).toContain(f);
        expect(found[0]?.fix).toBeDefined();
        write(
          dir,
          project({
            body: `s.object({ name: s.string(), ${f}: s.string().optional()  }, { closed: true })`,
            split: true,
          }),
        );
        expect(diags(buildAndCheck(dir, base), "E1562")).toEqual([]);

        const one = baseSurfaceOnce(project({ body: NAME, split: false }));
        dirs.push(one.dir);
        write(one.dir, project({ body: required, split: false }));
        expect(diags(buildAndCheck(one.dir, one.base), "E1562")).toEqual([]);
      }),
      { seed: SEED, numRuns: 1 },
    );
  },
  SPLIT_CASE_BOUND,
);

test("E1562: modules in one deployable are not compared; moving `a` to another deployable makes the same change E1562", () => {
  const { dir, base } = baseSurfaceOnce(project({ body: NAME, split: false }));
  dirs.push(dir);
  write(dir, project({ body: "s.object({ name: s.string(), note: s.string()  }, { closed: true })", split: true }));
  expect(diags(buildAndCheck(dir, base), "E1562")).toHaveLength(1);
});

test("E1562: a change that no base endpoint refuses (an added optional field) is clean", () => {
  const { dir, base } = baseSurfaceOnce(project({ body: NAME, split: true }));
  dirs.push(dir);
  write(
    dir,
    project({ body: "s.object({ name: s.string(), note: s.string().optional()  }, { closed: true })", split: true }),
  );
  expect(diags(buildAndCheck(dir, base), "E1562")).toEqual([]);
  expect(keel(dir, ["check", "--base", base]).records.some((r) => r.kind === "diag" && r.code === "E1562")).toBe(false);
});

test("a base file absent or unreadable (not JSON, or not a `version: 2` surface) is W1568 and no E1562: a file that is not a surface is one W1568 and does not change the exit code", () => {
  // k.compat Base: "a base file absent or unreadable (not JSON, or not a `version: 2` surface) is W1568 and no E1562".
  // `{}` and `not json` are unreadable as a surface.
  const dir = materialize(project({ split: true }));
  dirs.push(dir);
  write(dir, { "bad-base.json": "{}", "text-base.json": "not json" });
  const plain = keel(dir, ["check"]).status;
  for (const base of ["bad-base.json", "text-base.json"]) {
    const run = keel(dir, ["check", "--base", base]);
    expect(diags(run, "W1568"), base).toHaveLength(1);
    expect(diags(run, "E1562"), base).toEqual([]);
    // the exit code is the one plain `keel check` gives this project: the base adds none
    expect(run.status, base).toBe(plain);
  }
});
