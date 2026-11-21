import fc from "fast-check";
// Spec: k.shell, Conformance "With `platforms: ['x']`, `--platform y` and no `--platform` are each one E1052; a stub registering nothing, or a path `../a.json`, is one E1585."
// Spec: k.shell, Rules "E1585 a shell package registering no target, or a shell file path outside its folder."
// E1052 is a usage error, exit 2 (k.cli Output: "2 usage error"; rules-e1052.test.ts reads an unknown flag the same).
// Seed: 1337 (the wrong platform and the paths outside the folder are generated).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`). ASSUMPTION: the E1585 of a path is read from `keel build --target tauri` and from `keel check` (k.shell Files: "a path with a `..` segment, a `\` or a leading `/` is E1585"); each prints exactly one.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, buildCalls, cleanup, run, setStub, stubProject, withCode } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

const other = fc.stringMatching(/^[a-wyz][a-z]{0,6}$/);
const outside = fc.constantFrom("../a.json", "a/../../b.json", "/abs/a.json", "a\\b.json", "..", "x/../../y");

describe("k.shell: platforms and registration over a stub package", () => {
  test(
    "With `platforms: ['x']`, `--platform y` is one E1052.",
    () => {
      fc.assert(
        fc.property(other, (y) => {
          setStub(dir, { platforms: ["x"] });
          const r = run(dir, ["build", "--target", "tauri", "--platform", y]);
          expect(withCode(r, "E1052")).toHaveLength(1);
          expect(r.status).toBe(2);
          expect(buildCalls(dir)).toEqual([]);
        }),
        { seed: SEED, numRuns: 4 },
      );
    },
    SLOW,
  );

  test(
    "With `platforms: ['x']`, no `--platform` is one E1052.",
    () => {
      setStub(dir, { platforms: ["x"] });
      const r = run(dir, ["build", "--target", "tauri"]);
      expect(withCode(r, "E1052")).toHaveLength(1);
      expect(r.status).toBe(2);
      expect(buildCalls(dir)).toEqual([]);
    },
    SLOW,
  );

  test(
    "A stub registering nothing is one E1585.",
    () => {
      setStub(dir, { register: false });
      const r = run(dir, ["build", "--target", "tauri"]);
      expect(withCode(r, "E1585")).toHaveLength(1);
      expect(r.status).toBe(1);
      expect(buildCalls(dir)).toEqual([]);
    },
    SLOW,
  );

  test(
    "A path `../a.json` (or any path outside the shell's folder) is one E1585.",
    () => {
      fc.assert(
        fc.property(outside, (path) => {
          setStub(dir, { files: { [path]: "{}\n" } });
          expect(withCode(run(dir, ["check"]), "E1585")).toHaveLength(1);
          const r = run(dir, ["build", "--target", "tauri"]);
          expect(withCode(r, "E1585")).toHaveLength(1);
          expect(r.status).toBe(1);
        }),
        { seed: SEED, numRuns: 6 },
      );
    },
    SLOW,
  );
});
