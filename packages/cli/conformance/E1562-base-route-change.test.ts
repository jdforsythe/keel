// Spec: k.compat, clause "With a base where `y`'s action input is `{ name }` and its caller `a` is in deployable `x`, adding a required field `note` is one E1562 at `note` whose fix leaves none; with `a` and the route in one deployable there is none."
// Seed 1337. The base is a copy of an earlier build's `.keel/surface.json`; the change is made in the same temp project and rebuilt.
// ASSUMED: the fix is the `fix` diff on the diag record; "leaves none" is checked by applying the described change (make `note` optional) and re-checking.
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import {
  SEED,
  baseSurface,
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

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const NAME = "s.object({ name: s.string() })";
// The caller's body is closed: an open body may carry any undeclared field, which an added `note` would refuse (k.compat Accepts).
const CLOSED = "s.object({ name: s.string() }, { closed: true })";
const field = fc.constantFrom("note", "qty", "label");

test(
  "With a base where `y`'s action input is `{ name }` and its caller `a` is in deployable `x`, adding a required field `note` is one E1562 at `note` whose fix leaves none; with `a` and the route in one deployable there is none.",
  () => {
    fc.assert(
      fc.property(field, (f) => {
        const required = `s.object({ name: s.string(), ${f}: s.string() })`;
        const { dir, base } = baseSurface(project({ input: NAME, body: CLOSED, split: true }));
        dirs.push(dir);
        write(dir, project({ input: required, body: CLOSED, split: true }));
        const run = buildAndCheck(dir, base);
        const found = diags(run, "E1562");
        expect(found).toHaveLength(1);
        expect(String(found[0]?.message)).toContain(f);
        expect(found[0]?.fix).toBeDefined();
        write(
          dir,
          project({ input: `s.object({ name: s.string(), ${f}: s.string().optional() })`, body: CLOSED, split: true }),
        );
        expect(diags(buildAndCheck(dir, base), "E1562")).toEqual([]);

        const one = baseSurface(project({ input: NAME, body: CLOSED, split: false }));
        dirs.push(one.dir);
        write(one.dir, project({ input: required, body: CLOSED, split: false }));
        expect(diags(buildAndCheck(one.dir, one.base), "E1562")).toEqual([]);
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);

test("E1562: modules in one deployable are not compared; moving `a` to another deployable makes the same change E1562", () => {
  const { dir, base } = baseSurface(project({ input: NAME, body: CLOSED, split: false }));
  dirs.push(dir);
  write(dir, project({ input: "s.object({ name: s.string(), note: s.string() })", body: CLOSED, split: true }));
  expect(diags(buildAndCheck(dir, base), "E1562")).toHaveLength(1);
});

test("E1562: a change that no base endpoint refuses (an added optional field) is clean", () => {
  const { dir, base } = baseSurface(project({ input: NAME, body: CLOSED, split: true }));
  dirs.push(dir);
  write(
    dir,
    project({ input: "s.object({ name: s.string(), note: s.string().optional() })", body: CLOSED, split: true }),
  );
  expect(diags(buildAndCheck(dir, base), "E1562")).toEqual([]);
  expect(keel(dir, ["check", "--base", base]).records.some((r) => r.kind === "diag" && r.code === "E1562")).toBe(false);
});

test("a base file absent, unreadable or of another `version` is W1568 and no E1562: a file that is not a surface is one W1568 and does not change the exit code", () => {
  // k.compat Base: "a base file absent, unreadable or of another `version` is W1568 and no E1562".
  // `{}` holds no `version: 1` (another version); `not json` is unreadable as a surface.
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
