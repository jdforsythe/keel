import fc from "fast-check";
// Spec: k.shell, clause "A `build` whose `error` has an `error:` line then 20 more prints 12 from it and exits 1; one returning an `artifact` prints it in the trailer."
// k.shell, Build "5. `build`, writing only under `dir` and the app's files: an `error` (a tool's output) ends the build with its lines from the first error line, at most 12; the trailer names each `artifact`."
// Seed: 1337 (the lines before the `error:` line and the artifact path are generated).
// Over a stub `@keel/std-tauri` (`shell-stub.ts`). ASSUMPTION: "prints 12 from it" is the error line and the 11 after it, none of the lines before it, as RFC 0161 says "from the first error line, at most 12".
// ASSUMPTION: the trailer is the compact output's last summary (`ok build web tauri <artifact>`); read as the output text holding the artifact path.
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { SEED, SLOW, cleanup, run, setStub, stubProject } from "./shell-stub.ts";

let dir = "";
beforeAll(() => {
  dir = stubProject();
}, SLOW);
afterAll(() => cleanup(dir));

describe("k.shell: build over a stub package", () => {
  test(
    "A `build` whose `error` has an `error:` line then 20 more prints 12 from it and exits 1.",
    () => {
      fc.assert(
        fc.property(fc.nat(6), (before) => {
          const pre = Array.from({ length: before }, (_, i) => `noise before ${i + 1}`);
          const post = Array.from({ length: 20 }, (_, i) => `detail after ${i + 1}`);
          setStub(dir, { build: { error: [...pre, "error: something broke", ...post].join("\n") } });
          const r = run(dir, ["build", "--target", "tauri"]);
          expect(r.status).toBe(1);
          expect(r.out).toContain("error: something broke");
          const shown = post.filter((l) => new RegExp(`${l}(?!\\d)`).test(r.out));
          expect(shown).toEqual(post.slice(0, 11));
          expect(pre.filter((l) => new RegExp(`${l}(?!\\d)`).test(r.out))).toEqual([]);
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );

  test(
    "An `error` with fewer than 12 lines from its first error line prints every one of them and none before it.",
    () => {
      fc.assert(
        fc.property(fc.nat(6), fc.integer({ min: 0, max: 10 }), (before, after) => {
          const pre = Array.from({ length: before }, (_, i) => `noise before ${i + 1}`);
          const post = Array.from({ length: after }, (_, i) => `detail after ${i + 1}`);
          setStub(dir, { build: { error: [...pre, "error: something broke", ...post].join("\n") } });
          const r = run(dir, ["build", "--target", "tauri"]);
          expect(r.status).toBe(1);
          expect(r.out).toContain("error: something broke");
          expect(post.filter((l) => new RegExp(`${l}(?!\\d)`).test(r.out))).toEqual(post);
          expect(pre.filter((l) => new RegExp(`${l}(?!\\d)`).test(r.out))).toEqual([]);
        }),
        { seed: SEED, numRuns: 3 },
      );
    },
    SLOW,
  );

  test(
    "A `build` returning an `artifact` prints it in the trailer.",
    () => {
      fc.assert(
        fc.property(fc.stringMatching(/^[a-z]{3,8}$/), (name) => {
          const artifact = `dist/web/tauri/target/debug/${name}`;
          setStub(dir, { build: { artifact } });
          const r = run(dir, ["build", "--target", "tauri"], undefined, "compact");
          expect(r.status).toBe(0);
          expect(r.out).toContain(artifact);
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    SLOW,
  );
});
